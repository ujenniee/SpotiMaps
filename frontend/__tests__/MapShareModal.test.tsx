import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { ComponentProps } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MapShareModal from '../src/components/MapShareModal';
import type { MapPlace } from '../src/data/mockData';
import { getMapExportRegion } from '../src/utils/mapExport';
import { STORY_SHARE_FORMAT } from '../src/utils/mapShareFormat';

type RenderResult = Awaited<ReturnType<typeof render>>;
type MapShareModalProps = ComponentProps<typeof MapShareModal>;

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const takeSnapshot = jest.fn().mockResolvedValue('file://native-map.png');
  const renderMap = jest.fn();
  const MockMapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ takeSnapshot }));
    renderMap(props);
    return React.createElement(
      View,
      {
        testID: props.testID,
        onMapLoaded: props.onMapLoaded,
        onMapReady: props.onMapReady,
      },
      props.children,
    );
  });
  return {
    __esModule: true,
    default: MockMapView,
    renderMap,
    takeSnapshot,
  };
});
const takeMapSnapshot = jest.requireMock('react-native-maps').takeSnapshot as jest.Mock;
const renderMap = jest.requireMock('react-native-maps').renderMap as jest.Mock;

jest.mock('react-native-view-shot', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockViewShot = React.forwardRef((props: any, ref: any) => (
    React.createElement(View, { ...props, ref }, props.children)
  ));
  return {
    __esModule: true,
    default: MockViewShot,
    captureRef: jest.fn().mockResolvedValue('file://map.png'),
  };
});

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const places: MapPlace[] = [
  {
    id: 'place-1',
    name: 'Cafe',
    area: 'Campus',
    latitude: 47.65,
    longitude: -122.31,
    songs: [{ title: 'Track A', artist: 'Artist', genre: 'Pop', plays: 4 }],
  },
  {
    id: 'place-2',
    name: 'Library',
    area: 'Campus',
    latitude: 47.66,
    longitude: -122.3,
    songs: [{ title: 'Track B', artist: 'Artist', genre: 'Jazz', plays: 2 }],
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  (captureRef as jest.Mock).mockResolvedValue('file://map.png');
  takeMapSnapshot.mockResolvedValue('file://native-map.png');
  (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (MediaLibrary.saveToLibraryAsync as jest.Mock).mockResolvedValue(undefined);
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
});

async function renderShareModal(props: MapShareModalProps): Promise<RenderResult> {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 375, height: 812 },
        insets: { top: 44, right: 0, bottom: 34, left: 0 },
      }}
    >
      <MapShareModal {...props} />
    </SafeAreaProvider>,
  );
}

async function waitForMapReady(screen: RenderResult) {
  await act(async () => {
    fireEvent(screen.getByTestId('map-export-native-preview'), 'mapLoaded', { nativeEvent: null });
    await Promise.resolve();
  });
  const image = await screen.findByTestId('map-export-snapshot');
  await act(async () => {
    fireEvent(image, 'load');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(screen.queryByTestId('map-export-native-preview')).toBeNull();
}

test('saves the captured image to Photos after permission is granted', async () => {
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });
  await waitForMapReady(screen);
  await fireEvent.press(screen.getByLabelText('Save map image to photos'));

  await waitFor(() => {
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith('file://map.png');
  });
  expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledWith(true, ['photo']);
});

test('surfaces denied photo permission without attempting to save', async () => {
  (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });
  await waitForMapReady(screen);
  await fireEvent.press(screen.getByLabelText('Save map image to photos'));

  expect(await screen.findByText('Allow photo access to save your map image.')).toBeTruthy();
  expect(MediaLibrary.saveToLibraryAsync).not.toHaveBeenCalled();
});

test('reports when native sharing is unavailable', async () => {
  (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });
  await waitForMapReady(screen);
  await fireEvent.press(screen.getByLabelText('Share map image'));

  expect(await screen.findByText('Sharing is not available on this device.')).toBeTruthy();
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
});

test('shares the captured image through the native share sheet', async () => {
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });
  await waitForMapReady(screen);

  await fireEvent.press(screen.getByLabelText('Share map image'));

  await waitFor(() => {
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file://map.png', {
      dialogTitle: 'Share your SpotiMaps image',
      mimeType: 'image/png',
      UTI: 'public.png',
    });
  });
  expect(await screen.findByText('Your map image is ready to share.')).toBeTruthy();
});

