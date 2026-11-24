import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import MapView from 'react-native-maps';
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot';
import type { MapPlace } from '../data/mockData';
import { colors, getGenreColor } from '../theme';
import { getTopGenre, getTotalPlays } from '../utils/placeStats';
import {
  getMapExportGenres,
  getMapExportMarkerPosition,
  getMapExportRegion,
  getMapExportSongs,
} from '../utils/mapExport';
import { STORY_SHARE_FORMAT } from '../utils/mapShareFormat';

type Props = {
  visible: boolean;
  places: MapPlace[];
  initialPlaceId: string | null;
  onClose: () => void;
};

type ExportLayout = 'map' | 'selected' | 'place';

const MAP_READY_FALLBACK_MS = 6000;
const MAP_READY_TIMEOUT_MS = 10000;
const MAP_SNAPSHOT_TIMEOUT_MS = 12000;
const MAX_CACHED_MAP_SNAPSHOTS = 4;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : fallback;
}

function ModalSafeAreaView({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.screen}>
        {children}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function MapShareModal({ visible, places, initialPlaceId, onClose }: Props) {
  const captureViewRef = useRef<ViewShotRef | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const activeMapKeyRef = useRef('');
  const snapshotRequestsRef = useRef(new Set<string>());
  const [layout, setLayout] = useState<ExportLayout>('map');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(initialPlaceId);
  const [selectedSpotIds, setSelectedSpotIds] = useState<string[]>(() => places.map(({ id }) => id));
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [mapReadyKey, setMapReadyKey] = useState<string | null>(null);
  const [mapSnapshots, setMapSnapshots] = useState<Record<string, string>>({});
  const [snapshotImageReadyKey, setSnapshotImageReadyKey] = useState<string | null>(null);
  const [mapSnapshotError, setMapSnapshotError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { width: windowWidth } = useWindowDimensions();
  const artworkScale = Math.max(0.1, Math.min(1, (windowWidth - 40) / STORY_SHARE_FORMAT.artworkWidth));

  useEffect(() => {
    if (visible) {
      setLayout('map');
      setSelectedPlaceId(initialPlaceId ?? places[0]?.id ?? null);
      setSelectedSpotIds(places.map(({ id }) => id));
      setMessage('');
      setError('');
    }
  }, [initialPlaceId, places, visible]);

  const selectedPlace = places.find((place) => place.id === selectedPlaceId) ?? null;
  const selectedPlaces = places.filter((place) => selectedSpotIds.includes(place.id));
  const visiblePlaces = useMemo(
    () => {
      if (layout === 'place') {
        return selectedPlace ? [selectedPlace] : [];
      }
      return layout === 'selected' ? selectedPlaces : places;
    },
    [layout, places, selectedPlace, selectedPlaces],
  );
  const mapAspectRatio = STORY_SHARE_FORMAT.mapWidth / STORY_SHARE_FORMAT.mapHeight;
  const mapKey = JSON.stringify(visiblePlaces.map((place) => ({
    id: place.id,
    latitude: place.latitude,
    longitude: place.longitude,
    genre: getTopGenre(place),
    plays: getTotalPlays(place),
  })));
  activeMapKeyRef.current = mapKey;
  const mapRegion = useMemo(
    () => getMapExportRegion(visiblePlaces, mapAspectRatio),
    [mapAspectRatio, visiblePlaces],
  );
  const mapSnapshotUri = mapSnapshots[mapKey] ?? null;
  const songs = layout === 'place'
    ? selectedPlace ? getMapExportSongs(places, selectedPlace.id) : []
    : getMapExportSongs(visiblePlaces);
  const genres = getMapExportGenres(visiblePlaces, songs);
  const missingAndroidMapsKey = Platform.OS === 'android'
    && Constants.expoConfig?.extra?.androidGoogleMapsApiKeyConfigured === false;
  const mapConfigurationError = missingAndroidMapsKey
    ? 'Android map images need ANDROID_GOOGLE_MAPS_API_KEY in the build environment.'
    : '';
  const isMapReady = mapReadyKey === mapKey;
  const isMapImageReady = Boolean(mapSnapshotUri) && snapshotImageReadyKey === mapKey;
  const canExport = !isSaving
    && !isSharing
    && visiblePlaces.length > 0
    && isMapImageReady
    && !mapConfigurationError;

  useEffect(() => {
    setMapSnapshotError('');
  }, [mapKey]);

  const captureNativeMapSnapshot = useCallback(async (
    targetKey: string,
    region: ReturnType<typeof getMapExportRegion>,
  ) => {
    if (mapSnapshots[targetKey] || snapshotRequestsRef.current.has(targetKey)) {
      return;
    }

    const map = mapRef.current;
    if (!map) {
      if (activeMapKeyRef.current === targetKey) {
        setMapSnapshotError('The native map is not ready yet.');
      }
      return;
    }

    snapshotRequestsRef.current.add(targetKey);
    if (activeMapKeyRef.current === targetKey) {
      setMapSnapshotError('');
    }

    try {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const nativeMapUri = await Promise.race([
        map.takeSnapshot({
          width: STORY_SHARE_FORMAT.mapWidth,
          height: STORY_SHARE_FORMAT.mapHeight,
          ...(Platform.OS === 'ios' ? { region } : {}),
          format: 'png',
          quality: 1,
          result: 'file',
        }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('The map image is taking too long. Check your connection and try again.')),
            MAP_SNAPSHOT_TIMEOUT_MS,
          );
        }),
      ]).finally(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
      if (!nativeMapUri) {
        throw new Error('Could not create a native map snapshot.');
      }
      setMapSnapshots((current) => {
        if (current[targetKey]) {
          return current;
        }
        const next = { ...current, [targetKey]: nativeMapUri };
        while (Object.keys(next).length > MAX_CACHED_MAP_SNAPSHOTS) {
          delete next[Object.keys(next)[0]];
        }
        return next;
      });
    } catch (snapshotError) {
      if (activeMapKeyRef.current === targetKey) {
        setMapSnapshotError(getErrorMessage(snapshotError, 'Could not create the map image.'));
      }
    } finally {
      snapshotRequestsRef.current.delete(targetKey);
    }
  }, [mapSnapshots]);

  useEffect(() => {
    if (!visible || !visiblePlaces.length || mapConfigurationError || mapSnapshotUri || mapSnapshotError) {
      return undefined;
    }

    const isMapReady = mapReadyKey === mapKey;
    if (isMapReady && Platform.OS === 'ios') {
      return undefined;
    }

    const timeout = setTimeout(() => {
      if (activeMapKeyRef.current !== mapKey) {
        return;
      }
      if (!isMapReady) {
        setMapSnapshotError('The native map did not finish starting. Check your connection and try again.');
      } else if (Platform.OS !== 'ios') {
        void captureNativeMapSnapshot(mapKey, mapRegion);
      }
    }, isMapReady ? MAP_READY_FALLBACK_MS : MAP_READY_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [
    captureNativeMapSnapshot,
    mapConfigurationError,
    mapKey,
    mapRegion,
    mapReadyKey,
    mapSnapshotError,
    mapSnapshotUri,
    visible,
    visiblePlaces.length,
  ]);

  const makeImage = async (): Promise<string> => {
    if (!captureViewRef.current) {
      throw new Error('The map image is not ready yet. Please try again.');
    }
    if (!isMapImageReady) {
      throw new Error('The map image is still being prepared. Please wait.');
    }

    return captureRef(captureViewRef.current, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      width: STORY_SHARE_FORMAT.width,
      height: STORY_SHARE_FORMAT.height,
    });
  };

  const saveImage = async () => {
    setIsSaving(true);
    setMessage('');
    setError('');
    try {
      const imageUri = await makeImage();
      const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (!permission.granted) {
        throw new Error('Allow photo access to save your map image.');
      }
      await MediaLibrary.saveToLibraryAsync(imageUri);
      setMessage('Saved to your photo library.');
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Could not save the map image.'));
    } finally {
      setIsSaving(false);
    }
  };

  const shareImage = async () => {
    setIsSharing(true);
    setMessage('');
    setError('');
    try {
      const imageUri = await makeImage();
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device.');
      }
      await Sharing.shareAsync(imageUri, {
        dialogTitle: 'Share your SpotiMaps image',
        mimeType: 'image/png',
        UTI: 'public.png',
      });
      setMessage('Your map image is ready to share.');
    } catch (shareError) {
      setError(getErrorMessage(shareError, 'Could not share the map image.'));
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ModalSafeAreaView>
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close map export"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <Text style={styles.screenTitle}>Share your map</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.layoutSwitch}>
            <Pressable
              onPress={() => {
                setLayout('map');
                setMessage('');
                setError('');
              }}
              disabled={isSaving || isSharing}
              style={[styles.layoutOption, layout === 'map' && styles.layoutOptionActive]}
              accessibilityRole="button"
              accessibilityLabel="Whole map"
              accessibilityState={{ selected: layout === 'map' }}
            >
              <Text style={[styles.layoutOptionText, layout === 'map' && styles.layoutOptionTextActive]}>
                Whole map
              </Text>
            </Pressable>
            {places.length > 1 && (
              <Pressable
                onPress={() => {
                  setLayout('selected');
                  setMessage('');
                  setError('');
                }}
                disabled={isSaving || isSharing}
                style={[styles.layoutOption, layout === 'selected' && styles.layoutOptionActive]}
                accessibilityRole="button"
                accessibilityLabel="Selected spots"
                accessibilityState={{ selected: layout === 'selected' }}
              >
                <Text style={[styles.layoutOptionText, layout === 'selected' && styles.layoutOptionTextActive]}>
                  Selected spots
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                setLayout('place');
                setMessage('');
                setError('');
              }}
              disabled={isSaving || isSharing}
              style={[styles.layoutOption, layout === 'place' && styles.layoutOptionActive]}
              accessibilityRole="button"
              accessibilityLabel="One place"
              accessibilityState={{ selected: layout === 'place' }}
            >
              <Text style={[styles.layoutOptionText, layout === 'place' && styles.layoutOptionTextActive]}>
                One place
              </Text>
            </Pressable>
          </View>

          {layout === 'place' && places.length > 1 && (
            <View style={styles.placeChoices}>
              {places.map((place) => (
                <Pressable
                  key={place.id}
                  onPress={() => {
                    setSelectedPlaceId(place.id);
                    setMessage('');
                    setError('');
                  }}
                  disabled={isSaving || isSharing}
                  style={[styles.placeChoice, place.id === selectedPlaceId && styles.placeChoiceActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${place.name}`}
                  accessibilityState={{ selected: place.id === selectedPlaceId }}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.placeChoiceText, place.id === selectedPlaceId && styles.placeChoiceTextActive]}
                  >
                    {place.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {layout === 'selected' && places.length > 1 && (
            <View style={styles.spotPicker}>
              <View style={styles.spotPickerHeader}>
                <Text style={styles.spotPickerTitle}>
                  Choose spots ({selectedPlaces.length}/{places.length})
                </Text>
                <Pressable
                  onPress={() => setSelectedSpotIds(
                    selectedPlaces.length === places.length ? [] : places.map(({ id }) => id),
                  )}
                  disabled={isSaving || isSharing}
                  accessibilityRole="button"
                  accessibilityLabel={selectedPlaces.length === places.length ? 'Clear all spots' : 'Select all spots'}
                >
                  <Text style={styles.spotPickerAction}>
                    {selectedPlaces.length === places.length ? 'Clear all' : 'Select all'}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.spotChoices}>
                {places.map((place) => {
                  const isSelected = selectedSpotIds.includes(place.id);
                  return (
                    <Pressable
                      key={place.id}
                      onPress={() => setSelectedSpotIds((current) => (
                        isSelected
                          ? current.filter((id) => id !== place.id)
                          : [...current, place.id]
                      ))}
                      disabled={isSaving || isSharing}
                      style={[styles.spotChoice, isSelected && styles.spotChoiceActive]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={place.name}
                    >
                      <View style={[styles.spotCheckbox, isSelected && styles.spotCheckboxActive]}>
                        {isSelected ? <Text style={styles.spotCheckmark}>✓</Text> : null}
                      </View>
                      <Text numberOfLines={1} style={styles.spotChoiceText}>{place.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View
            testID="map-share-artwork-preview"
            style={[
              styles.artworkFrame,
              { aspectRatio: STORY_SHARE_FORMAT.width / STORY_SHARE_FORMAT.height },
            ]}
          >
            <ViewShot
              ref={captureViewRef}
              style={[
                styles.artwork,
                { aspectRatio: STORY_SHARE_FORMAT.width / STORY_SHARE_FORMAT.height },
              ]}
            >
              <View
                style={[
                  styles.artworkContent,
                  { transform: [{ scale: artworkScale }] },
                ]}
              >
                <View style={styles.artworkHeader}>
                  <View style={styles.brandPill}>
                    <Text style={styles.brandText}>SPOTIMAPS</Text>
                  </View>
                  <Text style={styles.eyebrow}>YOUR LAST 7 DAYS</Text>
                  <Text style={styles.artworkTitle}>
                    {layout === 'place' && selectedPlace ? 'Every place has a soundtrack.' : 'Your week, mapped.'}
                  </Text>
                  <Text numberOfLines={1} style={styles.artworkSubtitle}>
                    {layout === 'place' && selectedPlace
                      ? `${selectedPlace.name} · ${selectedPlace.area}`
                      : 'Little moments, great music.'}
                  </Text>
                </View>

                <View
                  testID="map-share-map-frame"
                  style={[styles.mapFrame, { aspectRatio: mapAspectRatio }]}
                >
                {!visiblePlaces.length ? (
                  <View style={styles.mapLoading}>
                    <Text style={styles.mapErrorText}>Select at least one spot to preview the map.</Text>
                  </View>
                ) : mapConfigurationError ? (
                  <View style={styles.mapLoading}>
                    <Text style={styles.mapErrorText} accessibilityRole="alert">
                      {mapConfigurationError}
                    </Text>
                  </View>
                ) : mapSnapshotUri ? (
                  <Image
                    testID="map-export-snapshot"
                    source={{ uri: mapSnapshotUri }}
                    style={styles.map}
                    resizeMode="cover"
                    onLoad={() => setSnapshotImageReadyKey(mapKey)}
                    onError={() => {
                      setMapSnapshots((current) => {
                        const next = { ...current };
                        delete next[mapKey];
                        return next;
                      });
                      setSnapshotImageReadyKey(null);
                      setMapReadyKey(null);
                      setMapSnapshotError('Could not load the saved map image. Preparing it again.');
                    }}
                  />
                ) : (
                  <>
                    <MapView
                      key={mapKey}
                      ref={mapRef}
                      testID="map-export-native-preview"
                      style={styles.map}
                      region={mapRegion}
                      mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
                      onMapReady={() => {
                        setMapReadyKey(mapKey);
                        if (Platform.OS === 'ios') {
                          void captureNativeMapSnapshot(mapKey, mapRegion);
                        }
                      }}
                      onMapLoaded={() => {
                        setMapReadyKey(mapKey);
                        void captureNativeMapSnapshot(mapKey, mapRegion);
                      }}
                      pointerEvents="none"
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                      toolbarEnabled={false}
                      showsCompass={false}
                      showsUserLocation={false}
                      showsMyLocationButton={false}
                      moveOnMarkerPress={false}
                    />
                    <View
                      pointerEvents="auto"
                      style={styles.mapLoading}
                      accessibilityLabel="Preparing static map image"
                    >
                      {mapSnapshotError ? (
                        <>
                          <Text style={styles.mapErrorText} accessibilityRole="alert">
                            {mapSnapshotError}
                          </Text>
                          <Pressable
                            onPress={() => void captureNativeMapSnapshot(mapKey, mapRegion)}
                            style={styles.mapRetryButton}
                            accessibilityRole="button"
                            accessibilityLabel="Retry map image"
                          >
                            <Text style={styles.mapRetryText}>Try again</Text>
                          </Pressable>
                        </>
                      ) : (
                        <ActivityIndicator size="small" color={colors.text} />
                      )}
                    </View>
                  </>
                )}
                {mapSnapshotUri && visiblePlaces.length > 0 && !mapConfigurationError && (
                  <View
                    testID="map-export-markers"
                    pointerEvents="none"
                    style={styles.mapMarkerLayer}
                  >
                    {visiblePlaces.map((place) => {
                      const point = getMapExportMarkerPosition(place, mapRegion);
                      return (
                        <View
                          key={place.id}
                          testID={`map-export-marker-${place.id}`}
                          accessibilityLabel={`Listening spot ${place.name}, ${getTotalPlays(place)} plays`}
                          style={[
                            styles.markerPosition,
                            { left: `${point.x * 100}%`, top: `${point.y * 100}%` },
                          ]}
                        >
                          <View
                            style={[
                              styles.marker,
                              { backgroundColor: getGenreColor(getTopGenre(place)) },
                            ]}
                          >
                            <Text style={styles.markerText}>{getTotalPlays(place)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                {visiblePlaces.length > 0 && !mapConfigurationError && (
                  <View pointerEvents="none" style={styles.mapCaption}>
                    <Text style={styles.mapCaptionText}>
                      {layout === 'place'
                        ? 'A favorite listening spot'
                        : `${visiblePlaces.length} listening ${visiblePlaces.length === 1 ? 'spot' : 'spots'}`}
                    </Text>
                  </View>
                )}
              </View>

                <View style={styles.genreRow}>
                  {genres.slice(0, 6).map((genre) => (
                    <View key={genre} style={styles.genreChip}>
                      <View style={[styles.genreDot, { backgroundColor: getGenreColor(genre) }]} />
                      <Text numberOfLines={1} style={styles.genreText}>{genre}</Text>
                    </View>
                  ))}
                  {genres.length > 6 && (
                    <Text style={styles.moreGenres}>+{genres.length - 6}</Text>
                  )}
                </View>

                <View style={styles.songsCard}>
                  <Text style={styles.songsEyebrow}>
                    {layout === 'place' ? 'ON REPEAT HERE' : 'YOUR MAP SOUNDTRACK'}
                  </Text>
                  {songs.length > 0 ? songs.map((song, index) => (
                    <View key={`${song.title}-${song.artist}`} style={styles.songRow}>
                      <Text style={styles.songNumber}>0{index + 1}</Text>
                      <View style={styles.songCopy}>
                        <Text numberOfLines={1} style={styles.songTitle}>{song.title}</Text>
                        <Text numberOfLines={1} style={styles.songArtist}>
                          {song.artist} · {song.plays} {song.plays === 1 ? 'play' : 'plays'}
                        </Text>
                      </View>
                      <View style={[styles.songGenreDot, { backgroundColor: getGenreColor(song.genre) }]} />
                    </View>
                  )) : (
                    <Text style={styles.noSongs}>No song details to show yet.</Text>
                  )}
                </View>
                <Text style={styles.footer}>MADE OF PLACES & PLAYLISTS</Text>
              </View>
            </ViewShot>
          </View>

          <Text style={styles.hint}>
            {layout === 'place'
              ? 'Choose a place to share its own little soundtrack.'
              : layout === 'selected'
                ? 'Your selection shapes the map, genres, and song list.'
                : 'A snapshot of your map, with the songs that showed up most.'}
          </Text>

          {error ? <Text style={styles.errorText} accessibilityRole="alert">{error}</Text> : null}
          {message ? <Text style={styles.successText} accessibilityRole="summary">{message}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              onPress={() => void saveImage()}
              disabled={!canExport}
              style={({ pressed }) => [styles.saveButton, (!canExport || pressed) && styles.buttonMuted]}
              accessibilityRole="button"
              accessibilityLabel="Save map image to photos"
            >
              {isSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save image</Text>}
            </Pressable>
            <Pressable
              onPress={() => void shareImage()}
              disabled={!canExport}
              style={({ pressed }) => [styles.shareButton, (!canExport || pressed) && styles.buttonMuted]}
              accessibilityRole="button"
              accessibilityLabel="Share map image"
            >
              {isSharing ? <ActivityIndicator color={colors.text} /> : <Text style={styles.shareButtonText}>Share</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </ModalSafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F2E9',
  },
  topBar: {
    minHeight: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    zIndex: 2,
    elevation: 2,
    backgroundColor: '#F6F2E9',
  },
  closeButton: {
    minWidth: 56,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  closeText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  topBarSpacer: {
    width: 56,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  layoutSwitch: {
    width: '100%',
    maxWidth: 360,
    flexDirection: 'row',
    padding: 4,
    backgroundColor: '#E8E3D8',
    borderRadius: 14,
    marginBottom: 12,
  },
  layoutOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 11,
  },
  layoutOptionActive: {
    backgroundColor: colors.white,
  },
  layoutOptionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  layoutOptionTextActive: {
    color: colors.text,
  },
  placeChoices: {
    width: '100%',
    maxWidth: 360,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  placeChoice: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 100,
    maxWidth: '48%',
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: '#E8E3D8',
  },
  placeChoiceActive: {
    backgroundColor: '#252740',
  },
  placeChoiceText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  placeChoiceTextActive: {
    color: colors.white,
  },
  spotPicker: {
    width: '100%',
    maxWidth: 360,
    padding: 12,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: '#E8E3D8',
  },
  spotPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  spotPickerTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  spotPickerAction: {
    color: '#334C76',
    fontSize: 12,
    fontWeight: '700',
  },
  spotChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  spotChoice: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 120,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: colors.white,
  },
  spotChoiceActive: {
    backgroundColor: '#F6F8E8',
  },
  spotCheckbox: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: 4,
  },
  spotCheckboxActive: {
    borderColor: '#252740',
    backgroundColor: '#252740',
  },
  spotCheckmark: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },
  spotChoiceText: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  artworkFrame: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#171A33',
  },
  artwork: {
    width: '100%',
    backgroundColor: '#171A33',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artworkContent: {
    width: STORY_SHARE_FORMAT.artworkWidth,
    height: STORY_SHARE_FORMAT.artworkHeight,
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 56,
    justifyContent: 'space-between',
  },
  artworkHeader: {
    marginBottom: 8,
  },
  brandPill: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#D5F26D',
    marginBottom: 9,
  },
  brandText: {
    color: '#171A33',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  eyebrow: {
    color: '#BBC0D7',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  artworkTitle: {
    color: colors.white,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  artworkSubtitle: {
    color: '#BBC0D7',
    fontSize: 13,
    marginTop: 5,
  },
  mapFrame: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#D8E0D9',
  },
  map: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#DCE6DB',
  },
  mapLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: '#D8E0D9',
  },
  mapMarkerLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  markerPosition: {
    position: 'absolute',
    width: 48,
    height: 48,
    marginLeft: -24,
    marginTop: -24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapErrorText: {
    maxWidth: '100%',
    color: colors.text,
    fontSize: 13,
    textAlign: 'center',
  },
  mapRetryButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  mapRetryText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  marker: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 7,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  mapCaption: {
    position: 'absolute',
    left: 11,
    top: 11,
    zIndex: 2,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(23, 26, 51, 0.82)',
  },
  mapCaptionText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 10,
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#282B46',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  genreDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  genreText: {
    maxWidth: 80,
    color: '#F4F2ED',
    fontSize: 10,
    fontWeight: '600',
  },
  moreGenres: {
    color: '#BBC0D7',
    fontSize: 12,
    fontWeight: '700',
  },
  songsCard: {
    backgroundColor: '#222540',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  songsEyebrow: {
    color: '#D5F26D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  songRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#41435B',
    gap: 10,
  },
  songNumber: {
    color: '#A8ADC8',
    fontSize: 12,
    fontWeight: '700',
  },
  songCopy: {
    flex: 1,
  },
  songTitle: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  songArtist: {
    color: '#BBC0D7',
    fontSize: 10,
    marginTop: 2,
  },
  songGenreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  noSongs: {
    color: '#BBC0D7',
    fontSize: 12,
    paddingVertical: 8,
  },
  footer: {
    color: '#9298B5',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 8,
  },
  hint: {
    maxWidth: 340,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  errorText: {
    width: '100%',
    maxWidth: 360,
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
  },
  successText: {
    width: '100%',
    maxWidth: 360,
    color: '#236A48',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
  },
  actions: {
    width: '100%',
    maxWidth: 360,
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  saveButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#252740',
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  shareButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#D5F26D',
  },
  shareButtonText: {
    color: '#171A33',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonMuted: {
    opacity: 0.45,
  },
});
