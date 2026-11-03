import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKGROUND_LOCATION_TASK } from './BackgroundLocationTask';

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