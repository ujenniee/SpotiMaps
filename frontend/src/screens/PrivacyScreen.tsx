import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UsernameSection from '../components/UsernameSection';
import type { PrivacySettings, PrivacySettingsUpdate } from '../services/PrivacySettingsService';
import { colors } from '../theme';

type Props = {
  settings: PrivacySettings | null;
  isSettingsLoading: boolean;
  settingsError: string | null;
  trackingStatus: string | null;
  spotifyDisplayName?: string | null;
  spotifyConnected?: boolean;
  onSave: (updates: PrivacySettingsUpdate) => Promise<void>;
  onRetry: () => void;
  onLogout: () => Promise<void>;
  onDisconnectSpotify?: () => Promise<void>;
};

const PANEL_COLOR = '#A3A3A3';
const SELECTED_COLOR = '#6B6F80';

export default function PrivacyScreen({
  settings,
  isSettingsLoading,
  settingsError,
  trackingStatus,
  spotifyDisplayName,
  spotifyConnected = false,
  onSave,
  onRetry,
  onLogout,
  onDisconnectSpotify,
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);

  // App.tsx tells us whether Spotify is connected; the name alone isn't reliable
  const isSpotifyConnected = spotifyConnected || Boolean(spotifyDisplayName?.trim());

  const save = async (updates: PrivacySettingsUpdate) => {
    if (isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(updates);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save privacy settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await onLogout();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not log out.');
    }
  };

  const disconnectSpotify = async () => {
    if (!onDisconnectSpotify) return;

    setIsDisconnecting(true);
    setSpotifyError(null);
    try {
      await onDisconnectSpotify();
    } catch (error) {
      console.warn('Spotify disconnect failed:', error);
      setSpotifyError('Couldn’t disconnect Spotify. Please try again.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Ask first, so nobody disconnects by accident
  const confirmDisconnect = () => {
    Alert.alert(
      'Disconnect Spotify?',
      'SpotiMaps will stop adding new songs to your map. Your existing map stays. You can reconnect anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => void disconnectSpotify() },
      ],
    );
  };

  const mapVisibility = settings?.map_visibility ?? 'private';
  const isTrackingEnabled = settings?.location_tracking_enabled ?? false;
  const settingsDisabled = !settings || isSettingsLoading || isSaving;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>
        <UsernameSection />

        {/* Spotify connection */}
        <Text style={styles.sectionHeader}>SPOTIFY</Text>
        <View style={styles.panel}>
          <View style={styles.spotifyRow}>
            <View style={styles.spotifyNote}>
              <Text style={styles.rowTitle}>
                {isSpotifyConnected ? 'Spotify connected' : 'Spotify not connected'}
              </Text>
              <Text style={styles.rowNote}>
                {isSpotifyConnected
                  ? 'SpotiMaps can read your recently played tracks only'
                  : 'Connect Spotify so your songs can show up on your map'}
              </Text>
            </View>
            {isSpotifyConnected && onDisconnectSpotify ? (
              <Pressable
                onPress={confirmDisconnect}
                disabled={isDisconnecting}
                style={({ pressed }) => [
                  styles.lightButton,
                  (pressed || isDisconnecting) && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Disconnect Spotify"
              >
                <Text style={styles.lightButtonText}>
                  {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {spotifyError ? <Text style={styles.spotifyErrorText}>{spotifyError}</Text> : null}
        </View>

        {/* Privacy */}
        <Text style={styles.sectionHeader}>PRIVACY</Text>
        <View style={styles.panelNoPadding}>
          {isSettingsLoading ? (
            <View style={styles.messageRow}>
              <ActivityIndicator color={colors.spotifyGreen} />
              <Text style={styles.rowNote}>Loading privacy settings…</Text>
            </View>
          ) : settingsError ? (
            <View style={styles.messageRow}>
              <Text style={styles.errorText}>{settingsError}</Text>
              <Pressable
                onPress={onRetry}
                accessibilityRole="button"
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          <View style={[styles.row, styles.panelInner]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Location tracking</Text>
              <Text style={styles.rowNote}>
                Places are recorded only while this is on and iPhone location access is allowed
              </Text>
            </View>
            <Switch
              value={isTrackingEnabled}
              onValueChange={(value) => void save({ location_tracking_enabled: value })}
              disabled={settingsDisabled}
              trackColor={{ false: colors.input, true: colors.spotifyGreen }}
              accessibilityLabel="Location tracking"
            />
          </View>
          {trackingStatus ? <Text style={styles.statusText}>{trackingStatus}</Text> : null}

          <View style={styles.divider} />

          <View style={styles.panelInner}>
            <Text style={styles.rowTitle}>Who can see my map</Text>
            <View
              style={[styles.segmented, settingsDisabled && styles.disabled]}
              accessibilityRole="radiogroup"
            >
              <Pressable
                style={[styles.segment, mapVisibility === 'private' && styles.segmentActive]}
                onPress={() => void save({ map_visibility: 'private' })}
                disabled={settingsDisabled}
                accessibilityRole="radio"
                accessibilityState={{ selected: mapVisibility === 'private' }}
              >
                <Text
                  style={[styles.segmentText, mapVisibility === 'private' && styles.segmentTextActive]}
                >
                  Private
                </Text>
              </Pressable>
              <Pressable
                style={[styles.segment, mapVisibility === 'friends' && styles.segmentActive]}
                onPress={() => void save({ map_visibility: 'friends' })}
                disabled={settingsDisabled}
                accessibilityRole="radio"
                accessibilityState={{ selected: mapVisibility === 'friends' }}
              >
                <Text
                  style={[styles.segmentText, mapVisibility === 'friends' && styles.segmentTextActive]}
                >
                  Friends
                </Text>
              </Pressable>
            </View>
            <Text style={styles.visibilityNote}>
              {mapVisibility === 'private'
                ? 'Only you can see your map'
                : 'Only friends you have accepted can see your map'}
            </Text>
          </View>
        </View>

        <View style={styles.logoutSection}>
          <Pressable
            onPress={() => void handleLogout()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
          >
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 40,
    fontWeight: '500',
    color: colors.text,
    marginTop: 12,
  },
  sectionHeader: {
    fontSize: 17,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
  },
  panel: {
    backgroundColor: PANEL_COLOR,
    padding: 14,
  },
  panelNoPadding: {
    backgroundColor: PANEL_COLOR,
  },
  panelInner: {
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    color: colors.text,
  },
  rowNote: {
    fontSize: 14,
    color: colors.text,
    marginTop: 6,
  },
  spotifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spotifyNote: {
    flex: 1,
    marginRight: 12,
  },
  spotifyErrorText: {
    color: colors.error,
    fontSize: 13,
    marginTop: 10,
  },
  lightButton: {
    backgroundColor: '#E6E6E6',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  lightButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: SELECTED_COLOR,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  retryButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#E6E6E6',
  },
  retryText: {
    color: colors.text,
    fontSize: 13,
  },
  statusText: {
    color: '#2B2D33',
    fontSize: 13,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  disabled: {
    opacity: 0.6,
  },
  segmented: {
    flexDirection: 'row',
    marginTop: 10,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
  },
  segmentActive: {
    backgroundColor: SELECTED_COLOR,
  },
  segmentText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: '#D9D9D9',
  },
  visibilityNote: {
    fontSize: 13,
    color: '#2B2D33',
    marginTop: 10,
  },
  logoutSection: {
    paddingTop: 24,
    paddingBottom: 12,
  },
  logoutButton: {
    backgroundColor: '#D9534F',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});