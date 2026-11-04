import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, getGenreColor } from '../theme';
import type { MapPlace } from '../data/mockData';
import { getRankedSongs, getTotalPlays } from '../utils/placeStats';

type Props = {
  place: MapPlace;
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
};

export default function SongCardScreen({ place, isExpanded, onToggle, onClose }: Props) {
  const songs = getRankedSongs(place);

  return (
    <View style={styles.card}>
      {/* Tapping the header folds the card down or brings it back up */}
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={isExpanded ? 'Collapse song card' : 'Expand song card'}
      >
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{place.name}</Text>
            <Text style={styles.subtitle}>{place.area}</Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={styles.closeButton}
            accessibilityLabel="Close song card"
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total plays</Text>
          <Text style={styles.summaryValue}>{getTotalPlays(place)}</Text>
        </View>
      </Pressable>

      {isExpanded && (
        <ScrollView
          style={styles.songList}
          contentContainerStyle={styles.songListContent}
          nestedScrollEnabled
        >
          {songs.map((song, index) => (
            <View
              key={`${song.title}-${song.artist}`}
              style={[styles.songRow, index === 0 && styles.songRowTop]}
            >
              <View style={[styles.rankBubble, { backgroundColor: getGenreColor(song.genre) }]}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>

              <View style={styles.songMeta}>
                <Text style={styles.songTitle}>{song.title}</Text>
                <Text style={styles.songArtist}>{song.artist}</Text>
              </View>

              <View style={styles.playColumn}>
                <Text style={styles.playCount}>{song.plays}</Text>
                <Text style={styles.playLabel}>plays</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D0D0D0',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
  },
  closeButton: {
    paddingLeft: 12,
  },
  closeText: {
    fontSize: 18,
    color: colors.textMuted,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  songList: {
    maxHeight: 240,
    marginTop: 12,
  },
  songListContent: {
    gap: 10,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
    paddingTop: 10,
  },
  songRowTop: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  rankBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  songMeta: {
    flex: 1,
  },
  songTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  songArtist: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  playColumn: {
    alignItems: 'flex-end',
  },
  playCount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  playLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'lowercase',
  },
});