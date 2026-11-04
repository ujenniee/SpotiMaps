import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

// PrivacyScreen from the design doc (the "Settings" tab).
// Temporary until the real Settings screen is built next week.
export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.note}>Spotify, privacy, and hidden places go here.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 34,
    fontWeight: '500',
    color: colors.text,
    marginTop: 16,
  },
  note: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
});