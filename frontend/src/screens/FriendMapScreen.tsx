import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, getGenreColor } from '../theme';
import { supabase } from '../lib/supabase';
import type { MapPlace } from '../data/mockData';
import { FriendMapUnavailableError, fetchFriendMapPlaces } from '../services/FriendMapService';
import { getTopGenre, getTotalPlays } from '../utils/placeStats';
import SongCardScreen from './SongCardScreen';


type FriendMapResult =
  | { status: 'ok'; places: MapPlace[] }
  | { status: 'unavailable' }
  | { status: 'empty' }
  | { status: 'error'; message: string };

const PREVIEW_RESULT: FriendMapResult | null = null;


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


export default function FriendMapScreen({ friendId, friendName, onBack }: Props) {
  const isMountedRef = useRef(true);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [isCardExpanded, setIsCardExpanded] = useState(true);

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
      <MapView style={StyleSheet.absoluteFill} initialRegion={UW_REGION}>
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
            <View style={[styles.bubble, { backgroundColor: getGenreColor(getTopGenre(place)) }]}>
              <Text style={styles.bubbleText}>{getTotalPlays(place)}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Back button and title */}
      <SafeAreaView edges={['top']} style={styles.header} pointerEvents="box-none">
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
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
    backgroundColor: 'rgba(105, 109, 125, 0.8)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
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