import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;

const redirectUri = 'spotimaps://spotify/callback';

const scopes = [
  'user-read-recently-played',
  'user-read-private',
];

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};
export type SpotifyTokens = {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  };
  
  export async function signInWithSpotify(): Promise<SpotifyTokens | null> {
    if (!clientId) {
      throw new Error('EXPO_PUBLIC_SPOTIFY_CLIENT_ID is missing.');
    }
  
    const request = new AuthSession.AuthRequest({
      clientId,
      scopes,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    });
  
    const result = await request.promptAsync(discovery);
  
    if (result.type !== 'success') {
      return null;
    }
  
    if (!result.params.code || !request.codeVerifier) {
      throw new Error('Spotify authorization code or PKCE verifier is missing.');
    }
  
    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId,
        code: result.params.code,
        redirectUri,
        extraParams: {
          code_verifier: request.codeVerifier,
        },
      },
      discovery
    );
  
    return {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      expiresIn: tokenResponse.expiresIn,
    };
  }
  
  export type SpotifyProfile = {
    id: string;
    display_name?: string;
    email?: string;
  };
  
  export async function getSpotifyProfile(
    accessToken: string
  ): Promise<SpotifyProfile> {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  
    if (!response.ok) {
      throw new Error(`Failed to fetch Spotify profile (${response.status}).`);
    }
  
    return (await response.json()) as SpotifyProfile;
  }
  export type ConnectSpotifyResult = {
    success: true;
    spotifyUserId: string;
  };
  
  export async function connectSpotifyAccount(): Promise<ConnectSpotifyResult | null> {
  
    // 1. Check that the user is logged into SpotiMaps
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
  
    if (userError || !user) {
      throw new Error('You must be logged into SpotiMaps first.');
    }
  
    // 2. Open Spotify authorization
    const tokens = await signInWithSpotify();
  
    // User canceled Spotify authorization
    if (!tokens) {
      return null;
    }
  
    // 3. Send Spotify token to our Supabase Edge Function
    const { data, error } =
      await supabase.functions.invoke<ConnectSpotifyResult>(
        'connect-spotify',
        {
          body: {
            spotifyAccessToken: tokens.accessToken,
          },
        }
      );
  
    if (error) {
      throw new Error(`Failed to connect Spotify: ${error.message}`);
    }
  
    // 4. Check that the backend successfully linked the account
    if (!data?.success || !data.spotifyUserId) {
      throw new Error('Spotify connection was not confirmed.');
    }
  
    // 5. Return the successful connection
    return data;
  }