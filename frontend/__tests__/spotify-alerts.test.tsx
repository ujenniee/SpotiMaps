import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import SpotifyConnectScreen from '../src/screens/SpotifyConnectScreen';
import { connectSpotifyAccount } from '../src/services/SpotifyAuthService';

jest.mock('../src/services/SpotifyAuthService', () => ({
  connectSpotifyAccount: jest.fn(),
}));

const mockConnectSpotifyAccount = jest.mocked(connectSpotifyAccount);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function renderScreen(onLogout = jest.fn(async () => undefined)) {
  const onConnected = jest.fn();
  const screen = await render(
    <SpotifyConnectScreen onConnected={onConnected} onLogout={onLogout} />,
  );
  return {
    ...screen,
    onLogout,
    onConnected,
  };
}

test('shows a native informational alert when Spotify sign-in is canceled', async () => {
  mockConnectSpotifyAccount.mockResolvedValue(null);
  const screen = await renderScreen();

  await fireEvent.press(screen.getByText('Connect with Spotify'));

  await waitFor(() => {
    expect(Alert.alert).toHaveBeenCalledWith(
      'Spotify Sign-In Canceled',
      expect.stringContaining('wasn’t connected'),
      [{ text: 'OK' }],
    );
  });
  expect(screen.onConnected).not.toHaveBeenCalled();
});

test('shows a native connection-failure alert', async () => {
  mockConnectSpotifyAccount.mockRejectedValue(new Error('Network request failed.'));
  const screen = await renderScreen();

  await fireEvent.press(screen.getByText('Connect with Spotify'));

  await waitFor(() => {
    expect(Alert.alert).toHaveBeenCalledWith(
      'Spotify Connection Failed',
      'Network request failed.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Try Again' }),
      ]),
    );
  });
  expect(screen.onConnected).not.toHaveBeenCalled();
});

const connection = {
  success: true as const,
  spotifyUserId: 'spotify-user',
  userId: 'spotimaps-user',
  accessToken: 'spotify-access-token',
  expiresAt: 1234567890000,
};

test('passes the confirmed Spotify session to the app', async () => {
  mockConnectSpotifyAccount.mockResolvedValue(connection);
  const screen = await renderScreen();

  await fireEvent.press(screen.getByText('Connect with Spotify'));

  await waitFor(() => expect(screen.onConnected).toHaveBeenCalledWith(connection));
  expect(screen.onConnected).toHaveBeenCalledTimes(1);
});

test('ignores a Spotify authorization that finishes after the screen unmounts', async () => {
  let finish!: (value: typeof connection) => void;
  mockConnectSpotifyAccount.mockReturnValue(new Promise((resolve) => {
    finish = resolve;
  }));
  const screen = await renderScreen();

  await fireEvent.press(screen.getByText('Connect with Spotify'));
  await screen.unmount();
  await act(async () => finish(connection));

  expect(screen.onConnected).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('ignores a pending Spotify authorization after logout starts', async () => {
  let finish!: (value: typeof connection) => void;
  mockConnectSpotifyAccount.mockReturnValue(new Promise((resolve) => {
    finish = resolve;
  }));
  const screen = await renderScreen();

  await fireEvent.press(screen.getByText('Connect with Spotify'));
  await fireEvent.press(screen.getByText('Log Out'));
  await act(async () => finish(connection));

  expect(screen.onLogout).toHaveBeenCalledTimes(1);
  expect(screen.onConnected).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('offers a login action when the SpotiMaps session is missing', async () => {
  mockConnectSpotifyAccount.mockRejectedValue(
    new Error('You must be logged into SpotiMaps first.'),
  );
  const screen = await renderScreen();

  await fireEvent.press(screen.getByText('Connect with Spotify'));

  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
    'Session Expired',
    expect.stringContaining('Log in again'),
    expect.arrayContaining([
      expect.objectContaining({ text: 'Not Now' }),
      expect.objectContaining({ text: 'Log In' }),
    ]),
  ));
  const buttons = jest.mocked(Alert.alert).mock.calls[0][2];
  buttons?.find((button) => button.text === 'Log In')?.onPress?.();
  await waitFor(() => expect(screen.onLogout).toHaveBeenCalledTimes(1));
});

test('offers Spotify reconnection after authorization is revoked', async () => {
  const error = Object.assign(new Error('Spotify authorization expired.'), { status: 401 });
  mockConnectSpotifyAccount.mockRejectedValue(error);
  const screen = await renderScreen();

  await fireEvent.press(screen.getByText('Connect with Spotify'));

  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
    'Reconnect Spotify',
    expect.stringContaining('Spotify access was removed'),
    expect.arrayContaining([
      expect.objectContaining({ text: 'Later' }),
      expect.objectContaining({ text: 'Reconnect' }),
    ]),
  ));
});
