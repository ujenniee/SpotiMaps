import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { connectSpotifyAccount } from '../services/SpotifyAuthService';
import { supabase } from '../lib/supabase';



type SpotifyConnectScreenProps = {
  onConnected: () => void;
  onLogout: () => void;
};

export default function SpotifyConnectScreen({
  onConnected,
  onLogout,
}: SpotifyConnectScreenProps) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const result = await connectSpotifyAccount();

      if (result?.success) {
        onConnected();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong connecting Spotify.';

      Alert.alert('Spotify Connection Failed', message);
    } finally {

      setLoading(false);

    }

  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
  
    if (error) {
      Alert.alert('Log Out Failed', error.message);
      return;
    }
  
    onLogout();
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
        onPress={handleConnect}
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