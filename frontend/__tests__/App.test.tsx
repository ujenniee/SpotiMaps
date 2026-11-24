import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import App from '../App';
import { supabase } from '../src/lib/supabase';
import { getSupabaseSession } from '../src/services/SupabaseAuthService';
import { connectSpotifyAccount, type SpotifyConnection } from '../src/services/SpotifyAuthService';
import { SpotifyHistoryError, syncListeningHistory } from '../src/services/SpotifyHistoryService';
import {
  startBackgroundTracking, stopBackgroundTracking, stopTracking, syncPendingGPSReadings,
} from '../src/services/LocationService';
import { getPrivacySettings } from '../src/services/PrivacySettingsService';

jest.mock('expo-constants', () => ({ __esModule: true, default: { appOwnership: 'standalone' } }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({ component: Component, children }: {
      component?: React.ComponentType; children?: () => React.ReactNode;
    }) => Component ? require('react').createElement(Component) : children?.(),
  }),
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getBackgroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));
jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn(), signOut: jest.fn(), onAuthStateChange: jest.fn() } },
}));
jest.mock('../src/services/SupabaseAuthService', () => ({ getSupabaseSession: jest.fn() }));
jest.mock('../src/services/SpotifyAuthService', () => ({ connectSpotifyAccount: jest.fn() }));
jest.mock('../src/services/SpotifyHistoryService', () => ({
  ...jest.requireActual('../src/services/SpotifyHistoryService'), syncListeningHistory: jest.fn(),
}));
jest.mock('../src/services/LocationService', () => ({
  getCurrentLocation: jest.fn(), startTracking: jest.fn(async () => true),
  stopTracking: jest.fn(), startBackgroundTracking: jest.fn(async () => true),
  stopBackgroundTracking: jest.fn(async () => undefined), isBackgroundTracking: jest.fn(async () => false),
  setGPSOwner: jest.fn(async () => undefined), clearGPSOwner: jest.fn(async () => undefined),
  syncPendingGPSReadings: jest.fn(),
}));
jest.mock('../src/services/PrivacySettingsService', () => ({
  getPrivacySettings: jest.fn(), updatePrivacySettings: jest.fn(),
}));
jest.mock('../src/components/LocationAvailabilityAlert', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/LoginScreen', () => ({
  __esModule: true,
  default: () => require('react').createElement(require('react-native').Text, null, 'Test login'),
}));
jest.mock('../src/screens/SpotifyConnectScreen', () => ({
  __esModule: true,
  default: ({ onConnected }: { onConnected: (connection: SpotifyConnection) => void }) =>
    require('react').createElement(require('react-native').Text, {
      onPress: () => onConnected(mockConnection),
    }, 'Connect test Spotify'),
}));
jest.mock('../src/screens/LocationPermissionScreen', () => ({
  __esModule: true,
  default: ({ onDone }: { onDone: () => void }) =>
    require('react').createElement(require('react-native').Text, { onPress: onDone }, 'Allow test location'),
}));
jest.mock('../src/screens/MapScreen', () => ({
  __esModule: true,
  default: ({ refreshVersion, syncError, onReconnectSpotify, isReconnectingSpotify }: {
    refreshVersion: number; syncError: string | null; onReconnectSpotify?: () => void;
    isReconnectingSpotify: boolean;
  }) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return React.createElement(View, null,
      React.createElement(Text, null, `Map refresh ${refreshVersion}`),
      syncError ? React.createElement(Text, null, syncError) : null,
      onReconnectSpotify ? React.createElement(Text, {
        onPress: onReconnectSpotify,
      }, isReconnectingSpotify ? 'Reconnecting test Spotify' : 'Reconnect test Spotify') : null);
  },
}));
jest.mock('../src/screens/RouteScreen', () => ({
  __esModule: true,
  default: () => require('react').createElement(require('react-native').Text, null, 'Test route'),
}));
jest.mock('../src/screens/FriendScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/FriendMapScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/PrivacyScreen', () => ({
  __esModule: true,
  default: ({ onLogout }: { onLogout: () => Promise<void> }) =>
    require('react').createElement(require('react-native').Text, {
      onPress: () => { void onLogout().catch(() => undefined); },
    }, 'Test logout'),
}));

