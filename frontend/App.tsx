import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';

import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { StatusBar } from 'expo-status-bar';

import { NavigationContainer } from '@react-navigation/native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import Constants from 'expo-constants';

import { colors } from './src/theme';

import ActionButton from './src/components/ActionButton';
import LocationAvailabilityAlert from './src/components/LocationAvailabilityAlert';

import LoginScreen from './src/screens/LoginScreen';

import SpotifyConnectScreen from './src/screens/SpotifyConnectScreen';

import LocationPermissionScreen from './src/screens/LocationPermissionScreen';

import MapScreen from './src/screens/MapScreen';

import RouteScreen from './src/screens/RouteScreen';

import FriendScreen from './src/screens/FriendScreen';

import PrivacyScreen from './src/screens/PrivacyScreen';

import {
  getCurrentLocation,
  startTracking,
  stopTracking,
  startBackgroundTracking,
  stopBackgroundTracking,
  isBackgroundTracking,
  setGPSOwner,
  clearGPSOwner,
  syncPendingGPSReadings,
  type GPSReading,
} from './src/services/LocationService';
import {
  getPrivacySettings,
  updatePrivacySettings,
  type PrivacySettings,
  type PrivacySettingsUpdate,
} from './src/services/PrivacySettingsService';

import { getSupabaseSession } from './src/services/SupabaseAuthService';
import { supabase } from './src/lib/supabase';

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

type Step = 'login' | 'spotify' | 'location' | 'app';

// GPS testing screen

type GpsTestScreenProps = {
  trackingEnabled: boolean;
  onTrackingChange: (enabled: boolean) => Promise<void>;
};

