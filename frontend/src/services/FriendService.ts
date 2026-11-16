import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export type FriendRequest = {
  id: string;
  userId: string;
  name: string;
  color: string;
  direction: 'incoming' | 'outgoing';
};

export type Friend = {
  id: string;
  name: string;
  color: string;
  mapVisible: boolean;
};

export type FriendSearchResult = {
  id: string;
  username: string;
};

const FRIEND_COLORS = ['#6C63E0', '#E0525E', '#E8C547', '#4FB3A5', '#E8914A'];

function colorForUser(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return FRIEND_COLORS[Math.abs(hash) % FRIEND_COLORS.length];
}

function throwRpcError(action: string, message: string): never {
  throw new Error(`Could not ${action}: ${message}`);
}

export async function searchUsers(
  client: SupabaseClient<Database>,
  username: string,
): Promise<FriendSearchResult[]> {
  const query = username.trim();
  if (!query) {
    return [];
  }

  const { data, error } = await client.rpc('search_users', { p_username: query });
  if (error) {
    throwRpcError('search for users', error.message);
  }
  if (!data) {
    throw new Error('User search did not return a result.');
  }
  return data;
}

export async function fetchFriendRequests(
  client: SupabaseClient<Database>,
): Promise<FriendRequest[]> {
  const { data, error } = await client.rpc('list_friend_requests');
  if (error) {
    throwRpcError('load friend requests', error.message);
  }
  if (!data) {
    throw new Error('Friend-request retrieval did not return a result.');
  }

  return data.map((request) => ({
    id: request.id,
    userId: request.other_user_id,
    name: request.username ?? 'SpotiMaps user',
    color: colorForUser(request.other_user_id),
    direction: request.direction,
  }));
}

export async function fetchFriends(
  client: SupabaseClient<Database>,
): Promise<Friend[]> {
  const { data, error } = await client.rpc('list_friends');
  if (error) {
    throwRpcError('load friends', error.message);
  }
  if (!data) {
    throw new Error('Friend retrieval did not return a result.');
  }

  return data.map((friend) => ({
    id: friend.friend_id,
    name: friend.username ?? 'SpotiMaps user',
    color: colorForUser(friend.friend_id),
    mapVisible: friend.map_visible,
  }));
}

export async function sendFriendRequest(
  client: SupabaseClient<Database>,
  recipientId: string,
): Promise<string> {
  const { data, error } = await client.rpc('send_friend_request', {
    p_recipient_id: recipientId,
  });
  if (error) {
    throwRpcError('send friend request', error.message);
  }
  if (!data) {
    throw new Error('Sending the friend request did not return an ID.');
  }
  return data;
}

export async function acceptFriendRequest(
  client: SupabaseClient<Database>,
  requestId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('accept_friend_request', {
    p_request_id: requestId,
  });
  if (error) {
    throwRpcError('accept friend request', error.message);
  }
  if (data === null) {
    throw new Error('Accepting the friend request did not return a result.');
  }
  return data;
}

export async function declineFriendRequest(
  client: SupabaseClient<Database>,
  requestId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('decline_friend_request', {
    p_request_id: requestId,
  });
  if (error) {
    throwRpcError('decline friend request', error.message);
  }
  if (data === null) {
    throw new Error('Declining the friend request did not return a result.');
  }
  return data;
}

export async function cancelFriendRequest(
  client: SupabaseClient<Database>,
  requestId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('cancel_friend_request', {
    p_request_id: requestId,
  });
  if (error) {
    throwRpcError('cancel friend request', error.message);
  }
  if (data === null) {
    throw new Error('Cancelling the friend request did not return a result.');
  }
  return data;
}

export async function removeFriend(
  client: SupabaseClient<Database>,
  friendId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc('remove_friend', {
    p_friend_id: friendId,
  });
  if (error) {
    throwRpcError('remove friend', error.message);
  }
  if (data === null) {
    throw new Error('Removing the friend did not return a result.');
  }
  return data;
}
