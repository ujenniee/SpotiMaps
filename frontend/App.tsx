
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import LocationPermissionScreen from './src/screens/LocationPermissionScreen';
import {
  getCurrentLocation,
  startBackgroundTracking,
  stopBackgroundTracking,
  isBackgroundTracking,
  type GPSReading,
} from './src/services/LocationService';
import SpotifyConnectScreen from './src/screens/SpotifyConnectScreen';
import Constants from 'expo-constants';


import { getSupabaseSession } from './src/services/SupabaseAuthService';

// Which screen to show: login first, then location, then the app
type Step = 'login' | 'spotify' | 'location' | 'app';

export default function App() {
  const [step, setStep] = useState<Step>('login');

  const [gpsReading, setGpsReading] = useState<GPSReading | null>(null);
  const [gpsMessage, setGpsMessage] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [readingCount, setReadingCount] = useState<number | null>(null);
  useEffect(() => {
    const checkTracking = async () => {
      const tracking = await isBackgroundTracking();
      setIsTracking(tracking);
    };
  
    void checkTracking();
  }, []);
  const handleStartTracking = async () => {
    if (Constants.appOwnership === 'expo') {

      setGpsMessage('Background GPS tracking requires a development build.');
  
      return;
  
    }
    const started = await startBackgroundTracking();
  
    if (started) {
      setIsTracking(true);
      setReadingCount(null);
      setGpsMessage('Tracking GPS locations in the background...');
    } else {
      setGpsMessage('Could not start background tracking. Check location permissions.');
    }
  };
  
  const handleStopTracking = async () => {
    const readings = await stopBackgroundTracking();
  
    console.log('GPS readings:', readings);
  
    setIsTracking(false);
    setReadingCount(readings.length);
    setGpsMessage('GPS tracking stopped.');
  };

  const testGPS = async () => {
    setGpsMessage('Getting GPS location...');

    const reading = await getCurrentLocation();

    if (reading) {
      setGpsReading(reading);
      setGpsMessage('GPS location received!');
    } else {
      setGpsReading(null);
      setGpsMessage('Could not get GPS location.');
    }
  };
  

  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const session = await getSupabaseSession();

        if (!isMounted) {
          return;
        }

        setStep(session ? 'spotify' : 'login');
      } catch (error) {
        console.warn('Failed to restore Supabase session', error);

        if (isMounted) {
          setStep('login');
        }
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const goToLocation = useCallback(() => setStep('location'), []);
  const goToApp = useCallback(() => setStep('app'), []);
  const goToSpotify = useCallback(() => setStep('spotify'), []);
  useEffect(() => {
    if (step !== 'app' || Constants.appOwnership === 'expo') return;
  
    const startAutomaticTracking = async () => {
      const alreadyTracking = await isBackgroundTracking();
  
      if (alreadyTracking) {
        setIsTracking(true);
        return;
      }
  
      const started = await startBackgroundTracking();
  
      setIsTracking(started);
  
      if (started) {
        setGpsMessage('Automatic GPS tracking is active.');
      } else {
        setGpsMessage(
          'Automatic tracking could not start. Check location permissions.'
        );
      }
    };
  
    void startAutomaticTracking();
  }, [step]);

  if (isCheckingSession) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
          <Text style={styles.loadingText}>Loading your session...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {step === 'login' && <LoginScreen onLogin={goToSpotify} />}

      {step === 'spotify' && (
        <SpotifyConnectScreen onConnected={goToLocation} />
      )}
      {step === 'location' && <LocationPermissionScreen onDone={goToApp} />}
      {step === 'app' && (
        // Temporary: the tabs will go here later
        <View
  style={{
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  }}
>
          <Text>You made it into the app!</Text>
          <Button title="Test GPS" onPress={testGPS} />
          <Button
          title="Start Tracking"
          onPress={handleStartTracking}
          disabled={isTracking}
        />

        <Button
          title="Stop Tracking"
          onPress={handleStopTracking}
          disabled={!isTracking}
        />

        {readingCount !== null && (
          <Text>GPS readings collected: {readingCount}</Text>
        )}

          <Text>{gpsMessage}</Text>

          {gpsReading && (

            <View>

              <Text>Latitude: {gpsReading.latitude}</Text>

              <Text>Longitude: {gpsReading.longitude}</Text>

              <Text>

                Timestamp: {new Date(gpsReading.timestamp).toLocaleString()}

              </Text>

            </View>

          )}
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF3E0',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#000000',
  },
});