function GpsTestScreen({ trackingEnabled, onTrackingChange }: GpsTestScreenProps) {

  const [gpsReading, setGpsReading] = useState<GPSReading | null>(null);

  const [gpsMessage, setGpsMessage] = useState('');

  const [readingCount, setReadingCount] = useState<number | null>(null);

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

  const handleTrackingChange = async () => {
    try {
      await onTrackingChange(!trackingEnabled);
      setReadingCount(null);
      setGpsMessage(trackingEnabled ? 'GPS tracking stopped.' : 'GPS tracking enabled.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update GPS tracking.';
      setGpsMessage(message);
    }
  };

  return (

    <View style={styles.appContainer}>

      <ActionButton label="Test GPS" onPress={testGPS} />

      <ActionButton
        label={
          trackingEnabled
            ? 'Stop GPS Tracking'
            : 'Start GPS Tracking'
        }
        onPress={handleTrackingChange}
      />

      <Text style={styles.statusText}>{gpsMessage}</Text>

      {readingCount !== null && (

        <Text style={styles.readingText}>

          Recorded GPS readings: {readingCount}

        </Text>

      )}

      {gpsReading && (

        <View style={styles.readingContainer}>

          <Text style={styles.readingText}>

            Latitude: {gpsReading.latitude}

          </Text>

          <Text style={styles.readingText}>

            Longitude: {gpsReading.longitude}

          </Text>

          <Text style={styles.readingText}>

            Timestamp: {new Date(gpsReading.timestamp).toLocaleString()}

          </Text>

        </View>

      )}

    </View>

  );

}

export default function App() {

  const [step, setStep] = useState<Step>(

    SKIP_LOGIN_FOR_TESTING ? 'app' : 'login'

  );

  const [isCheckingSession, setIsCheckingSession] = useState(

    !SKIP_LOGIN_FOR_TESTING

  );
  const [gpsOwnerId, setGpsOwnerId] = useState<string | null>(null);
  const logoutRequested = useRef(false);

  const [privacySettings, setPrivacySettings] = useState<PrivacySettings | null>(null);
  const [isPrivacySettingsLoading, setIsPrivacySettingsLoading] = useState(false);
  const [privacySettingsError, setPrivacySettingsError] = useState<string | null>(null);
  const [privacySettingsReloadKey, setPrivacySettingsReloadKey] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState<string | null>(null);
  const logoutRequested = useRef(false);
  const isLocationTrackingEnabled = privacySettings?.location_tracking_enabled;

  const cleanupGPSTracking = useCallback(async () => {
    // Stop foreground tracking
    stopTracking();

    // Stop background tracking
    if (await isBackgroundTracking()) {
      await stopBackgroundTracking();
    }

    // Remove the active owner, not their saved GPS history
    await clearGPSOwner();
    setGpsOwnerId(null);
    setPrivacySettings(null);
    setPrivacySettingsError(null);
    setTrackingStatus(null);

    console.log('GPS tracking stopped and owner cleared.');
  }, []);

  const savePrivacySettings = useCallback(async (updates: PrivacySettingsUpdate) => {
    const savedSettings = await updatePrivacySettings(supabase, updates);
    setPrivacySettings(savedSettings);
    setPrivacySettingsError(null);
  }, []);

  const setTrackingEnabled = useCallback(async (enabled: boolean) => {
    await savePrivacySettings({ location_tracking_enabled: enabled });
  }, [savePrivacySettings]);

  // Restore Supabase login session

  useEffect(() => {

    if (SKIP_LOGIN_FOR_TESTING) {

      return;

    }

    let isMounted = true;

    async function restoreSession() {

      try {

        const session = await getSupabaseSession();

        if (!isMounted) {

          return;

        }

        setStep(
          session
            ? Constants.appOwnership === 'expo'
              ? 'location'
              : 'spotify'
            : 'login'
        );

      } catch (error) {

        console.warn('Failed to restore Supabase session:', error);

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

  // Screen navigation
  const goToLogin = useCallback(async () => {
    try {
      logoutRequested.current = true;
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      await cleanupGPSTracking();
      setStep('login');
    } catch (error) {
      logoutRequested.current = false;
      console.error('Failed to sign out or clean up GPS tracking:', error);
      throw error;
    } finally {
      logoutRequested.current = false;
    }
  }, [cleanupGPSTracking]);

  const goToSpotify = useCallback(() => {
    if (Constants.appOwnership === 'expo') {
      setStep('location');
    } else {
      setStep('spotify');
    }
  }, []);

  const goToLocation = useCallback(() => {

    setStep('location');

  }, []);

  const goToApp = useCallback(() => {

    setStep('app');

  }, []);

  useEffect(() => {
    if (step === 'login') {
      setPrivacySettings(null);
      setIsPrivacySettingsLoading(false);
      setPrivacySettingsError(null);
      return;
    }

    let cancelled = false;
    setIsPrivacySettingsLoading(true);
    setPrivacySettingsError(null);

    const loadSettings = async () => {
      try {
        const settings = await getPrivacySettings(supabase);
        if (cancelled) return;

        if (!settings.location_tracking_enabled) {
          stopTracking();
          await stopBackgroundTracking();
        }
        if (!cancelled) {
          setPrivacySettings(settings);
        }
      } catch (error) {
        if (!cancelled) {
          setPrivacySettings(null);
          setPrivacySettingsError(
            error instanceof Error ? error.message : 'Could not load privacy settings.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsPrivacySettingsLoading(false);
        }
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [step, privacySettingsReloadKey]);
  // Stop GPS tracking when the Supabase user signs out
useEffect(() => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      if (logoutRequested.current) {
        return;
      }

      Alert.alert(
        'Session Expired',
        'Your SpotiMaps session expired. Log in again to continue.',
        [{ text: 'Log In' }],
      );
      void cleanupGPSTracking()
        .then(() => {
          setStep('login');
        })
        .catch((error) => {
          console.error('Failed to clean up GPS after sign-out:', error);
        });
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}, [cleanupGPSTracking]);

  // Identify the Supabase user before starting automatic GPS tracking
useEffect(() => {
  if (step !== 'app') {
    setGpsOwnerId(null);
    return;
  }

  let cancelled = false;

  const identifyGPSOwner = async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (error || !user) {
        console.warn('Cannot start GPS tracking without a logged-in user.');
        setGpsOwnerId(null);
        return;
      }

      if (cancelled) return;

      await setGPSOwner(user.id);

      if (cancelled) return;

      setGpsOwnerId(user.id);
      console.log('GPS owner identified successfully.');
    } catch (error) {
      console.error('Failed to identify GPS owner:', error);

      if (!cancelled) {
        setGpsOwnerId(null);
      }
    }
  };

  void identifyGPSOwner();

  return () => {
    cancelled = true;
  };
}, [step]);


    // Automatically start foreground GPS tracking in Expo Go
    useEffect(() => {
      if (
        step !== 'app' ||
        Constants.appOwnership !== 'expo' ||
        !gpsOwnerId ||
        isLocationTrackingEnabled === undefined
      ) {
        return;
      }

      let cancelled = false;

      if (!isLocationTrackingEnabled) {
        stopTracking();
        setTrackingStatus(null);
        return () => {
          cancelled = true;
          stopTracking();
        };
      }

      const startAutomaticForegroundTracking = async () => {
        try {
          const started = await startTracking(gpsOwnerId);

          if (cancelled) {
            if (started) stopTracking();
            return;
          }

          if (started) {
            setTrackingStatus(null);
            console.log('Automatic foreground GPS tracking started.');
          } else {
            setTrackingStatus('Could not start tracking. Check location permission.');
            console.warn('Automatic foreground GPS tracking could not start.');
          }
        } catch (error) {
          setTrackingStatus(error instanceof Error ? error.message : 'Failed to start GPS tracking.');
          console.warn('Automatic foreground GPS tracking failed:', error);
        }
      };

      void startAutomaticForegroundTracking();

      return () => {
        cancelled = true;
        stopTracking();
      };
    }, [step, gpsOwnerId, isLocationTrackingEnabled]);

  // Automatically start background GPS tracking

// Automatically start background GPS tracking
useEffect(() => {
  if (
    step !== 'app' ||
    Constants.appOwnership === 'expo' ||
    !gpsOwnerId ||
    isLocationTrackingEnabled === undefined
  ) {
    return;
  }

  let cancelled = false;

  const startAutomaticTracking = async () => {
    try {
      if (!isLocationTrackingEnabled) {
        await stopBackgroundTracking();
        setTrackingStatus(null);
        return;
      }

      const alreadyTracking = await isBackgroundTracking();
      if (cancelled) return;

      if (!alreadyTracking) {
        const started = await startBackgroundTracking();

        if (cancelled && started) {
          await stopBackgroundTracking();
          return;
        }

        if (!started) {
          setTrackingStatus('Could not start tracking. Check background location permission.');
          console.warn('Automatic GPS tracking could not start.');
        } else {
          setTrackingStatus(null);
        }
      } else {
        setTrackingStatus(null);
      }
    } catch (error) {
      setTrackingStatus(error instanceof Error ? error.message : 'Failed to start GPS tracking.');
      console.warn('Automatic GPS tracking failed:', error);
    }
  };

  void startAutomaticTracking();

  return () => {
    cancelled = true;
  };
}, [step, gpsOwnerId, isLocationTrackingEnabled]);
  // Automatically upload saved GPS readings to Supabase
  useEffect(() => {
    if (step !== 'app' || !gpsOwnerId) {
      return;
    }

    let cancelled = false;

    const syncGPS = async () => {
      if (cancelled) {
        return;
      }

      try {
        await syncPendingGPSReadings(supabase);
      } catch (error) {
        console.error('Automatic GPS sync failed:', error);
      }
    };

    // Upload saved readings when the user enters the app
    void syncGPS();

    // Check for new GPS readings every 30 seconds
    const intervalId = setInterval(() => {
      void syncGPS();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [step, gpsOwnerId]);

  // Loading screen

  if (isCheckingSession) {

    return (

      <SafeAreaProvider>

        <StatusBar style="dark" />

        <View style={styles.loadingContainer}>

          <ActivityIndicator

            size="large"

            color={colors.spotifyGreen}

          />

          <Text style={styles.loadingText}>

            Loading your session...

          </Text>

        </View>

      </SafeAreaProvider>

    );

  }

  return (

    <SafeAreaProvider>

      <StatusBar style="dark" />
      <LocationAvailabilityAlert enabled={step === 'app'} />

      {/* Login */}

      {step === 'login' && (

        <LoginScreen onLogin={goToSpotify} />

      )}

      {/* Spotify authentication */}

      {step === 'spotify' && (

        <SpotifyConnectScreen
        onConnected={goToLocation}
        onLogout={goToLogin}
        />

      )}

      {/* Location permissions */}

      {step === 'location' && (

        <LocationPermissionScreen onDone={goToApp} />

      )}

      {/* Main app */}

      {step === 'app' && (

        <NavigationContainer>

          <Tab.Navigator

            screenOptions={({ route }) => ({

              headerShown: false,

              tabBarStyle: {

                backgroundColor: colors.sage,

              },

              tabBarActiveTintColor: colors.text,

              tabBarInactiveTintColor: colors.textMuted,

              tabBarIcon: ({ color, size }) => (

                <MaterialCommunityIcons

                  name={TAB_ICONS[route.name]}

                  color={color}

                  size={size}

                />

              ),

            })}

          >

            <Tab.Screen

              name="Map"

              component={MapScreen}

            />

            <Tab.Screen name="On-The-Go">
              {() => (
                <RouteScreen
                  isTracking={isLocationTrackingEnabled ?? false}
                  isSettingsLoading={isPrivacySettingsLoading || !privacySettings}
                  trackingStatus={trackingStatus}
                  onTrackingChange={setTrackingEnabled}
                />
              )}
            </Tab.Screen>

            <Tab.Screen

              name="Friends"

              component={FriendScreen}

            />

            <Tab.Screen name="Settings">
              {() => (
                <PrivacyScreen
                  settings={privacySettings}
                  isSettingsLoading={isPrivacySettingsLoading}
                  settingsError={privacySettingsError}
                  trackingStatus={trackingStatus}
                  onSave={savePrivacySettings}
                  onRetry={() => setPrivacySettingsReloadKey((key) => key + 1)}
                  onLogout={goToLogin}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="GPS Test">
              {() => (
                <GpsTestScreen
                  trackingEnabled={isLocationTrackingEnabled ?? false}
                  onTrackingChange={setTrackingEnabled}
                />
              )}
            </Tab.Screen>

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