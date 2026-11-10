import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import * as Location from 'expo-location';
import { getLocationPermission } from '../services/LocationService';

type Props = {
  enabled: boolean;
};

export default function LocationAvailabilityAlert({ enabled }: Props) {
  const isAlertVisible = useRef(false);
  const isChecking = useRef(false);

  const checkLocationAvailability = useCallback(async () => {
    if (!enabled || isAlertVisible.current || isChecking.current) {
      return;
    }

    isChecking.current = true;
    try {
      const [permission, servicesEnabled] = await Promise.all([
        getLocationPermission(),
        Location.hasServicesEnabledAsync(),
      ]);

      if (!permission.granted || !servicesEnabled) {
        isAlertVisible.current = true;
        const dismissAlert = () => {
          isAlertVisible.current = false;
        };

        Alert.alert(
          'Location Unavailable',
          'To map where you listen, turn on Location Services and allow SpotiMaps to access your location in Settings.',
          [
            { text: 'Not Now', style: 'cancel', onPress: dismissAlert },
            {
              text: 'Open Settings',
              onPress: () => {
                dismissAlert();
                void Linking.openSettings().catch((error) => {
                  console.error('Could not open location settings:', error);
                });
              },
            },
          ],
          { onDismiss: dismissAlert },
        );
      }
    } catch (error) {
      console.error('Could not check location availability:', error);
    } finally {
      isChecking.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void checkLocationAvailability();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkLocationAvailability();
      }
    });

    return () => subscription.remove();
  }, [checkLocationAvailability, enabled]);

  return null;
}
