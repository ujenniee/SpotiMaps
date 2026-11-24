import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { connectSpotifyAccount, type SpotifyConnection } from '../services/SpotifyAuthService';


type SpotifyConnectScreenProps = {
  onConnected: (connection: SpotifyConnection) => void;
  onLogout: () => Promise<void>;
};

function getSpotifyErrorType(error: unknown): 'session' | 'revoked' | 'connection' {
  const message = error instanceof Error ? error.message : '';
  if (/must be logged into spotimaps|session.*expired/i.test(message)) {
    return 'session';
  }

  if (/spotify.*(access|authorization).*(revoked|expired)|access.*revoked/i.test(message)) {
    return 'revoked';
  }

  return 'connection';
}

export default function SpotifyConnectScreen({
  onConnected,
  onLogout,
}: SpotifyConnectScreenProps) {
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(true);
  const attemptId = useRef(0);
  const isConnecting = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      attemptId.current += 1;
    };
  }, []);

  const handleConnect = async () => {
    if (!isMounted.current || isConnecting.current) return;

    const attempt = ++attemptId.current;
    const isCurrentAttempt = () => isMounted.current && attempt === attemptId.current;
    isConnecting.current = true;
    setLoading(true);

    try {
      const result = await connectSpotifyAccount();
      if (!isCurrentAttempt()) return;

      if (result?.success) {
        onConnected(result);
      } else {
        Alert.alert(
          'Spotify Sign-In Canceled',
          'Spotify wasn’t connected. You can connect your account anytime.',
          [{ text: 'OK' }],
        );
      }
    } catch (error) {
      if (!isCurrentAttempt()) return;
      const errorType = getSpotifyErrorType(error);
      if (errorType === 'session') {
        Alert.alert(
          'Session Expired',
          'Your SpotiMaps session expired. Log in again to continue.',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Log In',
              onPress: () => {
                void handleLogout();
              },
            },
          ],
        );
      } else if (errorType === 'revoked') {
        Alert.alert(
          'Reconnect Spotify',
          'Spotify access was removed. Reconnect your account to continue.',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Reconnect', onPress: () => void handleConnect() },
          ],
        );
      } else {
        const message =
          error instanceof Error
            ? error.message
            : 'Something went wrong connecting Spotify.';
        Alert.alert(
          'Spotify Connection Failed',
          message,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Try Again', onPress: () => void handleConnect() },
          ],
        );
      }
    } finally {
      if (isCurrentAttempt()) {
        isConnecting.current = false;
        setLoading(false);
      }
    }
  };

  const handleLogout = async () => {
    attemptId.current += 1;
    isConnecting.current = false;
    if (isMounted.current) setLoading(false);
    try {
      await onLogout();
    } catch (error) {
      if (!isMounted.current) return;
      const message =
        error instanceof Error ? error.message : 'Something went wrong logging out.';
      Alert.alert('Log Out Failed', message);
    }
  };


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect Your Spotify</Text>

      <Text style={styles.description}>
        Connect your Spotify account to start mapping the music
        you listen to throughout your day.
      </Text>

      <TouchableOpacity
        style={[
          styles.button,
          loading && styles.disabledButton,
        ]}
        onPress={() => void handleConnect()}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            Connect with Spotify
          </Text>
        )}
      </TouchableOpacity>


      <TouchableOpacity onPress={handleLogout}>

        <Text style={{ color: 'white', marginTop: 20 }}>

          Log Out

        </Text>

      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#121212',
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },

  description: {
    fontSize: 16,
    color: '#B3B3B3',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },

  button: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    minWidth: 220,
    alignItems: 'center',
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
