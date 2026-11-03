import { useEffect, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, genreColors, getGenreColor } from '../theme';
import { mockPlaces, type MapPlace } from '../data/mockData';
import { fetchMapPlaces } from '../services/MapDataService';
import { getTopGenre, getTotalPlays } from '../utils/placeStats';
import SongCardScreen from './SongCardScreen';

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
  const [places, setPlaces] = useState<MapPlace[]>(mockPlaces);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(mockPlaces[0] ?? null);
  const [isCardExpanded, setIsCardExpanded] = useState(true);

  // Makes the card slide smoothly instead of jumping
  const animateCard = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadPlaces() {
      const nextPlaces = await fetchMapPlaces();

      if (!isMounted) {
        return;
      }

      setPlaces(nextPlaces);
      setSelectedPlace((current) => current ?? nextPlaces[0] ?? null);
    }

    void loadPlaces();

    return () => {
      isMounted = false;
    };
  }, []);

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

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={UW_REGION}
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
        <View style={styles.legend}>
          {Object.entries(genreColors).map(([genre, color]) => (
            <View key={genre} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{genre}</Text>
            </View>
          ))}
        </View>

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
});