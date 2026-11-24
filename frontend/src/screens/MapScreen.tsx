import { useEffect, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, getGenreColor } from '../theme';
import { supabase } from '../lib/supabase';
import type { MapPlace } from '../data/mockData';
import { fetchMapPlaces } from '../services/MapDataService';
import { getMarkerGenreFamilies, getTopGenre, getTotalPlays } from '../utils/placeStats';
import SongCardScreen from './SongCardScreen';
import MapShareModal from '../components/MapShareModal';

// Starting view: centered on the UW campus
const UW_REGION: Region = {
  latitude: 47.6545,
  longitude: -122.307,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(UW_REGION);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [isCardExpanded, setIsCardExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);

  // Makes the card slide smoothly instead of jumping
  const animateCard = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadPlaces() {
      try {
        const nextPlaces = await fetchMapPlaces(supabase);
        if (isMounted) {
          setPlaces(nextPlaces);
          setSelectedPlace(nextPlaces[0] ?? null);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : 'Could not load map data.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPlaces();

    return () => {
      isMounted = false;
    };
  }, []);

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
  const presentGenres = getMarkerGenreFamilies(places);

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

      {isLoading || loadError || places.length === 0 ? (
        <View style={styles.statusBanner} accessibilityRole="summary">
          <Text style={styles.statusText}>
            {isLoading
              ? 'Loading your listening history…'
              : loadError
                ? loadError
                : 'No matched listening data from the last 7 days. Save listening history and GPS samples to see places here.'}
          </Text>
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
    backgroundColor: 'rgba(105, 109, 125, 0.7)',
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
});