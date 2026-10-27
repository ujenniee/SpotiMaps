import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* Login only for now; tab navigation gets added back later */}
      <LoginScreen onLogin={() => {}} />
    </SafeAreaProvider>
  );
}