import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline, type Region } from 'react-native-maps';
import { colors, getGenreColor } from '../theme';

type RouteSegment = {
  id: string;
  song: string;
  genre: string | null;
  coordinates: { latitude: number; longitude: number }[];
};

const ROUTE: RouteSegment[] = [
  {
    id: 'seg-1',
    song: 'Snooze',
    genre: 'R&B',
    coordinates: [
      { latitude: 47.6575, longitude: -122.308 },
      { latitude: 47.6568, longitude: -122.307 },
      { latitude: 47.656, longitude: -122.3062 },
      { latitude: 47.6555, longitude: -122.3062 },
    ],
  },
  {
    id: 'seg-2',
    song: 'NOKIA',
    genre: 'Hip Hop',
    coordinates: [
      { latitude: 47.6555, longitude: -122.3062 },
      { latitude: 47.6548, longitude: -122.3068 },
      { latitude: 47.654, longitude: -122.3066 },
      { latitude: 47.6535, longitude: -122.306 },
    ],
  },
  {
    id: 'seg-3',
    song: 'Promise',
    genre: 'Jazz',
    coordinates: [
      { latitude: 47.6535, longitude: -122.306 },
      { latitude: 47.653, longitude: -122.3055 },
      { latitude: 47.6527, longitude: -122.3046 },
    ],
  },
];

const ROUTE_REGION: Region = {
  latitude: 47.655,
  longitude: -122.3062,
  latitudeDelta: 0.009,
  longitudeDelta: 0.009,
};

type Props = {
  isTracking: boolean;
  isSettingsLoading: boolean;
  trackingStatus: string | null;
  onTrackingChange: (enabled: boolean) => Promise<void>;
};

export default function RouteScreen({
  isTracking,
  isSettingsLoading,
  trackingStatus,
  onTrackingChange,
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTracking = async () => {
    if (isSaving || isSettingsLoading) return;

    setIsSaving(true);
    setError(null);
    try {
      await onTrackingChange(!isTracking);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update tracking.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={ROUTE_REGION} showsUserLocation>
        {ROUTE.map((segment) => (
          <Polyline
            key={segment.id}
            coordinates={segment.coordinates}
            strokeColor={getGenreColor(segment.genre)}
            strokeWidth={5}
          />
        ))}
      </MapView>

      <View style={styles.bottomArea} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [
            styles.trackButton,
            isTracking && styles.trackButtonActive,
            pressed && styles.pressed,
            (isSettingsLoading || isSaving) && styles.disabled,
          ]}
          onPress={() => void toggleTracking()}
          disabled={isSettingsLoading || isSaving}
          accessibilityRole="button"
          accessibilityState={{ disabled: isSettingsLoading || isSaving }}
        >
          <Text style={[styles.trackButtonText, isTracking && styles.trackButtonTextActive]}>
            {isSaving
              ? 'Saving…'
              : isTracking
                ? 'End Tracking'
                : 'Start Tracking'}
          </Text>
        </Pressable>
        {error || trackingStatus ? (
          <Text style={styles.statusText}>{error ?? trackingStatus}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
  },
  trackButton: {
    backgroundColor: colors.spotifyGreen,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 999,
  },
  trackButtonActive: {
    backgroundColor: colors.error,
  },
  trackButtonText: {
    fontSize: 18,
    color: colors.text,
  },
  trackButtonTextActive: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  statusText: {
    marginTop: 8,
    marginHorizontal: 20,
    padding: 8,
    borderRadius: 6,
    color: colors.error,
    backgroundColor: colors.white,
    textAlign: 'center',
  },
});