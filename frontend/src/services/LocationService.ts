import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKGROUND_LOCATION_TASK } from './BackgroundLocationTask';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, LocationSampleInsert } from '../types/database';

export type LocationPermission = 'granted' | 'denied';

export type LocationPermissionStatus = {
  granted: boolean;
  canAskAgain: boolean;
};

export async function getLocationPermission(): Promise<LocationPermissionStatus> {
  try {
    const { granted, canAskAgain } = await Location.getForegroundPermissionsAsync();
    return { granted, canAskAgain };
  } catch {
    return { granted: false, canAskAgain: false };
  }
}

export async function requestLocationPermission(): Promise<LocationPermission> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}
export type GPSReading = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

function isGPSReading(value: unknown): value is GPSReading {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const reading = value as Record<string, unknown>;
  return typeof reading.latitude === 'number'
    && Number.isFinite(reading.latitude)
    && reading.latitude >= -90
    && reading.latitude <= 90
    && typeof reading.longitude === 'number'
    && Number.isFinite(reading.longitude)
    && reading.longitude >= -180
    && reading.longitude <= 180
    && typeof reading.timestamp === 'number'
    && Number.isFinite(reading.timestamp);
}

export type OwnedGPSReading = GPSReading & {
  userId: string;
};
export async function getCurrentLocation(): Promise<GPSReading | null> {
  const permission = await getLocationPermission();

  if (!permission.granted) {
    return null;
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      timestamp: position.timestamp,
    };
  } catch (error) {
    console.error('Failed to get GPS location:', error);
    return null;
  }
}
let trackingSubscription: Location.LocationSubscription | null = null;
let trackingReadings: GPSReading[] = [];

const GPS_STORAGE_KEY = 'spotimaps-gps-readings';
export const GPS_OWNER_STORAGE_KEY = 'spotimaps-gps-owner-id';
const GPS_OWNER_STARTED_AT_KEY = 'spotimaps-gps-owner-started-at';
const GPS_PENDING_PREFIX = 'spotimaps-gps-pending:';


export async function setGPSOwner(userId: string): Promise<void> {
  if (!userId) {
    throw new Error('Cannot set GPS owner without a user ID.');
  }

  const existingOwner = await AsyncStorage.getItem(GPS_OWNER_STORAGE_KEY);
  const existingStart = await AsyncStorage.getItem(GPS_OWNER_STARTED_AT_KEY);

  if (existingOwner === userId && existingStart !== null) {
    return;
  }

  await AsyncStorage.multiSet([
    [GPS_OWNER_STARTED_AT_KEY, String(Date.now())],
    [GPS_OWNER_STORAGE_KEY, userId],
  ]);
}
export async function clearGPSOwner(): Promise<void> {
  await AsyncStorage.multiRemove([
    GPS_OWNER_STORAGE_KEY,
    GPS_OWNER_STARTED_AT_KEY,
  ]);
}

let gpsStorageQueue: Promise<void> = Promise.resolve();