let mockConnection: SpotifyConnection;
let mockUserId: string | null;
let mockAuthListener: Parameters<typeof supabase.auth.onAuthStateChange>[0];
const mockStateListeners = new Set<(state: AppStateStatus) => void>();
const mockUnsubscribe = jest.fn();
const mockSyncGPS = jest.mocked(syncPendingGPSReadings);
const mockSyncSpotify = jest.mocked(syncListeningHistory);
const success = { fetchedCount: 1, insertedCount: 1, skippedCount: 0, matchingError: null };

function connection(overrides: Partial<SpotifyConnection> = {}): SpotifyConnection {
  return {
    success: true, userId: 'user-a', spotifyUserId: 'spotify-a', accessToken: 'token-a',
    expiresAt: Date.now() + 3_600_000, ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.setSystemTime(new Date('2026-11-23T12:00:00Z'));
  mockUserId = 'user-a';
  mockConnection = connection();
  Constants.appOwnership = 'standalone' as typeof Constants.appOwnership;
  AppState.currentState = 'active';
  mockStateListeners.clear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    mockStateListeners.add(listener);
    return { remove: () => { mockStateListeners.delete(listener); } };
  });
  jest.mocked(getSupabaseSession).mockResolvedValue({ user: { id: 'user-a' } } as never);
  jest.mocked(getPrivacySettings).mockResolvedValue({ location_tracking_enabled: true, map_visibility: 'private' });
  jest.mocked(supabase.auth.getUser).mockImplementation(async () => ({
    data: { user: mockUserId ? { id: mockUserId } : null }, error: null,
  }) as never);
  jest.mocked(supabase.auth.onAuthStateChange).mockImplementation((listener) => {
    mockAuthListener = listener;
    return { data: { subscription: { unsubscribe: mockUnsubscribe } } } as never;
  });
  jest.mocked(supabase.auth.signOut).mockImplementation(async () => {
    mockUserId = null;
    mockAuthListener('SIGNED_OUT', null);
    return { error: null };
  });
  mockSyncGPS.mockResolvedValue(undefined);
  mockSyncSpotify.mockResolvedValue(success);
  jest.mocked(connectSpotifyAccount).mockResolvedValue(connection({ accessToken: 'token-new' }));
});

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

async function enterApp() {
  const screen = await render(<App />);
  if (Constants.appOwnership !== 'expo') {
    await fireEvent.press(await screen.findByText('Connect test Spotify'));
  }
  await fireEvent.press(await screen.findByText('Allow test location'));
  await waitFor(() => expect(mockSyncGPS).toHaveBeenCalledTimes(1));
  return screen;
}

async function advance(ms: number) {
  await act(async () => { await jest.advanceTimersByTimeAsync(ms); });
}

async function changeState(state: AppStateStatus) {
  await act(async () => {
    AppState.currentState = state;
    mockStateListeners.forEach((listener) => listener(state));
  });
}

test('uploads GPS before Spotify ingestion and refreshes immediately, then every 30 seconds', async () => {
  const upload = deferred<void>();
  mockSyncGPS.mockReturnValueOnce(upload.promise);
  const screen = await enterApp();
  expect(mockSyncSpotify).not.toHaveBeenCalled();
  expect(screen.getByText('Map refresh 0')).toBeTruthy();
  await act(async () => { upload.resolve(); });
  await waitFor(() => expect(screen.getByText('Map refresh 1')).toBeTruthy());
  expect(mockSyncSpotify).toHaveBeenCalledWith(supabase, 'token-a', undefined, 'user-a');
  await advance(29_000);
  expect(mockSyncSpotify).toHaveBeenCalledTimes(1);
  await advance(1_000);
  expect(mockSyncGPS).toHaveBeenCalledTimes(2);
  expect(mockSyncSpotify).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Map refresh 2')).toBeTruthy();
});

