import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
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
  const screen = await render(
    <SpotifyConnectScreen onConnected={jest.fn()} onLogout={onLogout} />,
  );
  return {
    ...screen,
    onLogout,
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
