import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import { getLocationPermission, requestLocationPermission } from '../services/LocationService';

type Props = {
  onDone: () => void;
};

// Explains why SpotiMaps needs location, then lets the user allow or deny it.
export default function LocationPermissionScreen({ onDone }: Props) {
  const [isAsking, setIsAsking] = useState(false);
  // true when iOS won't show the popup again and the user must use Settings
  const [isBlocked, setIsBlocked] = useState(false);

  const checkPermission = useCallback(async () => {
    const permission = await getLocationPermission();
    if (permission.granted) {
      onDone();
    } else {
      setIsBlocked(!permission.canAskAgain);
    }
  }, [onDone]);

  // Check when the screen opens, and again when the user comes back from Settings
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
    const result = await requestLocationPermission();
    setIsAsking(false);
    if (result === 'granted') {
      onDone();
    } else {
      await checkPermission();
    }
  };

  const handleOpenSettings = () => {
    Linking.openSettings();
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
        <Pressable
          style={({ pressed }) => [styles.primaryButton, (pressed || isAsking) && styles.pressed]}
          onPress={isBlocked ? handleOpenSettings : handleAllow}
          disabled={isAsking}
        >
          <Text style={styles.primaryButtonText}>
            {isBlocked ? 'Open Settings' : 'Allow location'}
          </Text>
        </Pressable>

        {/* Skipping is allowed: no location data is collected without permission */}
        <Pressable style={styles.secondaryButton} onPress={onDone} hitSlop={8}>
          <Text style={styles.secondaryButtonText}>
            {isBlocked ? 'Continue without location' : 'Not now'}
          </Text>
        </Pressable>
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
  primaryButton: {
    backgroundColor: colors.spotifyGreen,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 18,
    color: colors.text,
  },
  secondaryButton: {
    marginTop: 16,
    padding: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});