import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, getGenreColor, getGenreFamily, getReadableTextColor } from '../theme';
import { supabase } from '../lib/supabase';
import type { MapPlace } from '../data/mockData';
import { fetchMapPlaces } from '../services/MapDataService';
import { getTopGenre, getTotalPlays } from '../utils/placeStats';
import SongCardScreen from './SongCardScreen';
import MapShareModal from '../components/MapShareModal';

const UW_REGION: Region = {
  latitude: 47.6545,
  longitude: -122.307,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};
function getListenedGenreFamilies(places: MapPlace[]): string[] {
  const playsByGenre = new Map<string, number>();
  places.forEach((place) => {
    place.songs.forEach((song) => {
      const family = getGenreFamily(song.genre);
      playsByGenre.set(family, (playsByGenre.get(family) ?? 0) + song.plays);
    });
  });
  return [...playsByGenre.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre);
}
export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(UW_REGION);
  const isMountedRef = useRef(true);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [isCardExpanded, setIsCardExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);

  // Makes the card slide smoothly instead of jumping
  const animateCard = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  // Loads the user's places. Also used by the Try again button.
  const loadPlaces = useCallback(async () => {
    setIsLoading(true);
    setHasLoadError(false);
    try {
      const nextPlaces = await fetchMapPlaces(supabase);
      if (isMountedRef.current) {
        setPlaces(nextPlaces);
        // The Song Card only opens when the user taps a marker
        setSelectedPlace(null);
      }
    } catch (error) {
      console.warn('Could not load map data:', error);
      if (isMountedRef.current) {
        setHasLoadError(true);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadPlaces();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadPlaces]);

  useEffect(() => {
    if (!isMapReady || isLoading || places.length === 0) {
      return;
    }

    const coordinates = places.map(({ latitude, longitude }) => ({ latitude, longitude }));
    const first = coordinates[0];
    const allAtSameCoordinate = coordinates.every(
      ({ latitude, longitude }) => latitude === first.latitude && longitude === first.longitude,
    );

    if (coordinates.length === 1 || allAtSameCoordinate) {
      mapRef.current?.animateToRegion(
        {
          ...first,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        350,
      );
      return;
    }

    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: 120, right: 60, bottom: 320, left: 60 },
      animated: true,
    });
  }, [isMapReady, isLoading, places]);

  const zoom = (factor: number) => {
    const region = regionRef.current;
    mapRef.current?.animateToRegion(
      {
        ...region,
        latitudeDelta: region.latitudeDelta * factor,
        longitudeDelta: region.longitudeDelta * factor,
      },
      250,
    );
  };

  const presentGenres = getListenedGenreFamilies(places);
  const isEmpty = !isLoading && !hasLoadError && places.length === 0;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={UW_REGION}
        onMapReady={() => setIsMapReady(true)}
        showsUserLocation
        onRegionChangeComplete={(region) => {
          regionRef.current = region;
        }}
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

      <SafeAreaView edges={['top']} style={styles.overlay} pointerEvents="box-none">
        {presentGenres.length > 0 ? (
          <View style={styles.legend}>
            {presentGenres.map((genre) => (
              <View key={genre} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: getGenreColor(genre) }]} />
                <Text style={styles.legendText}>{genre}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View />
        )}

        <View style={styles.mapControls}>
          <View style={styles.zoomButtons}>
            <Pressable style={styles.zoomButton} onPress={() => zoom(0.5)} accessibilityLabel="Zoom in">
              <Text style={styles.zoomText}>+</Text>
            </Pressable>
            <View style={styles.zoomDivider} />
            <Pressable style={styles.zoomButton} onPress={() => zoom(2)} accessibilityLabel="Zoom out">
              <Text style={styles.zoomText}>−</Text>
            </Pressable>
          </View>
          {places.length > 0 && (
            <Pressable
              onPress={() => setIsShareModalVisible(true)}
              style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Create a shareable image of your map"
            >
              <MaterialCommunityIcons name="share-variant" size={17} color={colors.text} />
              <Text style={styles.shareButtonText}>Share map</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      <View style={styles.bottomSheet} pointerEvents="box-none">
        {isLoading ? (
          <View style={styles.loadingPill}>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.loadingText}>Loading your map…</Text>
          </View>
        ) : null}

        {hasLoadError ? (
          <View style={styles.statusCard} accessibilityRole="alert">
            <Text style={styles.statusTitle}>Couldn’t load your map</Text>
            <Text style={styles.statusBody}>
              Something went wrong loading your listening history. Please try again.
            </Text>
            <Pressable
              onPress={() => void loadPlaces()}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {isEmpty ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Keep listening to build your map!</Text>
            <Text style={styles.statusBody}>
              Places show up here after you listen to music with location tracking on. Your map
              shows the last 7 days.
            </Text>
          </View>
        ) : null}

        {selectedPlace ? (
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
        ) : null}
      </View>

      <MapShareModal
        visible={isShareModalVisible}
        places={places}
        initialPlaceId={selectedPlace?.id ?? null}
        onClose={() => setIsShareModalVisible(false)}
      />
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
  },
  legend: {
    marginTop: 8,
    backgroundColor: 'rgba(50, 52, 62, 0.9)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  mapControls: {
    alignItems: 'flex-end',
    marginTop: 8,
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
  zoomButtons: {
    backgroundColor: colors.white,
    borderRadius: 6,
    overflow: 'hidden',
  },
  zoomButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    fontSize: 20,
    color: colors.text,
  },
  zoomDivider: {
    height: 1,
    backgroundColor: colors.input,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.white,
    elevation: 3,
  },
  shareButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
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
});