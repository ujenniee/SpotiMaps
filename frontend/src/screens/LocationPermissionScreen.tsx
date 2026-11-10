import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import ActionButton from '../components/ActionButton';
import { colors } from '../theme';
import { getLocationPermission, requestLocationPermission } from '../services/LocationService';

type Props = {
  onDone: () => void;
};

export default function LocationPermissionScreen({ onDone }: Props) {
  const [isAsking, setIsAsking] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const isLocationAlertVisible = useRef(false);

  const showLocationUnavailable = useCallback(() => {
    if (isLocationAlertVisible.current) {
      return;
    }

    isLocationAlertVisible.current = true;
    Alert.alert(
      'Location Unavailable',
      'To map where you listen, turn on Location Services and allow SpotiMaps to access your location in Settings.',
      [
        { text: 'Not Now', style: 'cancel', onPress: onDone },
        {
          text: 'Open Settings',
          onPress: () => {
            void Linking.openSettings().catch((error) => {
              console.error('Could not open location settings:', error);
            });
          },
        },
      ],
      {
        onDismiss: () => {
          isLocationAlertVisible.current = false;
        },
      },
    );
  }, [onDone]);

  const checkPermission = useCallback(async () => {
    try {
      const [permission, servicesEnabled] = await Promise.all([
        getLocationPermission(),
        Location.hasServicesEnabledAsync(),
      ]);

      if (permission.granted && servicesEnabled) {
        onDone();
        return;
      }

      setIsBlocked(!servicesEnabled || !permission.canAskAgain);
      if (!servicesEnabled || (!permission.granted && !permission.canAskAgain)) {
        showLocationUnavailable();
      }
    } catch (error) {
      console.error('Could not check location availability:', error);
      showLocationUnavailable();
    }
  }, [onDone, showLocationUnavailable]);

  const handleOpenSettings = () => {
    void Linking.openSettings().catch((error) => {
      console.error('Could not open location settings:', error);
    });
  };

  useEffect(() => {
    checkPermission();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkPermission();
      }
    });
    return () => subscription.remove();
  }, [checkPermission]);

  const handleAllow = async () => {
    setIsAsking(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setIsBlocked(true);
        showLocationUnavailable();
        return;
      }

      const result = await requestLocationPermission();
      if (result === 'granted') {
        onDone();
      } else {
        setIsBlocked(!(await getLocationPermission()).canAskAgain);
        showLocationUnavailable();
      }
    } catch (error) {
      console.error('Could not request location access:', error);
      showLocationUnavailable();
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="map-marker-radius" size={64} color={colors.text} />
        </View>

        <Text style={styles.title}>
          {isBlocked ? 'Location is turned off' : 'Allow location access'}
        </Text>
        <Text style={styles.body}>
          {isBlocked
            ? 'SpotiMaps can’t place new songs on your map without your location. You can turn it on in your iPhone Settings.'
            : 'SpotiMaps uses your location to show where you listened to each song. Location is only recorded while tracking is on, and you can turn it off anytime in Settings.'}
        </Text>
      </View>

      <View style={styles.actions}>
        <ActionButton
          label={isBlocked ? 'Open Settings' : 'Allow location'}
          onPress={isBlocked ? handleOpenSettings : handleAllow}
          loading={isAsking}
          disabled={isAsking}
        />

        <ActionButton
          label={isBlocked ? 'Continue without location' : 'Not now'}
          onPress={onDone}
          variant="secondary"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: 32,
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
  },
  actions: {
    alignItems: 'center',
    marginBottom: 40,
  },
});