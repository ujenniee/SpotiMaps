import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colors } from './src/theme';
import ActionButton from './src/components/ActionButton';
import LoginScreen from './src/screens/LoginScreen';
import LocationPermissionScreen from './src/screens/LocationPermissionScreen';
import MapScreen from './src/screens/MapScreen';
import RouteScreen from './src/screens/RouteScreen';
import FriendScreen from './src/screens/FriendScreen';
import PrivacyScreen from './src/screens/PrivacyScreen';

import { getCurrentLocation, type GPSReading } from './src/services/LocationService';
import { getSupabaseSession } from './src/services/SupabaseAuthService';

const SKIP_LOGIN_FOR_TESTING = false;

const Tab = createBottomTabNavigator();

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TAB_ICONS: Record<string, IconName> = {
  Map: 'map-marker',
  'On-The-Go': 'map-marker-path',
  Friends: 'account-group',
  Settings: 'cog',
  'GPS Test': 'crosshairs-gps',
};

type Step = 'login' | 'location' | 'app';

function GpsTestScreen() {
  const [gpsReading, setGpsReading] = useState<GPSReading | null>(null);
  const [gpsMessage, setGpsMessage] = useState('');

  const testGPS = useCallback(async () => {
    setGpsMessage('Getting GPS location...');
    const reading = await getCurrentLocation();
    if (reading) {
      setGpsReading(reading);
      setGpsMessage('GPS location received!');
    } else {
      setGpsReading(null);
      setGpsMessage('Could not get GPS location.');
    }
  }, []);

  return (
    <View style={styles.appContainer}>
      <ActionButton label="Test GPS" onPress={testGPS} />
      <Text style={styles.statusText}>{gpsMessage}</Text>
      {gpsReading && (
        <View style={styles.readingContainer}>
          <Text style={styles.readingText}>Latitude: {gpsReading.latitude}</Text>
          <Text style={styles.readingText}>Longitude: {gpsReading.longitude}</Text>
          <Text style={styles.readingText}>
            Timestamp: {new Date(gpsReading.timestamp).toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function App() {
  const [step, setStep] = useState<Step>(SKIP_LOGIN_FOR_TESTING ? 'app' : 'login');
  const [isCheckingSession, setIsCheckingSession] = useState(!SKIP_LOGIN_FOR_TESTING);

  useEffect(() => {
    if (SKIP_LOGIN_FOR_TESTING) {
      return undefined;
    }

    let isMounted = true;

    async function restoreSession() {
      try {
        const session = await getSupabaseSession();
        if (!isMounted) return;
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
          <ActivityIndicator size="large" color={colors.spotifyGreen} />
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
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarStyle: { backgroundColor: colors.sage },
              tabBarActiveTintColor: colors.text,
              tabBarInactiveTintColor: colors.textMuted,
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name={TAB_ICONS[route.name]} color={color} size={size} />
              ),
            })}
          >
            <Tab.Screen name="Map" component={MapScreen} />
            <Tab.Screen name="On-The-Go" component={RouteScreen} />
            <Tab.Screen name="Friends" component={FriendScreen} />
            <Tab.Screen name="Settings" component={PrivacyScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.text,
  },
  appContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    paddingHorizontal: 24,
    gap: 16,
  },
  statusText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  readingContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  readingText: {
    color: colors.text,
    fontSize: 15,
    marginBottom: 4,
  },
});