test('coalesces timer requests while ingestion is slow instead of overlapping imports', async () => {
  const ingestion = deferred<typeof success>();
  mockSyncSpotify.mockReturnValueOnce(ingestion.promise);
  const screen = await enterApp();
  await waitFor(() => expect(mockSyncSpotify).toHaveBeenCalledTimes(1));
  await advance(90_000);
  expect(mockSyncGPS).toHaveBeenCalledTimes(1);
  expect(mockSyncSpotify).toHaveBeenCalledTimes(1);
  await act(async () => { ingestion.resolve(success); });
  await waitFor(() => expect(mockSyncSpotify).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Map refresh 2')).toBeTruthy();
});

test('pauses network timers in background and catches up immediately without stopping GPS recording', async () => {
  const screen = await enterApp();
  await waitFor(() => expect(screen.getByText('Map refresh 1')).toBeTruthy());
  const stoppedForeground = jest.mocked(stopTracking).mock.calls.length;
  const stoppedBackground = jest.mocked(stopBackgroundTracking).mock.calls.length;
  await changeState('background');
  await advance(90_000);
  expect(mockSyncSpotify).toHaveBeenCalledTimes(1);
  await changeState('active');
  expect(mockSyncSpotify).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Map refresh 2')).toBeTruthy();
  expect(stopTracking).toHaveBeenCalledTimes(stoppedForeground);
  expect(stopBackgroundTracking).toHaveBeenCalledTimes(stoppedBackground);
  expect(startBackgroundTracking).toHaveBeenCalledTimes(1);
});

test('resuming while an old request is pending queues one fresh synchronization', async () => {
  const upload = deferred<void>();
  mockSyncGPS.mockReturnValueOnce(upload.promise);
  const screen = await enterApp();
  await changeState('background');
  await advance(60_000);
  await changeState('active');
  await changeState('inactive');
  await changeState('active');
  expect(mockSyncGPS).toHaveBeenCalledTimes(1);
  await act(async () => { upload.resolve(); });
  await waitFor(() => expect(mockSyncGPS).toHaveBeenCalledTimes(2));
  expect(mockSyncSpotify).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Map refresh 2')).toBeTruthy();
});

test('Expo Go continues GPS upload and map refreshing without Spotify credentials', async () => {
  Constants.appOwnership = 'expo' as typeof Constants.appOwnership;
  const screen = await enterApp();
  await waitFor(() => expect(screen.getByText('Map refresh 1')).toBeTruthy());
  await advance(30_000);
  expect(mockSyncGPS).toHaveBeenCalledTimes(2);
  expect(mockSyncSpotify).not.toHaveBeenCalled();
  expect(screen.getByText('Map refresh 2')).toBeTruthy();
  expect(screen.queryByText('Reconnect test Spotify')).toBeNull();
});

test('expired credentials pause imports and reconnect immediately without leaving the app', async () => {
  mockConnection = connection({ expiresAt: Date.now() - 1 });
  const screen = await enterApp();
  await waitFor(() => expect(screen.getByText('Reconnect test Spotify')).toBeTruthy());
  expect(mockSyncSpotify).not.toHaveBeenCalled();
  expect(screen.getByText('Map refresh 1')).toBeTruthy();
  const stopped = jest.mocked(stopTracking).mock.calls.length;
  await fireEvent.press(screen.getByText('Reconnect test Spotify'));
  await waitFor(() => expect(mockSyncSpotify).toHaveBeenCalledWith(supabase, 'token-new', undefined, 'user-a'));
  expect(screen.getByText('Map refresh 2')).toBeTruthy();
  expect(screen.getByText('Test route')).toBeTruthy();
  expect(stopTracking).toHaveBeenCalledTimes(stopped);
  expect(screen.queryByText('Reconnect test Spotify')).toBeNull();
});

test('401 pauses repeated imports while GPS/map continue, and canceled reconnection keeps the map open', async () => {
  mockSyncSpotify.mockRejectedValueOnce(new SpotifyHistoryError(401));
  jest.mocked(connectSpotifyAccount).mockResolvedValueOnce(null);
  const screen = await enterApp();
  await waitFor(() => expect(screen.getByText('Reconnect test Spotify')).toBeTruthy());
  await advance(30_000);
  expect(mockSyncSpotify).toHaveBeenCalledTimes(1);
  expect(mockSyncGPS).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Map refresh 2')).toBeTruthy();
  await fireEvent.press(screen.getByText('Reconnect test Spotify'));
  expect(screen.getByText('Reconnect test Spotify')).toBeTruthy();
  expect(screen.queryByText('Connect test Spotify')).toBeNull();
  await fireEvent.press(screen.getByText('Reconnect test Spotify'));
  await waitFor(() => expect(mockSyncSpotify).toHaveBeenCalledWith(supabase, 'token-new', undefined, 'user-a'));
  expect(screen.queryByText('Spotify authorization expired. Reconnect Spotify and retry.')).toBeNull();
});

test('honors Spotify Retry-After on timer ticks and resume while continuing GPS and retrieval', async () => {
  mockSyncSpotify.mockRejectedValueOnce(new SpotifyHistoryError(429, 90));
  const screen = await enterApp();
  await waitFor(() => expect(screen.getByText('Map refresh 1')).toBeTruthy());
  await advance(30_000);
  await changeState('background');
  await changeState('active');
  expect(mockSyncSpotify).toHaveBeenCalledTimes(1);
  expect(mockSyncGPS).toHaveBeenCalledTimes(3);
  expect(screen.getByText('Map refresh 3')).toBeTruthy();
  await advance(60_000);
  expect(mockSyncSpotify).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('Spotify rate limit reached. Wait before retrying.')).toBeNull();
});