export function saveGPSReadings(
  readings: GPSReading[],
  userId: string
): Promise<void> {
  const operation = gpsStorageQueue.then(async () => {
    if (readings.length === 0) {
      return;
    }

    if (!userId) {
      throw new Error('Cannot save GPS readings without an owner.');
    }

    const ownedReadings: OwnedGPSReading[] = readings.map((reading) => ({
      ...reading,
      userId,
    }));

    const batchKey =
      `${GPS_PENDING_PREFIX}${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    await AsyncStorage.setItem(
      batchKey,
      JSON.stringify(ownedReadings)
    );

    console.log(
      `Saved ${ownedReadings.length} foreground GPS readings locally.`
    );
  });

  gpsStorageQueue = operation.catch((error) => {
    console.error('Failed to save GPS readings:', error);
  });

  return operation;
}

export async function startTracking(userId: string): Promise<boolean> {
  if (!userId) {
    return false;
  }

  if (trackingSubscription) {
    return false;
  }

  const permission = await getLocationPermission();

  if (!permission.granted) {
    return false;
  }

  // Confirm this user is still the active GPS owner.
  const currentOwner = await AsyncStorage.getItem(GPS_OWNER_STORAGE_KEY);

  if (currentOwner !== userId) {
    return false;
  }

  trackingReadings = [];

  try {
    trackingSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 5,
        timeInterval: 5000,
      },
      (position) => {
        const reading: GPSReading = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp,
        };

        trackingReadings.push(reading);

        // Save using the owner who started this tracking session.
        void saveGPSReadings([reading], userId).catch((error) => {
          console.error('Could not persist foreground GPS reading:', error);
        });

        console.log('Automatic GPS reading:', reading);
      }
    );

    return true;
  } catch (error) {
    console.error('Failed to start GPS tracking:', error);
    return false;
  }
}

export function stopTracking(): GPSReading[] {
  trackingSubscription?.remove();
  trackingSubscription = null;

  return trackingReadings;
}
const BACKGROUND_STORAGE_KEY = 'spotimaps-gps-readings';

export async function requestBackgroundLocationPermission(): Promise<boolean> {
  try {
    const foreground = await Location.getForegroundPermissionsAsync();

    if (!foreground.granted) {
      const requested = await Location.requestForegroundPermissionsAsync();

      if (!requested.granted) {
        return false;
      }
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    return background.granted;
  } catch (error) {
    console.error('Failed to request background location permission:', error);
    return false;
  }
}

export async function startBackgroundTracking(): Promise<boolean> {
  try {
    const alreadyTracking =
      await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);

    if (alreadyTracking) {
      return false;
    }

    const granted = await requestBackgroundLocationPermission();

    if (!granted) {
      return false;
    }


    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 5,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    return true;
  } catch (error) {
    console.error('Failed to start background GPS tracking:', error);
    return false;
  }
}

export async function stopBackgroundTracking(): Promise<GPSReading[]> {
  const tracking =
    await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);

  if (tracking) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }

  const saved = await AsyncStorage.getItem(BACKGROUND_STORAGE_KEY);
  if (saved === null) {
    return [];
  }

  const readings: unknown = JSON.parse(saved);
  if (!Array.isArray(readings) || !readings.every(isGPSReading)) {
    throw new Error('Stored background GPS readings are invalid.');
  }
  return readings;
}

export async function isBackgroundTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}

/** Upload a collected batch. Keep the readings on the device until this succeeds. */
export async function syncLocationHistory(
  client: SupabaseClient<Database>,
  readings: readonly GPSReading[],
) {
  if (readings.length === 0) {
    return { receivedCount: 0, insertedCount: 0, matchingError: null };
  }
  for (const reading of readings) {
    if (!reading || !Number.isFinite(reading.latitude) || Math.abs(reading.latitude) > 90
      || !Number.isFinite(reading.longitude) || Math.abs(reading.longitude) > 180
      || !Number.isFinite(reading.timestamp)
      || !Number.isFinite(new Date(reading.timestamp).getTime())) {
      throw new Error('GPS readings must contain valid coordinates and capture timestamps.');
    }
  }
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) {
    throw new Error('Sign in to SpotiMaps before syncing GPS readings.');
  }
  const rows: LocationSampleInsert[] = readings.map((reading) => ({
    user_id: auth.user.id,
    latitude: reading.latitude,
    longitude: reading.longitude,
    recorded_at: new Date(reading.timestamp).toISOString(),
  }));
  let insertedCount = 0;
  for (let offset = 0; offset < rows.length; offset += 500) {
    const { data, error } = await client.from('location_samples')
      .upsert(rows.slice(offset, offset + 500), {
        onConflict: 'user_id,recorded_at', ignoreDuplicates: true,
      })
      .select('id');
    if (error) throw new Error(`Could not save GPS readings: ${error.message}`);
    insertedCount += data?.length ?? 0;
  }

  // Include songs up to 60 seconds either side of a sample. Split long batches
  // into ranges below the database's 7-day limit, without looping over empty days.
  const timestamps = [...new Set(readings.map((reading) => reading.timestamp))].sort((a, b) => a - b);
  let matchingError: string | null = null;
  try {
    for (let first = 0; first < timestamps.length;) {
      let last = first;
      while (last + 1 < timestamps.length
        && timestamps[last + 1] - timestamps[first] < 6 * 24 * 60 * 60 * 1000) last++;
      const { data, error } = await client.rpc('match_listening_locations', {
        p_from: new Date(timestamps[first] - 60_000).toISOString(),
        p_to: new Date(timestamps[last] + 60_001).toISOString(),
        p_max_gap_seconds: 60,
      });
      if (error) throw new Error(error.message);
      if (!data || data.length !== 1) throw new Error('Matching did not return a result.');
      first = last + 1;
    }
  } catch (error) {
    // The upload is already saved. Re-uploading the same batch safely retries matching.
    matchingError = error instanceof Error ? error.message : 'Could not request song-location matching.';
  }
  return { receivedCount: readings.length, insertedCount, matchingError };
}
let pendingGPSSync: Promise<void> | null = null;

/**
 * Upload locally saved GPS readings belonging to
 * the currently authenticated Supabase user.
 */
export function syncPendingGPSReadings(
  client: SupabaseClient<Database>,
): Promise<void> {
  // Prevent multiple uploads from running simultaneously.
  if (pendingGPSSync) {
    return pendingGPSSync;
  }

  const operation = (async () => {
    // Get the authenticated Supabase user.
    const { data: auth, error: authError } = await client.auth.getUser();

    if (authError || !auth.user) {
      return;
    }

    const userId = auth.user.id;
    const prefix = `${GPS_PENDING_PREFIX}${userId}:`;

    // Find locally stored GPS batches for this user.
    const keys = (await AsyncStorage.getAllKeys())
      .filter((key) => key.startsWith(prefix))
      .sort();

    for (const key of keys) {
      // Stop syncing if the authenticated user changes.
      const { data: currentAuth, error: currentError } =
        await client.auth.getUser();

      if (currentError || currentAuth.user?.id !== userId) {
        return;
      }

      const raw = await AsyncStorage.getItem(key);

      if (raw === null) {
        continue;
      }

      let readings: OwnedGPSReading[];

      try {
        const parsed: unknown = JSON.parse(raw);

        // Reject batches that do not belong to this user.
        if (
          !Array.isArray(parsed) ||
          parsed.length === 0 ||
          !parsed.every(
            (item): item is OwnedGPSReading =>
              item !== null &&
              typeof item === 'object' &&
              'userId' in item &&
              item.userId === userId &&
              'latitude' in item &&
              typeof item.latitude === 'number' &&
              'longitude' in item &&
              typeof item.longitude === 'number' &&
              'timestamp' in item &&
              typeof item.timestamp === 'number'
          )
        ) {
          console.error(
            'Invalid or mismatched GPS batch; leaving it untouched:',
            key
          );
          continue;
        }

        readings = parsed;
      } catch (error) {
        console.error(
          'Could not parse GPS batch; leaving it untouched:',
          key,
          error
        );
        continue;
      }

      try {
        // Upload GPS readings to Supabase.
        const result = await syncLocationHistory(client, readings);

        // Keep the batch if song-location matching failed.
        if (result.matchingError) {
          console.warn(
            'GPS uploaded, but song matching needs retry:',
            result.matchingError
          );
          continue;
        }

        // Remove the local batch only after successful processing.
        await AsyncStorage.removeItem(key);

        console.log(
          `Synced ${readings.length} GPS readings to Supabase.`
        );
      } catch (error) {
        // Keep failed batches locally so they can be retried.
        console.error(
          'GPS upload failed; keeping batch for retry:',
          error
        );
        return;
      }
    }
  })();

  pendingGPSSync = operation.finally(() => {
    pendingGPSSync = null;
  });

  return pendingGPSSync;
}
