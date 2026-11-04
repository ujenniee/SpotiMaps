import type { SupabaseClient } from '@supabase/supabase-js';
import type { MapPlace, Song } from '../data/mockData';
import type { Database, MatchedListeningEvent } from '../types/database';
import { getMatchedListeningHistory } from './MatchedListeningHistoryService.ts';
import { matchListeningLocations } from './ListeningMatchService.ts';

const HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;

function isValidCoordinate(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function createSongs(rows: MatchedListeningEvent[]): Song[] {
  const songs = new Map<string, Song>();

  rows.forEach((row) => {
    const title = row.title.trim();
    if (!title) {
      return;
    }

    const artist = row.artist || 'Unknown artist';
    const genre = row.genre?.trim() || null;
    const key = JSON.stringify([title, artist, genre]);
    const existing = songs.get(key);

    if (existing) {
      existing.plays += 1;
    } else {
      songs.set(key, { title, artist, genre, plays: 1 });
    }
  });

  return [...songs.values()].sort((a, b) => b.plays - a.plays);
}

/** Load the signed-in user's matched plays from the most recent seven days. */
export async function fetchMapPlaces(client: SupabaseClient<Database>): Promise<MapPlace[]> {
  const to = new Date();
  const from = new Date(to.getTime() - HISTORY_WINDOW_MS);
  const range = { from: from.toISOString(), to: to.toISOString() };
  const rows: MatchedListeningEvent[] = [];

  await matchListeningLocations(client, range);

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await getMatchedListeningHistory(client, {
      ...range,
      limit: PAGE_SIZE,
      offset,
    });
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  const groups = new Map<string, {
    latitude: number;
    longitude: number;
    rows: MatchedListeningEvent[];
  }>();
  rows.forEach((row) => {
    if (row.match_status !== 'matched'
      || !row.location_id
      || !isValidCoordinate(row.latitude)
      || !isValidCoordinate(row.longitude)) {
      return;
    }

    const group = groups.get(row.location_id);
    if (group) {
      group.rows.push(row);
    } else {
      groups.set(row.location_id, {
        latitude: row.latitude,
        longitude: row.longitude,
        rows: [row],
      });
    }
  });

  return [...groups.entries()].map(([locationId, group], index) => {
    return {
      id: locationId,
      name: `Listening stop ${index + 1}`,
      area: 'Recorded GPS location',
      latitude: group.latitude,
      longitude: group.longitude,
      songs: createSongs(group.rows),
    };
  });
}