test('GPS upload failure does not block song ingestion and map refresh, and later success clears errors', async () => {
  mockSyncGPS.mockRejectedValueOnce(new Error('GPS upload unavailable'));
  const screen = await enterApp();
  await waitFor(() => expect(screen.getByText('GPS upload unavailable')).toBeTruthy());
  expect(mockSyncSpotify).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Map refresh 1')).toBeTruthy();
  await advance(30_000);
  expect(screen.queryByText('GPS upload unavailable')).toBeNull();
});

test('surfaces saved-song matching failures and retries without requiring reconnection', async () => {
  mockSyncSpotify.mockResolvedValueOnce({ ...success, matchingError: 'matcher unavailable' });
  const screen = await enterApp();
  await waitFor(() => expect(screen.getByText(/Songs saved, but location matching needs retry/)).toBeTruthy());
  expect(screen.queryByText('Reconnect test Spotify')).toBeNull();
  await advance(30_000);
  expect(screen.queryByText(/matcher unavailable/)).toBeNull();
});

test('signing out during an import discards its result and removes the timer/listener', async () => {
  const ingestion = deferred<typeof success>();
  mockSyncSpotify.mockReturnValueOnce(ingestion.promise);
  const screen = await enterApp();
  await waitFor(() => expect(mockSyncSpotify).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByText('Test logout'));
  await waitFor(() => expect(screen.getByText('Test login')).toBeTruthy());
  await act(async () => { ingestion.resolve(success); });
  await advance(60_000);
  expect(mockSyncSpotify).toHaveBeenCalledTimes(1);
  expect(mockStateListeners.size).toBe(0);
  expect(screen.queryByText(/Map refresh/)).toBeNull();
});

