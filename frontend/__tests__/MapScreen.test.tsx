import type { ForwardedRef, ReactNode } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import MapShareModal from '../src/components/MapShareModal';
import MapScreen from '../src/screens/MapScreen';
import type { MapPlace } from '../src/data/mockData';
import { fetchMapPlaces } from '../src/services/MapDataService';
import { getGenreColor, getReadableTextColor } from '../src/theme';

const mockAnimateToRegion = jest.fn();
const mockFitToCoordinates = jest.fn();

jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
jest.mock('../src/services/MapDataService', () => ({ fetchMapPlaces: jest.fn() }));
jest.mock('../src/components/MapShareModal', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('react-native-maps', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: React.forwardRef((
      props: { children?: ReactNode; onMapReady: () => void; onRegionChangeComplete: () => void },
      ref: ForwardedRef<unknown>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        animateToRegion: mockAnimateToRegion,
        fitToCoordinates: mockFitToCoordinates,
      }));
      return React.createElement(View, { ...props, testID: 'map' }, props.children);
    }),
    Marker: ({ coordinate, onPress, children }: {
      coordinate: { latitude: number };
      onPress: () => void;
      children?: ReactNode;
    }) => React.createElement(Pressable, {
      testID: `marker-${coordinate.latitude}`,
      onPress,
    }, children),
  };
});

function place(id: string, latitude: number, title = `Song ${id}`): MapPlace {
  return {
    id,
    name: `Place ${id}`,
    area: 'Recorded location',
    latitude,
    longitude: -122.3,
    songs: [{ title, artist: 'Artist', genre: 'Pop', plays: 1 }],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchMapPlaces).mockReset();
});

function latestShareProps() {
  const calls = jest.mocked(MapShareModal).mock.calls;
  return calls[calls.length - 1][0];
}

test('refreshes selected song data without resetting the camera or reopening a closed card', async () => {
  jest.mocked(fetchMapPlaces)
    .mockResolvedValueOnce([place('a', 47.65), place('b', 47.66)])
    .mockResolvedValueOnce([place('a', 47.65), place('b', 47.67, 'Updated song')])
    .mockResolvedValueOnce([place('a', 47.65), place('b', 47.67, 'Another update')]);
  const screen = await render(<MapScreen />);
  await screen.findByTestId('marker-47.65');
  expect(screen.queryByLabelText('Close song card')).toBeNull();
  expect(screen.queryByText('Song a')).toBeNull();
  await fireEvent(screen.getByTestId('map'), 'mapReady');
  await waitFor(() => expect(mockFitToCoordinates).toHaveBeenCalledTimes(1));

  await fireEvent.press(screen.getByTestId('marker-47.66'));
  expect(screen.getByText('Song b')).toBeTruthy();
  await screen.rerender(<MapScreen refreshVersion={1} />);
  await screen.findByText('Updated song');
  expect(screen.queryByText('Song a')).toBeNull();
  expect(screen.getByTestId('marker-47.67')).toBeTruthy();
  expect(mockFitToCoordinates).toHaveBeenCalledTimes(1);
  expect(mockAnimateToRegion).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByLabelText('Close song card'));
  await screen.rerender(<MapScreen refreshVersion={2} />);
  await waitFor(() => expect(fetchMapPlaces).toHaveBeenCalledTimes(3));
  expect(screen.queryByText('Another update')).toBeNull();
  expect(screen.queryByLabelText('Close song card')).toBeNull();
});

test('closes the selected card if its place is removed by a refresh', async () => {
  jest.mocked(fetchMapPlaces)
    .mockResolvedValueOnce([place('a', 47.65)])
    .mockResolvedValueOnce([place('b', 47.66)]);
  const screen = await render(<MapScreen />);
  await screen.findByTestId('marker-47.65');
  await fireEvent.press(screen.getByTestId('marker-47.65'));
  expect(screen.getByText('Song a')).toBeTruthy();
  await screen.rerender(<MapScreen refreshVersion={1} />);
  await screen.findByTestId('marker-47.66');
  expect(screen.queryByText('Song a')).toBeNull();
  expect(screen.queryByText('Song b')).toBeNull();
});

