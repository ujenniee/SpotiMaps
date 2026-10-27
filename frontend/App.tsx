import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import LocationPermissionScreen from './src/screens/LocationPermissionScreen';

// Which screen to show: login first, then location, then the app
type Step = 'login' | 'location' | 'app';

export default function App() {
  const [step, setStep] = useState<Step>('login');

  const goToLocation = useCallback(() => setStep('location'), []);
  const goToApp = useCallback(() => setStep('app'), []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {step === 'login' && <LoginScreen onLogin={goToLocation} />}
      {step === 'location' && <LocationPermissionScreen onDone={goToApp} />}
      {step === 'app' && (
        // Temporary: the tabs will go here later
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text>You made it into the app!</Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}