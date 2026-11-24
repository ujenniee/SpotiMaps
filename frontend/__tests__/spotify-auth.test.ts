import * as AuthSession from 'expo-auth-session';
import { supabase } from '../src/lib/supabase';

const mockPromptAsync = jest.fn();

jest.mock('expo-auth-session', () => ({
  AuthRequest: jest.fn().mockImplementation(() => ({
    codeVerifier: 'pkce-verifier',
    promptAsync: mockPromptAsync,
  })),
  ResponseType: { Code: 'code' },
  exchangeCodeAsync: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    functions: { invoke: jest.fn() },
  },
}));

const mockGetUser = jest.mocked(supabase.auth.getUser);
const mockInvoke = jest.mocked(supabase.functions.invoke);
const mockExchangeCode = jest.mocked(AuthSession.exchangeCodeAsync);
const previousClientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
let connectSpotifyAccount: typeof import('../src/services/SpotifyAuthService').connectSpotifyAccount;

function authenticatedUser(id: string) {
  return { data: { user: { id } }, error: null } as Awaited<ReturnType<typeof supabase.auth.getUser>>;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID = 'test-spotify-client';
  ({ connectSpotifyAccount } = require('../src/services/SpotifyAuthService'));
  mockGetUser.mockResolvedValue(authenticatedUser('spotimaps-user'));
  mockPromptAsync.mockResolvedValue({ type: 'success', params: { code: 'spotify-code' } });
  mockExchangeCode.mockResolvedValue({
    accessToken: 'spotify-access-token',
    refreshToken: 'spotify-refresh-token',
    expiresIn: 3600,
  } as AuthSession.TokenResponse);
  mockInvoke.mockResolvedValue({
    data: { success: true, spotifyUserId: 'spotify-user' },
    error: null,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  if (previousClientId === undefined) {
    delete process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
  } else {
    process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID = previousClientId;
  }
});

test('returns an owned in-memory token only after linking the Spotify account', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(1000);

  await expect(connectSpotifyAccount()).resolves.toEqual({
    success: true,
    spotifyUserId: 'spotify-user',
    userId: 'spotimaps-user',
    accessToken: 'spotify-access-token',
    expiresAt: 3601000,
  });
  expect(mockInvoke).toHaveBeenCalledWith('connect-spotify', {
    body: { spotifyAccessToken: 'spotify-access-token' },
  });
  expect(mockGetUser).toHaveBeenCalledTimes(3);
  expect(mockExchangeCode).toHaveBeenCalledWith(expect.objectContaining({
    clientId: 'test-spotify-client',
    code: 'spotify-code',
    extraParams: { code_verifier: 'pkce-verifier' },
  }), expect.anything());
});

test('preserves an unknown expiry instead of inventing a token lifetime', async () => {
  mockExchangeCode.mockResolvedValue({ accessToken: 'spotify-access-token' } as AuthSession.TokenResponse);

  await expect(connectSpotifyAccount()).resolves.toEqual(expect.objectContaining({ expiresAt: null }));
});

test('does not exchange or link credentials when authorization is canceled', async () => {
  mockPromptAsync.mockResolvedValue({ type: 'cancel' });

  await expect(connectSpotifyAccount()).resolves.toBeNull();
  expect(mockExchangeCode).not.toHaveBeenCalled();
  expect(mockInvoke).not.toHaveBeenCalled();
});

test('does not start Spotify authorization without a SpotiMaps session', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

  await expect(connectSpotifyAccount()).rejects.toThrow('You must be logged into SpotiMaps first.');
  expect(mockPromptAsync).not.toHaveBeenCalled();
});

test('does not expose a connection when the backend link fails', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: { message: 'Link unavailable' } } as Awaited<ReturnType<typeof supabase.functions.invoke>>);

  await expect(connectSpotifyAccount()).rejects.toThrow('Failed to connect Spotify: Link unavailable');
});

test('requires backend link confirmation before exposing the token', async () => {
  mockInvoke.mockResolvedValue({ data: { success: false }, error: null });

  await expect(connectSpotifyAccount()).rejects.toThrow('Spotify connection was not confirmed.');
});

test('rejects an account switch during Spotify authorization before linking', async () => {
  mockGetUser
    .mockResolvedValueOnce(authenticatedUser('spotimaps-user'))
    .mockResolvedValueOnce(authenticatedUser('different-user'));

  await expect(connectSpotifyAccount()).rejects.toThrow('SpotiMaps account changed');
  expect(mockInvoke).not.toHaveBeenCalled();
});

test('rejects a logout while the backend is linking the account', async () => {
  mockGetUser
    .mockResolvedValueOnce(authenticatedUser('spotimaps-user'))
    .mockResolvedValueOnce(authenticatedUser('spotimaps-user'))
    .mockResolvedValueOnce({ data: { user: null }, error: null } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

  await expect(connectSpotifyAccount()).rejects.toThrow('SpotiMaps account changed');
  expect(mockInvoke).toHaveBeenCalledTimes(1);
});
