import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, getGenreColor, getReadableTextColor } from '../theme';
import { supabase } from '../lib/supabase';
import type { MapPlace } from '../data/mockData';
import { FriendMapUnavailableError, fetchFriendMapPlaces } from '../services/FriendMapService';
import { getPresentGenreFamilies, getTopGenre, getTotalPlays } from '../utils/placeStats';
import SongCardScreen from './SongCardScreen';

// What happened when loading a friend's map.
// "unavailable" covers both a private map and not being friends. The backend
// treats them the same on purpose, so the app doesn't reveal which one it is.
type FriendMapResult =
  | { status: 'ok'; places: MapPlace[] }
  | { status: 'unavailable' }
  | { status: 'empty' }
  | { status: 'error'; message: string };

// TEMPORARY: set this to test each message, for example { status: 'unavailable' }.
// Leave as null for normal use.
const PREVIEW_RESULT: FriendMapResult | null = null;

// Loads a friend's map with Jennie's FriendMapService and turns the answer
// into one of the results above.
async function loadFriendMap(friendId: string): Promise<FriendMapResult> {
  if (PREVIEW_RESULT) {
    return PREVIEW_RESULT;
  }

  try {
    const places = await fetchFriendMapPlaces(supabase, friendId);
    return places.length > 0 ? { status: 'ok', places } : { status: 'empty' };
  } catch (error) {
    if (error instanceof FriendMapUnavailableError) {
      return { status: 'unavailable' };
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Something went wrong.',
    };
  }
}

type Props = {
  friendId: string;
  friendName: string;
  onBack: () => void;
};

type LoadState = 'loading' | FriendMapResult['status'];

// Starting view: centered on the UW campus
const UW_REGION: Region = {
  latitude: 47.6545,
  longitude: -122.307,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

// Shows a friend's listening map, opened from View Map on the Friends screen.
// Reuses the Map's markers and the Song Card, but is read-only.
export default function FriendMapScreen({ friendId, friendName, onBack }: Props) {
  const mapRef = useRef<MapView>(null);
  const isMountedRef = useRef(true);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [isCardExpanded, setIsCardExpanded] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);

  const animateCard = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const loadPlaces = useCallback(async () => {
    setLoadState('loading');
    const result = await loadFriendMap(friendId);

    if (!isMountedRef.current) {
      return;
    }

    if (result.status === 'ok') {
      setPlaces(result.places);
    } else {
      setPlaces([]);
      setSelectedPlace(null);
      if (result.status === 'error') {
        console.warn('Friend map failed to load:', result.message);
      }
    }
    setLoadState(result.status);
  }, [friendId]);

  useEffect(() => {
    isMountedRef.current = true;
    void loadPlaces();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadPlaces]);

  // Zoom the map so all of the friend's places fit on screen
  useEffect(() => {
    if (!isMapReady || places.length === 0) {
      return;
    }

    const coordinates = places.map(({ latitude, longitude }) => ({ latitude, longitude }));
    const first = coordinates[0];
    const allAtSameCoordinate = coordinates.every(
      ({ latitude, longitude }) => latitude === first.latitude && longitude === first.longitude,
    );

    if (coordinates.length === 1 || allAtSameCoordinate) {
      mapRef.current?.animateToRegion(
        { ...first, latitudeDelta: 0.012, longitudeDelta: 0.012 },
        350,
      );
      return;
    }

    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: 160, right: 60, bottom: 320, left: 60 },
      animated: true,
    });
  }, [isMapReady, places]);

  const presentGenres = getPresentGenreFamilies(places);

  // The message to show when the map can't be shown
  let message: { title: string; body: string; canRetry: boolean } | null = null;
  if (loadState === 'unavailable') {
    message = {
      title: 'This map isn’t available',
      body: 'You can only see a friend’s map if you’re friends and they’ve chosen to share it with friends.',
      canRetry: false,
    };
  } else if (loadState === 'empty') {
    message = {
      title: 'No listening data yet',
      body: `${friendName} hasn’t listened to music on SpotiMaps in the last 7 days. Check back later.`,
      canRetry: false,
    };
  } else if (loadState === 'error') {
    message = {
      title: `Couldn’t load ${friendName}'s map`,
      body: 'Something went wrong. Please try again.',
      canRetry: true,
    };
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={UW_REGION}
        onMapReady={() => setIsMapReady(true)}
      >
        {places.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            onPress={() => {
              animateCard();
              setSelectedPlace(place);
              setIsCardExpanded(true);
            }}
          >
            <View
              style={[styles.bubble, { backgroundColor: getGenreColor(getTopGenre(place)) }]}
              accessible
              accessibilityLabel={`${place.name}, ${getTotalPlays(place)} plays, mostly ${getTopGenre(place) ?? 'unknown genre'}`}
            >
              <Text
                style={[
                  styles.bubbleText,
                  { color: getReadableTextColor(getGenreColor(getTopGenre(place))) },
                ]}
              >
                {getTotalPlays(place)}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Back button, title, and genre legend */}
      <SafeAreaView edges={['top']} style={styles.header} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Back to Friends"
          >
            <Text style={styles.backText}>‹ Friends</Text>
          </Pressable>
          <View style={styles.titlePill}>
            <Text style={styles.titleText}>{friendName}'s map</Text>
          </View>
        </View>

        {presentGenres.length > 0 ? (
          <View style={styles.legend}>
            {presentGenres.map((genre) => (
              <View key={genre} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: getGenreColor(genre) }]} />
                <Text style={styles.legendText}>{genre}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </SafeAreaView>

      <View style={styles.bottomSheet} pointerEvents="box-none">
        {loadState === 'loading' && (
          <View style={styles.loadingPill}>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.loadingText}>Loading {friendName}'s map…</Text>
          </View>
        )}

        {message && (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>{message.title}</Text>
            <Text style={styles.statusBody}>{message.body}</Text>
            {message.canRetry && (
              <Pressable
                onPress={() => void loadPlaces()}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            )}
          </View>
        )}

        {loadState === 'ok' && selectedPlace && (
          <SongCardScreen
            place={selectedPlace}
            isExpanded={isCardExpanded}
            onToggle={() => {
              animateCard();
              setIsCardExpanded(!isCardExpanded);
            }}
            onClose={() => {
              animateCard();
              setSelectedPlace(null);
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    opacity: 0.9,
  },
  bubbleText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    marginTop: 8,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  backText: {
    fontSize: 15,
    color: colors.text,
  },
  titlePill: {
    marginTop: 8,
    backgroundColor: 'rgba(50, 52, 62, 0.9)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  legend: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(50, 52, 62, 0.9)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    color: colors.white,
    fontSize: 14,
  },
  bottomSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  loadingPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text,
  },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  statusBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: 6,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: colors.sage,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retryText: {
    fontSize: 14,
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});