test('reuses the cached native snapshot for save and share', async () => {
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });
  await waitForMapReady(screen);

  await fireEvent.press(screen.getByLabelText('Save map image to photos'));
  await waitFor(() => {
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith('file://map.png');
  });
  expect(await screen.findByText('Saved to your photo library.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Share map image'));

  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
  expect(takeMapSnapshot).toHaveBeenCalledTimes(1);
});

test('surfaces image capture failures instead of starting save or share', async () => {
  (captureRef as jest.Mock).mockRejectedValue(new Error('capture failed'));
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });
  await waitForMapReady(screen);

  await fireEvent.press(screen.getByLabelText('Save map image to photos'));

  expect(await screen.findByText('capture failed')).toBeTruthy();
  expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(MediaLibrary.saveToLibraryAsync).not.toHaveBeenCalled();
});

test('surfaces native map snapshot failures', async () => {
  takeMapSnapshot.mockRejectedValue(new Error('map snapshot failed'));
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });
  await act(async () => {
    fireEvent(screen.getByTestId('map-export-native-preview'), 'mapLoaded', { nativeEvent: null });
    await Promise.resolve();
  });
  expect(await screen.findByText('map snapshot failed')).toBeTruthy();
  expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(captureRef).not.toHaveBeenCalled();
});

test('keeps the Close control available while the native snapshot is loading', async () => {
  const onClose = jest.fn();
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose,
  });

  expect(screen.queryByText('Loading the native map…')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Close map export'));

  expect(onClose).toHaveBeenCalledTimes(1);
});

test('starts the native snapshot from map-ready without waiting for map-loaded', async () => {
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });

  await act(async () => {
    fireEvent(screen.getByTestId('map-export-native-preview'), 'mapReady', { nativeEvent: null });
    await Promise.resolve();
  });

  expect(await screen.findByTestId('map-export-snapshot')).toBeTruthy();
  expect(takeMapSnapshot).toHaveBeenCalledTimes(1);
});

test('composites genre markers at spot coordinates and excludes the user location', async () => {
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });
  await waitForMapReady(screen);

  expect(screen.getByTestId('map-export-markers')).toBeTruthy();
  expect(screen.getByTestId('map-export-marker-place-1')).toBeTruthy();
  expect(screen.getByTestId('map-export-marker-place-2')).toBeTruthy();
  expect(renderMap).toHaveBeenCalledWith(expect.objectContaining({
    showsUserLocation: false,
    showsMyLocationButton: false,
  }));
  const markerPosition = StyleSheet.flatten(
    screen.getByTestId('map-export-marker-place-1').props.style,
  );
  expect(markerPosition.left).toMatch(/%$/);
  expect(markerPosition.top).toMatch(/%$/);
});

test('uses the fitted listening-spot region for both the map and its snapshot', async () => {
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });
  await waitForMapReady(screen);

  const region = getMapExportRegion(
    places,
    STORY_SHARE_FORMAT.mapWidth / STORY_SHARE_FORMAT.mapHeight,
  );
  expect(renderMap).toHaveBeenCalledWith(expect.objectContaining({ region }));
  expect(takeMapSnapshot).toHaveBeenCalledWith(expect.objectContaining({
    region,
    width: STORY_SHARE_FORMAT.mapWidth,
    height: STORY_SHARE_FORMAT.mapHeight,
  }));
});

test('captures the complete Story canvas at 9:16 dimensions with an edge-to-edge map', async () => {
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });

  await waitForMapReady(screen);

  const artworkStyle = StyleSheet.flatten(
    screen.getByTestId('map-share-artwork-preview').props.style,
  );
  const mapFrameStyle = StyleSheet.flatten(screen.getByTestId('map-share-map-frame').props.style);
  expect(artworkStyle.aspectRatio).toBe(STORY_SHARE_FORMAT.width / STORY_SHARE_FORMAT.height);
  expect(mapFrameStyle.aspectRatio).toBe(STORY_SHARE_FORMAT.mapWidth / STORY_SHARE_FORMAT.mapHeight);
  expect(mapFrameStyle.width).toBe('100%');
  expect(screen.getByTestId('map-export-snapshot').props.resizeMode).toBe('cover');
  expect(StyleSheet.flatten(screen.getByText('Your week, mapped.').props.style).fontSize).toBeGreaterThan(17);
  expect(StyleSheet.flatten(screen.getByText('Track A').props.style).fontSize).toBeGreaterThan(10);
  expect(screen.queryByLabelText('Instagram post 4:5')).toBeNull();
  expect(screen.queryByLabelText('Instagram Story 9:16')).toBeNull();
  const artwork = within(screen.getByTestId('map-share-artwork-preview'));
  expect(artwork.getByTestId('map-share-map-frame')).toBeTruthy();
  expect(artwork.getByTestId('map-export-markers')).toBeTruthy();
  expect(artwork.getByText('YOUR MAP SOUNDTRACK')).toBeTruthy();
  expect(artwork.getByText('MADE OF PLACES & PLAYLISTS')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Save map image to photos'));
  await waitFor(() => {
    expect(captureRef).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        width: STORY_SHARE_FORMAT.width,
        height: STORY_SHARE_FORMAT.height,
      }),
    );
  });
});

