import * as Location from 'expo-location';

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