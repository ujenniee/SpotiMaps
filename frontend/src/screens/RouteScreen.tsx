import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline, type Region } from 'react-native-maps';
import { colors, getGenreColor } from '../theme';
import { startOnTheGoSession, endOnTheGoSession, getActiveOnTheGoSession,}
from '../services/OnTheGoService';
import type { GPSReading } from '../services/LocationService';
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
  userId: string | null;
  isTracking: boolean;
  isSettingsLoading: boolean;
  trackingStatus: string | null;
  onTrackingChange: (enabled: boolean) => Promise<void>;
};

export default function RouteScreen({
  userId,
  isTracking,
  isSettingsLoading,
  trackingStatus,
  onTrackingChange,
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTripActive, setIsTripActive] = useState(false);
  const [isTripLoading, setIsTripLoading] = useState(true);
  const [routeReadings, setRouteReadings] = useState<GPSReading[]>([]);
  useEffect(() => {
    let cancelled = false;

    setIsTripLoading(true);
    setIsTripActive(false);

    const loadActiveTrip = async () => {
      if (!userId) {
        if (!cancelled) setIsTripLoading(false);
        return;
      }

      try {
        const session = await getActiveOnTheGoSession(userId);

        if (!cancelled) {
          setIsTripActive(session !== null);
          setRouteReadings(session?.readings ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load your trip.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsTripLoading(false);
        }
      }
    };

    void loadActiveTrip();

    return () => {
      cancelled = true;
    };
  }, [userId]);
  useEffect(() => {
    if (!userId || !isTripActive) {
      return;
    }

    let cancelled = false;

    const refreshRoute = async () => {
      try {
        const session = await getActiveOnTheGoSession(userId);

        if (!cancelled && session) {
          setRouteReadings(session.readings);
        }
      } catch (error) {
        console.error('Could not refresh On-the-Go route:', error);
      }
    };

    void refreshRoute();

    const interval = setInterval(() => {
      void refreshRoute();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId, isTripActive]);

  const toggleTracking = async () => {
    if (isSaving || isTripLoading || isSettingsLoading || !userId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (isTripActive) {
        const completedTrip = await endOnTheGoSession(userId);

        setIsTripActive(false);
        setRouteReadings(completedTrip.readings);

        console.log(
          `Trip completed with ${completedTrip.readings.length} GPS readings.`
        );
      } else {
        if (!isTracking) {
          throw new Error(
            'Enable location tracking in Settings before starting a trip.'
          );
        }

        await startOnTheGoSession(userId);

        setRouteReadings([]);
        setIsTripActive(true);

        console.log('On-the-Go trip started.');
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not update your trip.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
<MapView
  style={StyleSheet.absoluteFill}
  initialRegion={ROUTE_REGION}
  showsUserLocation
  followsUserLocation
>
  {routeReadings.length >= 2 && (
    <Polyline
      coordinates={routeReadings.map((reading) => ({
        latitude: reading.latitude,
        longitude: reading.longitude,
      }))}
      strokeColor={colors.spotifyGreen}
      strokeWidth={5}
    />
  )}
</MapView>

      <View style={styles.bottomArea} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [
            styles.trackButton,
            isTripActive && styles.trackButtonActive,
            pressed && styles.pressed,
            (isSettingsLoading || isSaving || isTripLoading || !userId) && styles.disabled,
          ]}
          onPress={() => void toggleTracking()}
          disabled={isSettingsLoading || isSaving || isTripLoading || !userId}
          accessibilityRole="button"
          accessibilityState={{
            disabled: isSettingsLoading || isSaving || isTripLoading || !userId,
          }}
        >
          <Text
            style={[
              styles.trackButtonText,
              isTripActive && styles.trackButtonTextActive,
            ]}
          >
            {isSaving || isTripLoading
              ? 'Loading…'
              : isTripActive
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