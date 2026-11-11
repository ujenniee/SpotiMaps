import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PrivacySettings, PrivacySettingsUpdate } from '../services/PrivacySettingsService';
import { colors } from '../theme';

type Props = {
  settings: PrivacySettings | null;
  isSettingsLoading: boolean;
  settingsError: string | null;
  trackingStatus: string | null;
  onSave: (updates: PrivacySettingsUpdate) => Promise<void>;
  onRetry: () => void;
  onLogout: () => Promise<void>;
};

// Light grey panels from the Settings Figma frame
const PANEL_COLOR = '#A3A3A3';
const SELECTED_COLOR = '#6B6F80';

// TODO: replace with the real Spotify name once Harley's connection check exists
const SPOTIFY_DISPLAY_NAME = 'harley.z';

// TODO: replace with the user's real places from Supabase
const PLACES = [
  'Bill & Melinda Gates Center',
  'Paul G. Allen Center of Computer Science',
  'Husky Union Building',
  'IMA',
  'Odegaard Library',
  'The Quad',
];

export default function PrivacyScreen({
  settings,
  isSettingsLoading,
  settingsError,
  trackingStatus,
  onSave,
  onRetry,
  onLogout,
}: Props) {
  const [hiddenPlaces, setHiddenPlaces] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggleHiddenPlace = (place: string) => {
    setHiddenPlaces((current) => ({ ...current, [place]: !current[place] }));
  };

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

  const mapVisibility = settings?.map_visibility ?? 'private';
  const isTrackingEnabled = settings?.location_tracking_enabled ?? false;
  const settingsDisabled = !settings || isSettingsLoading || isSaving;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {/* Spotify connection */}
        <Text style={styles.sectionHeader}>SPOTIFY</Text>
        <View style={styles.panel}>
          <Text style={styles.rowTitle}>Connected as {SPOTIFY_DISPLAY_NAME}</Text>
          <View style={styles.spotifyRow}>
            <Text style={[styles.rowNote, styles.spotifyNote]}>
              SpotiMaps can read your recently played tracks only
            </Text>
            {/* UI only for now: disconnecting comes with Harley's Spotify work */}
            <Pressable
              style={({ pressed }) => [styles.lightButton, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.lightButtonText}>Disconnect</Text>
            </Pressable>
          </View>
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
                ? 'Your map remains visible only to you'
                : 'Saved for future friend sharing; maps remain private until sharing is implemented'}
            </Text>
          </View>
        </View>

        {/* Hide places from friends */}
        <Text style={styles.sectionHeader}>HIDE PLACES FROM FRIENDS</Text>
        <View style={styles.panelNoPadding}>
          {PLACES.map((place, index) => (
            <View
              key={place}
              style={[styles.row, styles.placeRow, index > 0 && styles.placeRowBorder]}
            >
              <Text style={[styles.rowTitle, styles.placeName]}>{place}</Text>
              <Switch
                value={hiddenPlaces[place] ?? false}
                onValueChange={() => toggleHiddenPlace(place)}
                trackColor={{ false: '#7A7A85', true: colors.spotifyGreen }}
                accessibilityLabel={`Hide ${place} from friends`}
              />
            </View>
          ))}
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
    marginTop: 4,
  },
  spotifyNote: {
    flex: 1,
    marginRight: 12,
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
    color: colors.error,
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
    color: '#5F6270',
    marginTop: 10,
  },
  placeRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  placeRowBorder: {
    borderTopWidth: 1,
    borderTopColor: SELECTED_COLOR,
  },
  placeName: {
    flex: 1,
    marginRight: 12,
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