import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SmallActionButton from '../components/SmallActionButton';
import { fetchFriendRequests, fetchFriends, type Friend, type FriendRequest } from '../services/FriendService';
import { colors } from '../theme';

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: color }]}>
      <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export default function FriendScreen() {
  const [search, setSearch] = useState('');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const [nextRequests, nextFriends] = await Promise.all([
        fetchFriendRequests(),
        fetchFriends(),
      ]);

      if (isMounted) {
        setRequests(nextRequests);
        setFriends(nextFriends);
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredFriends = friends.filter((friend) => {
    const normalizedSearch = search.trim().toLowerCase();
    return normalizedSearch.length === 0 || friend.name.toLowerCase().includes(normalizedSearch);
  });

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Friends</Text>

        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by username"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.sectionHeader}>REQUESTS</Text>
        <View style={styles.panel}>
          {requests.map((request, index) => (
            <View key={request.id} style={[styles.row, index > 0 && styles.rowBorder]}>
              <Avatar name={request.name} color={request.color} />
              <Text style={styles.name}>{request.name.toUpperCase()}</Text>
              {request.direction === 'incoming' ? (
                <View style={styles.buttonGroup}>
                  <SmallActionButton label="Accept" variant="light" />
                  <SmallActionButton label="Decline" variant="dark" />
                </View>
              ) : (
                <SmallActionButton label="Request Pending" variant="dark" disabled />
              )}
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeader}>YOUR FRIENDS</Text>
        <View style={styles.panel}>
          {filteredFriends.map((friend, index) => (
            <View key={friend.id} style={[styles.row, index > 0 && styles.rowBorder]}>
              <Avatar name={friend.name} color={friend.color} />
              <Text style={styles.name}>{friend.name.toUpperCase()}</Text>
              <SmallActionButton
                label={friend.mapVisible ? 'View Map' : 'Map is Private'}
                variant="dark"
                disabled={!friend.mapVisible}
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
    fontSize: 34,
    fontWeight: '500',
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
  },
  search: {
    backgroundColor: colors.input,
    height: 40,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.text,
  },
  sectionHeader: {
    fontSize: 15,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 28,
    marginBottom: 8,
  },
  panel: {
    backgroundColor: colors.card,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.text,
    fontSize: 16,
  },
  name: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 6,
  },
});