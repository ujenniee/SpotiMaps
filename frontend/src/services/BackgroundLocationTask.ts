import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BACKGROUND_LOCATION_TASK = 'spotimaps-background-location';
const STORAGE_KEY = 'spotimaps-gps-readings';

export type GPSReading = {
  latitude: number;
  longitude: number;
  timestamp: number;
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
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const readings: GPSReading[] = saved ? JSON.parse(saved) : [];
  
      for (const location of locations) {
        readings.push({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: location.timestamp,
        });
      }
  
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(readings));
    } catch (error) {
      console.error('Failed to save background GPS:', error);
    }
  });