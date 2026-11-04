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

export async function startTracking(): Promise<boolean> {
  if (trackingSubscription) {
    return false;
  }

  const permission = await getLocationPermission();

  if (!permission.granted) {
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
        trackingReadings.push({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp,
        });
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

    await AsyncStorage.removeItem(BACKGROUND_STORAGE_KEY);

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
  try {
    const tracking =
      await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);

    if (tracking) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }

    const saved = await AsyncStorage.getItem(BACKGROUND_STORAGE_KEY);

    return saved ? (JSON.parse(saved) as GPSReading[]) : [];
  } catch (error) {
    console.error('Failed to stop background GPS tracking:', error);
    return [];
  }
}

export async function isBackgroundTracking(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
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