test('composites only markers from selected spots', async () => {
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });

  await fireEvent.press(screen.getByLabelText('Selected spots'));
  await fireEvent.press(screen.getByLabelText('Library'));
  await act(async () => {
    fireEvent(screen.getByTestId('map-export-native-preview'), 'mapLoaded', { nativeEvent: null });
    await Promise.resolve();
  });
  const image = await screen.findByTestId('map-export-snapshot');
  await act(async () => {
    fireEvent(image, 'load');
    await Promise.resolve();
  });

  expect(screen.getByTestId('map-export-marker-place-1')).toBeTruthy();
  expect(screen.queryByTestId('map-export-marker-place-2')).toBeNull();
  const selectedRegion = getMapExportRegion(
    [places[0]],
    STORY_SHARE_FORMAT.mapWidth / STORY_SHARE_FORMAT.mapHeight,
  );
  expect(renderMap).toHaveBeenLastCalledWith(expect.objectContaining({ region: selectedRegion }));
  expect(takeMapSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({
    region: selectedRegion,
  }));
});

test('shows a retryable error if native snapshot generation times out', async () => {
  jest.useFakeTimers();
  takeMapSnapshot.mockReturnValue(new Promise(() => {}));

  try {
    const screen = await renderShareModal({
      visible: true,
      places,
      initialPlaceId: 'place-1',
      onClose: jest.fn(),
    });

    await act(async () => {
      fireEvent(screen.getByTestId('map-export-native-preview'), 'mapLoaded', { nativeEvent: null });
      await jest.advanceTimersByTimeAsync(12000);
    });

    expect(screen.getByText('The map image is taking too long. Check your connection and try again.')).toBeTruthy();
    expect(screen.getByLabelText('Retry map image')).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

test('shows a retryable error if the native map never becomes ready', async () => {
  jest.useFakeTimers();

  try {
    const screen = await renderShareModal({
      visible: true,
      places,
      initialPlaceId: 'place-1',
      onClose: jest.fn(),
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10000);
    });

    expect(screen.getByText('The native map did not finish starting. Check your connection and try again.')).toBeTruthy();
    expect(screen.getByLabelText('Retry map image')).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

test('filters the One place preview to the chosen spot', async () => {
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });

  await fireEvent.press(screen.getByLabelText('One place'));
  await fireEvent.press(screen.getByLabelText('Choose Library'));

  expect(screen.getByText('Library · Campus')).toBeTruthy();
  expect(screen.getByText('Track B')).toBeTruthy();
  expect(screen.queryByText('Track A')).toBeNull();
});

test('defaults all spots selected and filters the selected-spots preview', async () => {
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });

  await fireEvent.press(screen.getByLabelText('Selected spots'));
  expect(screen.getByText('Choose spots (2/2)')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Library'));

  expect(screen.getByText('Choose spots (1/2)')).toBeTruthy();
  expect(screen.getByText('Track A')).toBeTruthy();
  expect(screen.queryByText('Track B')).toBeNull();
  expect(screen.queryByText('Jazz')).toBeNull();
});

test('requires at least one selected spot before exporting', async () => {
  const screen = await renderShareModal({
    visible: true,
    places,
    initialPlaceId: 'place-1',
    onClose: jest.fn(),
  });

  await fireEvent.press(screen.getByLabelText('Selected spots'));
  await fireEvent.press(screen.getByLabelText('Clear all spots'));

  expect(screen.getByText('Select at least one spot to preview the map.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Save map image to photos'));
  expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled();
});

test('uses the single available spot without showing a redundant picker', async () => {
  const screen = await renderShareModal({
    visible: true,
    places: [places[0]],
    initialPlaceId: null,
    onClose: jest.fn(),
  });

  expect(screen.queryByLabelText('Selected spots')).toBeNull();
  await fireEvent.press(screen.getByLabelText('One place'));
  expect(screen.getByText('Cafe · Campus')).toBeTruthy();
  expect(screen.getByText('Track A')).toBeTruthy();
});
