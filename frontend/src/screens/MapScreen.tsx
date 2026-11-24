import { useEffect, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, getGenreColor } from '../theme';
import { supabase } from '../lib/supabase';
import type { MapPlace } from '../data/mockData';
import { fetchMapPlaces } from '../services/MapDataService';
import { getPresentGenreFamilies, getTopGenre, getTotalPlays } from '../utils/placeStats';
import SongCardScreen from './SongCardScreen';

// Starting view: centered on the UW campus
const UW_REGION: Region = {
  latitude: 47.6545,
  longitude: -122.307,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

type Props = {
  refreshVersion?: number;
  syncError?: string | null;
  onReconnectSpotify?: () => void;
  isReconnectingSpotify?: boolean;
};

export default function MapScreen({
  refreshVersion = 0,
  syncError = null,
  onReconnectSpotify,
  isReconnectingSpotify = false,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(UW_REGION);
  const isMountedRef = useRef(false);
  const isLoadingPlacesRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const mountVersionRef = useRef(0);
  const hasSelectedInitialPlaceRef = useRef(false);
  const hasFitInitialPlacesRef = useRef(false);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [isCardExpanded, setIsCardExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Makes the card slide smoothly instead of jumping
  const animateCard = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      pendingRefreshRef.current = false;
      mountVersionRef.current += 1;
    };
  }, []);

  useEffect(() => {
    pendingRefreshRef.current = true;
    if (isLoadingPlacesRef.current) {
      return;
    }

    async function loadPlaces() {
      isLoadingPlacesRef.current = true;
      // Coalesce refreshes that arrive during a request into one follow-up load.
      while (isMountedRef.current && pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        const mountVersion = mountVersionRef.current;
        try {
          const nextPlaces = await fetchMapPlaces(supabase);
          if (isMountedRef.current && mountVersion === mountVersionRef.current) {
            const selectInitialPlace = !hasSelectedInitialPlaceRef.current && nextPlaces.length > 0;
            if (selectInitialPlace) {
              hasSelectedInitialPlaceRef.current = true;
            }
            setPlaces(nextPlaces);
            setSelectedPlace((current) => selectInitialPlace
              ? nextPlaces[0]
              : nextPlaces.find((place) => place.id === current?.id) ?? null);
            setLoadError(null);
          }
        } catch (error) {
          if (isMountedRef.current && mountVersion === mountVersionRef.current) {
            setLoadError(error instanceof Error ? error.message : 'Could not load map data.');
          }
        } finally {
          if (isMountedRef.current && mountVersion === mountVersionRef.current) {
            setIsLoading(false);
          }
        }
      }
      isLoadingPlacesRef.current = false;
    }

    void loadPlaces();
  }, [refreshVersion]);

  useEffect(() => {
    if (hasFitInitialPlacesRef.current || !isMapReady || isLoading || places.length === 0) {
      return;
    }
    hasFitInitialPlacesRef.current = true;

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
  const presentGenres = getPresentGenreFamilies(places);

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
            <View style={[styles.bubble, { backgroundColor: getGenreColor(getTopGenre(place)) }]}>
              <Text style={styles.bubbleText}>{getTotalPlays(place)}</Text>
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
        ) : null}

        <View style={styles.zoomButtons}>
          <Pressable style={styles.zoomButton} onPress={() => zoom(0.5)} accessibilityLabel="Zoom in">
            <Text style={styles.zoomText}>+</Text>
          </Pressable>
          <View style={styles.zoomDivider} />
          <Pressable style={styles.zoomButton} onPress={() => zoom(2)} accessibilityLabel="Zoom out">
            <Text style={styles.zoomText}>−</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {isLoading || loadError || syncError || onReconnectSpotify || places.length === 0 ? (
        <View style={styles.statusBanner} accessibilityRole="summary">
          <Text style={styles.statusText}>
            {syncError || loadError || (isLoading
              ? 'Loading your listening history…'
              : places.length === 0
                ? 'No matched listening data from the last 7 days. Save listening history and GPS samples to see places here.'
                : 'Reconnect Spotify to import your recent listening history.')}
          </Text>
          {onReconnectSpotify ? (
            <Pressable
              onPress={onReconnectSpotify}
              disabled={isReconnectingSpotify}
              style={styles.reconnectButton}
              accessibilityRole="button"
            >
              <Text style={styles.reconnectText}>
                {isReconnectingSpotify ? 'Connecting…' : 'Reconnect Spotify'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {selectedPlace ? (
        <View style={styles.bottomSheet}>
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
        </View>
      ) : null}
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
    backgroundColor: 'rgba(105, 109, 125, 0.7)',
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
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: colors.white,
    fontSize: 12,
  },
  zoomButtons: {
    marginTop: 8,
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
  bottomSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  statusBanner: {
    position: 'absolute',
    top: 72,
    left: 20,
    right: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.white,
    elevation: 3,
  },
  statusText: {
    color: colors.text,
    fontSize: 13,
    textAlign: 'center',
  },
  reconnectButton: {
    alignSelf: 'center',
    marginTop: 8,
    borderRadius: 6,
    backgroundColor: colors.sage,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reconnectText: {
    color: colors.text,
    fontSize: 13,
  },
});
