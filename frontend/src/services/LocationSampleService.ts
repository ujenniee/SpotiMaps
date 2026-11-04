import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, LocationSampleInsert, ListeningMatchResult } from '../types/database';
import type { GPSReading } from './LocationService';
import { matchListeningLocations } from './ListeningMatchService.ts';

const MAX_UPSERT_BATCH_SIZE = 500;
const MAX_MATCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MATCH_GAP_SECONDS = 60;

export type SavedLocationSamplesResult = {
  insertedCount: number;
  matchingResults: ListeningMatchResult[];
};

/** Persist collected GPS readings and match plays in their time range. */
export async function saveLocationSamples(
  client: SupabaseClient<Database>,
  readings: GPSReading[],
): Promise<SavedLocationSamplesResult> {
  if (readings.length === 0) {
    return { insertedCount: 0, matchingResults: [] };
  }

  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) {
    throw new Error('Sign in to SpotiMaps before saving location samples.');
  }

  const normalizedReadings = new Map<string, LocationSampleInsert>();
  readings.forEach((reading) => {
    if (!Number.isFinite(reading.latitude) || reading.latitude < -90 || reading.latitude > 90
      || !Number.isFinite(reading.longitude) || reading.longitude < -180 || reading.longitude > 180
      || !Number.isFinite(reading.timestamp)) {
      throw new Error('GPS readings must contain valid coordinates and timestamps.');
    }

    const recordedAt = new Date(reading.timestamp);
    if (!Number.isFinite(recordedAt.getTime())) {
      throw new Error('GPS readings must contain valid coordinates and timestamps.');
    }
    const recorded_at = recordedAt.toISOString();
    normalizedReadings.set(recorded_at, {
      user_id: auth.user.id,
      latitude: reading.latitude,
      longitude: reading.longitude,
      recorded_at,
    });
  });

  const samples = [...normalizedReadings.values()].sort(
    (a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at),
  );
  let insertedCount = 0;

  for (let index = 0; index < samples.length; index += MAX_UPSERT_BATCH_SIZE) {
    const batch = samples.slice(index, index + MAX_UPSERT_BATCH_SIZE);
    const { data, error } = await client.from('location_samples')
      .upsert(batch, { onConflict: 'user_id,recorded_at', ignoreDuplicates: true })
      .select('id');
    if (error) {
      throw new Error(`Could not save location samples: ${error.message}`);
    }
    insertedCount += data?.length ?? 0;
  }

  const firstTimestamp = Date.parse(samples[0].recorded_at) - MATCH_GAP_SECONDS * 1000;
  const lastTimestamp = Date.parse(samples[samples.length - 1].recorded_at)
    + MATCH_GAP_SECONDS * 1000;
  const matchingResults: ListeningMatchResult[] = [];

  for (let from = firstTimestamp; from < lastTimestamp;) {
    const to = Math.min(from + MAX_MATCH_WINDOW_MS, lastTimestamp);
    matchingResults.push(await matchListeningLocations(client, {
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      maxGapSeconds: MATCH_GAP_SECONDS,
    }));
    from = to;
  }

  return { insertedCount, matchingResults };
}
