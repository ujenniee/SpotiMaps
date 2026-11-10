import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BACKGROUND_LOCATION_TASK = 'spotimaps-background-location';
const STORAGE_KEY = 'spotimaps-gps-readings';
const GPS_OWNER_STORAGE_KEY = 'spotimaps-gps-owner-id';
const GPS_OWNER_STARTED_AT_KEY = 'spotimaps-gps-owner-started-at';
const GPS_PENDING_PREFIX = 'spotimaps-gps-pending:';

export type GPSReading = {
  latitude: number;
  longitude: number;
  timestamp: number;
};
export type OwnedGPSReading = GPSReading & {
  userId: string;
};

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error('Background GPS error:', error);
      return;
    }

    const locations = (
      data as { locations?: Location.LocationObject[] } | undefined
    )?.locations;

    if (!locations || locations.length === 0) {
      return;
    }

    try {
      const [userId, startedAtString] = await Promise.all([
        AsyncStorage.getItem(GPS_OWNER_STORAGE_KEY),
        AsyncStorage.getItem(GPS_OWNER_STARTED_AT_KEY),
      ]);

      const startedAt = startedAtString === null
        ? NaN
        : Number(startedAtString);

      if (!userId || !Number.isFinite(startedAt)) {
        console.warn('Background GPS reading skipped: no active GPS owner.');
        return;
      }

      const readings: OwnedGPSReading[] = locations
      .filter((location) => location.timestamp >= startedAt)
      .map((location) => ({
        userId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
      }));

    if (readings.length === 0) {
      return;
    }

      const batchKey =
        `${GPS_PENDING_PREFIX}${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

      await AsyncStorage.setItem(batchKey, JSON.stringify(readings));

      console.log(`Saved ${readings.length} background GPS readings locally.`);
    } catch (error) {
      console.error('Failed to save background GPS:', error);
    }
  });