test('keeps saved markers during a failed refresh and clears the error after recovery', async () => {
  jest.mocked(fetchMapPlaces)
    .mockResolvedValueOnce([place('a', 47.65)])
    .mockRejectedValueOnce(new Error('Map connection failed'))
    .mockResolvedValueOnce([place('a', 47.65, 'Recovered song')]);
  const screen = await render(<MapScreen />);
  await screen.findByTestId('marker-47.65');
  await fireEvent.press(screen.getByTestId('marker-47.65'));
  await screen.rerender(<MapScreen refreshVersion={1} />);
  await screen.findByText('Couldn’t load your map');
  expect(screen.queryByText('Map connection failed')).toBeNull();
  expect(screen.getByTestId('marker-47.65')).toBeTruthy();
  expect(screen.getByText('Song a')).toBeTruthy();

  await screen.rerender(<MapScreen refreshVersion={2} />);
  await screen.findByText('Recovered song');
  expect(screen.queryByText('Couldn’t load your map')).toBeNull();
});

test('serializes refreshes while slow requests keep updating the map', async () => {
  const first = deferred<MapPlace[]>();
  const second = deferred<MapPlace[]>();
  const latest = deferred<MapPlace[]>();
  jest.mocked(fetchMapPlaces)
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
    .mockReturnValueOnce(latest.promise);
  const screen = await render(<MapScreen />);
  await screen.rerender(<MapScreen refreshVersion={1} />);
  await screen.rerender(<MapScreen refreshVersion={2} />);
  expect(fetchMapPlaces).toHaveBeenCalledTimes(1);

  await act(async () => first.resolve([place('first', 47.64)]));
  expect(fetchMapPlaces).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('marker-47.64')).toBeTruthy();

  await screen.rerender(<MapScreen refreshVersion={3} />);
  await screen.rerender(<MapScreen refreshVersion={4} />);
  expect(fetchMapPlaces).toHaveBeenCalledTimes(2);
  await act(async () => second.resolve([place('second', 47.67)]));
  expect(fetchMapPlaces).toHaveBeenCalledTimes(3);
  expect(screen.getByTestId('marker-47.67')).toBeTruthy();

  await act(async () => latest.resolve([place('latest', 47.68)]));
  expect(screen.getByTestId('marker-47.68')).toBeTruthy();
});

test('reports failures while a refresh is queued and cancels queued loads on unmount', async () => {
  const first = deferred<MapPlace[]>();
  const latest = deferred<MapPlace[]>();
  jest.mocked(fetchMapPlaces)
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(latest.promise);
  const screen = await render(<MapScreen />);
  await screen.rerender(<MapScreen refreshVersion={1} />);
  await act(async () => first.reject(new Error('Map request failed')));
  expect(fetchMapPlaces).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Couldn’t load your map')).toBeTruthy();
  expect(screen.queryByText('Map request failed')).toBeNull();

  await screen.rerender(<MapScreen refreshVersion={2} />);
  await screen.unmount();
  await act(async () => latest.resolve([place('late', 47.69)]));
  expect(fetchMapPlaces).toHaveBeenCalledTimes(2);
});

test('fits the first nonempty result even when the map initially has no songs', async () => {
  jest.mocked(fetchMapPlaces)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([place('a', 47.65)]);
  const screen = await render(<MapScreen />);
  await fireEvent(screen.getByTestId('map'), 'mapReady');
  await screen.findByText('Keep listening to build your map!');
  expect(mockAnimateToRegion).not.toHaveBeenCalled();
  await screen.rerender(<MapScreen refreshVersion={1} />);
  await screen.findByTestId('marker-47.65');
  expect(screen.queryByLabelText('Close song card')).toBeNull();
  expect(mockAnimateToRegion).toHaveBeenCalledTimes(1);
});

