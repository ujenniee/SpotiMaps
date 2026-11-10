import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

type MapVisibility = 'private' | 'friends';

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

// PrivacyScreen from the design doc (the "Settings" tab), built from the
// "Privacy/Settings" Figma frame. Choices are only kept on the phone for now;
// the next step saves them to Supabase.
export default function PrivacyScreen() {
  // Maps are private by default, per the design doc
  const [mapVisibility, setMapVisibility] = useState<MapVisibility>('private');
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(true);
  const [hiddenPlaces, setHiddenPlaces] = useState<Record<string, boolean>>({});

  const toggleHiddenPlace = (place: string) => {
    setHiddenPlaces((current) => ({ ...current, [place]: !current[place] }));
  };

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
          <View style={[styles.row, styles.panelInner]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Location tracking</Text>
              <Text style={styles.rowNote}>
                Places are recorded only while this is on and iPhone location access is allowed
              </Text>
            </View>
            <Switch
              value={isTrackingEnabled}
              onValueChange={setIsTrackingEnabled}
              trackColor={{ false: colors.input, true: colors.spotifyGreen }}
              accessibilityLabel="Location tracking"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.panelInner}>
            <Text style={styles.rowTitle}>Who can see my map</Text>
            <View style={styles.segmented} accessibilityRole="radiogroup">
              <Pressable
                style={[styles.segment, mapVisibility === 'private' && styles.segmentActive]}
                onPress={() => setMapVisibility('private')}
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
                onPress={() => setMapVisibility('friends')}
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
  pressed: {
    opacity: 0.7,
  },
});