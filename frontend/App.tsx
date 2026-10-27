
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import LocationPermissionScreen from './src/screens/LocationPermissionScreen';
import { getCurrentLocation, type GPSReading } from './src/services/LocationService';
import { getSupabaseSession } from './src/services/SpotifyAuthService';

// Which screen to show: login first, then location, then the app
type Step = 'login' | 'location' | 'app';

export default function App() {
  const [step, setStep] = useState<Step>('login');

  const [gpsReading, setGpsReading] = useState<GPSReading | null>(null);
  const [gpsMessage, setGpsMessage] = useState('');

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

        setStep(session ? 'location' : 'login');
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
      {step === 'login' && <LoginScreen onLogin={goToLocation} />}
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