test('a failed sign-out leaves a visible way to reconnect and resume imports', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: new Error('offline') } as never);
  const screen = await enterApp();
  await waitFor(() => expect(screen.getByText('Map refresh 1')).toBeTruthy());
  await fireEvent.press(screen.getByText('Test logout'));
  await waitFor(() => expect(screen.getByText('Reconnect test Spotify')).toBeTruthy());
  await advance(30_000);
  expect(screen.getByText('Sign-out failed. Reconnect Spotify to resume song imports.')).toBeTruthy();
  expect(mockSyncSpotify).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByText('Reconnect test Spotify'));
  await waitFor(() => expect(mockSyncSpotify).toHaveBeenCalledWith(supabase, 'token-new', undefined, 'user-a'));
});

test('a reconnection finishing after logout cannot restore Spotify access', async () => {
  mockSyncSpotify.mockRejectedValueOnce(new SpotifyHistoryError(401));
  const authorization = deferred<SpotifyConnection | null>();
  jest.mocked(connectSpotifyAccount).mockReturnValueOnce(authorization.promise);
  const screen = await enterApp();
  await waitFor(() => expect(screen.getByText('Reconnect test Spotify')).toBeTruthy());
  await fireEvent.press(screen.getByText('Reconnect test Spotify'));
  await fireEvent.press(screen.getByText('Test logout'));
  await waitFor(() => expect(screen.getByText('Test login')).toBeTruthy());
  await act(async () => { authorization.resolve(connection({ accessToken: 'late-token' })); });
  await advance(60_000);
  expect(mockSyncSpotify).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Test login')).toBeTruthy();
  expect(screen.queryByText(/Map refresh/)).toBeNull();
});

test('switching users cannot reuse a token or apply the previous user\'s late result', async () => {
  const ingestion = deferred<typeof success>();
  mockSyncSpotify.mockReturnValueOnce(ingestion.promise);
  const screen = await enterApp();
  await waitFor(() => expect(mockSyncSpotify).toHaveBeenCalledTimes(1));
  mockUserId = 'user-b';
  mockConnection = connection({ userId: 'user-b', spotifyUserId: 'spotify-b', accessToken: 'token-b' });
  await act(async () => {
    mockAuthListener('SIGNED_IN', { user: { id: 'user-b' } } as never);
  });
  await fireEvent.press(await screen.findByText('Connect test Spotify'));
  await fireEvent.press(await screen.findByText('Allow test location'));
  expect(mockSyncSpotify).toHaveBeenCalledTimes(1);
  await act(async () => { ingestion.resolve(success); });
  await waitFor(() => expect(mockSyncSpotify).toHaveBeenCalledTimes(2));
  expect(mockSyncSpotify.mock.calls.map(([, token]) => token)).toEqual(['token-a', 'token-b']);
  expect(mockSyncSpotify.mock.calls.map(([, , , userId]) => userId)).toEqual(['user-a', 'user-b']);
  expect(screen.getByText('Map refresh 1')).toBeTruthy();
});

test('a mismatched actual Supabase user prevents using the remembered Spotify token', async () => {
  const upload = deferred<void>();
  mockSyncGPS.mockReturnValueOnce(upload.promise);
  const screen = await enterApp();
  mockUserId = 'user-b';
  await act(async () => { upload.resolve(); });
  expect(mockSyncSpotify).not.toHaveBeenCalled();
  expect(screen.getByText('Map refresh 0')).toBeTruthy();
});

test('unmount during GPS upload prevents subsequent imports and clears subscriptions', async () => {
  const upload = deferred<void>();
  mockSyncGPS.mockReturnValueOnce(upload.promise);
  const screen = await enterApp();
  await screen.unmount();
  await act(async () => { upload.resolve(); });
  await advance(60_000);
  expect(mockSyncSpotify).not.toHaveBeenCalled();
  expect(mockUnsubscribe).toHaveBeenCalled();
  expect(mockStateListeners.size).toBe(0);
});
