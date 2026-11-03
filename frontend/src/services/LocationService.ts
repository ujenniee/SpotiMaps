import * as Location from 'expo-location';
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

export async function syncCurrentLocation(
  client: SupabaseClient<Database>,
): Promise<GPSReading | null> {
  const { data, error: authError } = await client.auth.getUser();
  if (authError || !data.user) {
    throw new Error('Sign in to SpotiMaps before saving a GPS location.');
  }

  const reading = await getCurrentLocation();
  if (!reading) {
    return null;
  }
  if (!Number.isFinite(reading.latitude) || reading.latitude < -90 || reading.latitude > 90
    || !Number.isFinite(reading.longitude) || reading.longitude < -180 || reading.longitude > 180
    || !Number.isSafeInteger(reading.timestamp) || reading.timestamp < 0
    || !Number.isFinite(new Date(reading.timestamp).getTime())) {
    throw new Error('GPS reading must contain valid coordinates and a timestamp in milliseconds.');
  }

  const row: LocationSampleInsert = {
    user_id: data.user.id,
    latitude: reading.latitude,
    longitude: reading.longitude,
    recorded_at: new Date(reading.timestamp).toISOString(),
  };
  const { error } = await client.from('location_samples')
    .upsert(row, { onConflict: 'user_id,recorded_at', ignoreDuplicates: true });

  if (error) {
    throw new Error(`Could not save GPS location: ${error.message}`);
  }
  return reading;
}