test('shows sync errors and reconnects Spotify without hiding existing map data', async () => {
  jest.mocked(fetchMapPlaces).mockResolvedValue([place('a', 47.65)]);
  const reconnect = jest.fn();
  const screen = await render(
    <MapScreen syncError="Spotify connection expired" onReconnectSpotify={reconnect} />,
  );
  await screen.findByTestId('marker-47.65');
  expect(screen.getByText('Spotify connection expired')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Reconnect Spotify' }));
  expect(reconnect).toHaveBeenCalledTimes(1);

  await screen.rerender(<MapScreen onReconnectSpotify={reconnect} isReconnectingSpotify />);
  expect(screen.queryByText('Spotify connection expired')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Connecting…' }));
  expect(reconnect).toHaveBeenCalledTimes(1);
  expect(fetchMapPlaces).toHaveBeenCalledTimes(1);
});

test('manual retry and automatic refresh share one serialized request queue', async () => {
  const retry = deferred<MapPlace[]>();
  const automaticRefresh = deferred<MapPlace[]>();
  jest.mocked(fetchMapPlaces)
    .mockRejectedValueOnce(new Error('Initial connection failure'))
    .mockReturnValueOnce(retry.promise)
    .mockReturnValueOnce(automaticRefresh.promise);
  const screen = await render(<MapScreen />);
  await screen.findByText('Couldn’t load your map');

  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(fetchMapPlaces).toHaveBeenCalledTimes(2);
  await screen.rerender(<MapScreen refreshVersion={1} />);
  await screen.rerender(<MapScreen refreshVersion={2} />);
  expect(fetchMapPlaces).toHaveBeenCalledTimes(2);

  await act(async () => retry.resolve([place('retry', 47.64)]));
  expect(screen.getByTestId('marker-47.64')).toBeTruthy();
  expect(fetchMapPlaces).toHaveBeenCalledTimes(3);
  await act(async () => automaticRefresh.resolve([place('latest', 47.68)]));
  expect(screen.getByTestId('marker-47.68')).toBeTruthy();
  expect(screen.queryByText('Couldn’t load your map')).toBeNull();
});

test('sharing keeps its open snapshot stable and uses refreshed data when reopened', async () => {
  const firstPlaces = [place('a', 47.65), place('b', 47.66)];
  const refreshedPlaces = [place('a', 47.65), place('b', 47.67, 'Updated song')];
  jest.mocked(fetchMapPlaces)
    .mockResolvedValueOnce(firstPlaces)
    .mockResolvedValueOnce(refreshedPlaces);
  const screen = await render(<MapScreen />);
  await screen.findByTestId('marker-47.66');
  await fireEvent.press(screen.getByTestId('marker-47.66'));
  await fireEvent.press(screen.getByRole('button', { name: 'Create a shareable image of your map' }));
  expect(latestShareProps()).toMatchObject({ visible: true, initialPlaceId: 'b' });
  expect(latestShareProps().places).toBe(firstPlaces);

  await screen.rerender(<MapScreen refreshVersion={1} />);
  await screen.findByText('Updated song');
  expect(latestShareProps().places).toBe(firstPlaces);
  expect(latestShareProps().initialPlaceId).toBe('b');

  await act(async () => latestShareProps().onClose());
  expect(latestShareProps().visible).toBe(false);
  await fireEvent.press(screen.getByRole('button', { name: 'Create a shareable image of your map' }));
  expect(latestShareProps().places).toBe(refreshedPlaces);
  expect(latestShareProps().initialPlaceId).toBe('b');
});

test('retains accessible markers, readable counts, and legend ordering by play count', async () => {
  const popPlace = place('pop', 47.65);
  const rockPlace = {
    ...place('rock', 47.66),
    songs: [{ title: 'Rock song', artist: 'Artist', genre: 'Rock', plays: 5 }],
  };
  const jazzPlace = {
    ...place('jazz', 47.67),
    songs: [{ title: 'Jazz song', artist: 'Artist', genre: 'Jazz', plays: 2 }],
  };
  jest.mocked(fetchMapPlaces).mockResolvedValue([popPlace, rockPlace, jazzPlace]);
  const screen = await render(<MapScreen />);
  await screen.findByTestId('marker-47.66');
  expect(screen.getByLabelText('Place rock, 5 plays, mostly Rock')).toBeTruthy();
  expect(screen.getAllByText(/^(Rock|Jazz|Pop)$/).map((label) => label.props.children))
    .toEqual(['Rock', 'Jazz', 'Pop']);
  expect(StyleSheet.flatten(screen.getByText('5').props.style).color)
    .toBe(getReadableTextColor(getGenreColor('Rock')));
  expect(screen.getByLabelText('Zoom in')).toBeTruthy();
  expect(screen.getByLabelText('Zoom out')).toBeTruthy();
  expect(screen.queryByLabelText('Close song card')).toBeNull();
});
