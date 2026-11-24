import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SmallActionButton from '../components/SmallActionButton';
import { supabase } from '../lib/supabase';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriendRequests,
  fetchFriends,
  removeFriend,
  searchUsers,
  sendFriendRequest,
  type Friend,
  type FriendRequest,
  type FriendSearchResult,
} from '../services/FriendService';
import { colors, getReadableTextColor } from '../theme';
import FriendMapScreen from './FriendMapScreen';

// Messages users see. The technical error still goes to the console for debugging.
const LOAD_ERROR_MESSAGE = 'Couldn’t load your friends. Pull down or tap Try again.';
const SEARCH_ERROR_MESSAGE = 'Couldn’t search right now. Please try again.';
const ACTION_ERROR_MESSAGE = 'Something went wrong. Please try again.';
const UNAVAILABLE_MESSAGE = 'That friend request or friendship is no longer available.';

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: color }]}>
      <Text style={[styles.avatarText, { color: getReadableTextColor(color) }]}>
        {name.charAt(0).toUpperCase()}
      </Text>    
    </View>
  );
}

export default function FriendScreen() {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // The friend whose map is open, or null when showing the friends list
  const [viewingFriend, setViewingFriend] = useState<Friend | null>(null);
  const isMounted = useRef(true);

  const loadData = useCallback(async () => {
    if (isMounted.current) setLoadError(null);
    try {
      const [nextRequests, nextFriends] = await Promise.all([
        fetchFriendRequests(supabase),
        fetchFriends(supabase),
      ]);
      if (isMounted.current) {
        setRequests(nextRequests);
        setFriends(nextFriends);
      }
    } catch (error) {
      console.warn('Could not load friends:', error);
      if (isMounted.current) {
        setLoadError(LOAD_ERROR_MESSAGE);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    if (isMounted.current) setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    isMounted.current = true;
    void loadData();
    return () => {
      isMounted.current = false;
    };
  }, [loadData]);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    const timeout = setTimeout(() => {
      void searchUsers(supabase, query)
        .then((results) => {
          if (active && isMounted.current) setSearchResults(results);
        })
        .catch((error: unknown) => {
          console.warn('Could not search users:', error);
          if (active && isMounted.current) {
            setSearchError(SEARCH_ERROR_MESSAGE);
          }
        })
        .finally(() => {
          if (active && isMounted.current) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [search]);

  const performAction = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      if (result === false) {
        if (isMounted.current) setActionError(UNAVAILABLE_MESSAGE);
        await loadData();
        return;
      }
      await loadData();
    } catch (error) {
      console.warn('Friend action failed:', error);
      if (isMounted.current) {
        setActionError(ACTION_ERROR_MESSAGE);
      }
    } finally {
      if (isMounted.current) setBusy(false);
    }
  };

  if (viewingFriend) {
    return (
      <FriendMapScreen
        friendId={viewingFriend.id}
        friendName={viewingFriend.name}
        onBack={() => setViewingFriend(null)}
      />
    );
  }

  const filteredFriends = friends.filter((friend) => {
    const normalizedSearch = search.trim().toLowerCase();
    return normalizedSearch.length === 0 || friend.name.toLowerCase().includes(normalizedSearch);
  });
  const pendingRequestFor = (userId: string) => requests.find((request) => request.userId === userId);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
        }
      >
        <Text style={styles.title}>Friends</Text>

        {loadError ? (
          <View style={styles.errorRow}>
            <Text style={[styles.error, styles.errorText]}>{loadError}</Text>
            <SmallActionButton label="Try again" variant="dark" onPress={() => void handleRefresh()} />
          </View>
        ) : null}
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by username"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search by username"
        />

        {search.trim().length > 0 ? (
          <>
            <Text style={styles.sectionHeader}>SEARCH RESULTS</Text>
            <View style={styles.panel}>
              {searchError ? <Text style={styles.empty}>{searchError}</Text> : null}
              {searching ? <Text style={styles.empty}>Searching…</Text> : null}
              {!searching && !searchError && searchResults.length === 0 ? (
                <Text style={styles.empty}>No users found.</Text>
              ) : null}
              {searchResults.map((result, index) => {
                const request = pendingRequestFor(result.id);
                const isFriend = friends.some((friend) => friend.id === result.id);
                const label = isFriend
                  ? 'Friends'
                  : request?.direction === 'outgoing'
                    ? 'Request Pending'
                    : request?.direction === 'incoming'
                      ? 'Request Received'
                      : 'Add Friend';
                return (
                  <View key={result.id} style={[styles.row, index > 0 && styles.rowBorder]}>
                    <Avatar name={result.username} color="#6C63E0" />
                    <Text style={styles.name}>{result.username}</Text>
                    <SmallActionButton
                      label={label}
                      variant="dark"
                      disabled={busy || isFriend || request !== undefined}
                      onPress={() => void performAction(() => sendFriendRequest(supabase, result.id))}
                    />
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionHeader}>REQUESTS</Text>
        <View style={styles.panel}>
          {requests.length === 0 ? <Text style={styles.empty}>No pending friend requests.</Text> : null}
          {requests.map((request, index) => (
            <View key={request.id} style={[styles.row, index > 0 && styles.rowBorder]}>
              <Avatar name={request.name} color={request.color} />
              <Text style={styles.name}>{request.name.toUpperCase()}</Text>
              {request.direction === 'incoming' ? (
                <View style={styles.buttonGroup}>
                  <SmallActionButton
                    label="Accept"
                    variant="light"
                    disabled={busy}
                    onPress={() => void performAction(() => acceptFriendRequest(supabase, request.id))}
                  />
                  <SmallActionButton
                    label="Decline"
                    variant="dark"
                    disabled={busy}
                    onPress={() => void performAction(() => declineFriendRequest(supabase, request.id))}
                  />
                </View>
              ) : (
                <SmallActionButton
                  label="Cancel"
                  variant="dark"
                  disabled={busy}
                  onPress={() => void performAction(() => cancelFriendRequest(supabase, request.id))}
                />
              )}
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeader}>YOUR FRIENDS</Text>
        <View style={styles.panel}>
          {loading ? <Text style={styles.empty}>Loading friends…</Text> : null}
          {!loading && filteredFriends.length === 0 ? (
            <Text style={styles.empty}>{search.trim() ? 'No matching friends.' : 'No friends yet.'}</Text>
          ) : null}
          {filteredFriends.map((friend, index) => (
            <View key={friend.id} style={[styles.row, index > 0 && styles.rowBorder]}>
              <Avatar name={friend.name} color={friend.color} />
              <Text style={styles.name}>{friend.name.toUpperCase()}</Text>
              <View style={styles.buttonGroup}>
                {friend.mapVisible ? (
                  <SmallActionButton
                    label="View Map"
                    variant="dark"
                    onPress={() => setViewingFriend(friend)}
                  />
                ) : (
                  <View
                    style={styles.privateLabel}
                    accessible
                    accessibilityLabel={`${friend.name}'s map is private`}
                  >
                    <MaterialCommunityIcons name="lock" size={14} color={colors.white} />
                    <Text style={styles.privateText}>Map is private</Text>
                  </View>
                )}
                <SmallActionButton
                  label="Remove"
                  variant="dark"
                  disabled={busy}
                  onPress={() => void performAction(() => removeFriend(supabase, friend.id))}
                />
              </View>
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
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    marginBottom: 0,
  },
  error: {
    color: colors.error,
    fontSize: 14,
    marginBottom: 8,
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
    fontSize: 17,
    fontWeight: '700',
  },
  name: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  privateLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  privateText: {
    color: colors.white,
    fontSize: 14,
    fontStyle: 'italic',
  },
  empty: {
    color: colors.white,
    fontSize: 15,
    paddingVertical: 12,
  },
});