const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriendRequests,
  fetchFriends,
  removeFriend,
  searchUsers,
  sendFriendRequest,
} = require('../src/services/FriendService.ts');

function createClient(result) {
  const calls = [];
  return {
    calls,
    async rpc(name, args) {
      calls.push({ name, args });
      return result;
    },
  };
}

test('search trims the username and skips empty queries', async () => {
  const client = createClient({ data: [{ id: 'user-2', username: 'jennie' }], error: null });

  assert.deepEqual(await searchUsers(client, '  jen  '), [{ id: 'user-2', username: 'jennie' }]);
  assert.deepEqual(client.calls, [{ name: 'search_users', args: { p_username: 'jen' } }]);
  assert.deepEqual(await searchUsers(client, '  '), []);
  assert.equal(client.calls.length, 1);
});

test('friend and request RPC results map into screen models', async () => {
  const client = createClient({
    data: [
      {
        id: 'request-1',
        other_user_id: 'user-2',
        username: 'jennie',
        direction: 'incoming',
        created_at: '2026-11-15T00:00:00Z',
      },
    ],
    error: null,
  });
  const requests = await fetchFriendRequests(client);
  assert.deepEqual(requests.map(({ id, userId, name, direction }) => (
    { id, userId, name, direction }
  )), [{
    id: 'request-1',
    userId: 'user-2',
    name: 'jennie',
    direction: 'incoming',
  }]);

  client.rpc = async (name, args) => {
    client.calls.push({ name, args });
    return {
      data: [{ friend_id: 'user-3', username: 'kairo', map_visible: true }],
      error: null,
    };
  };
  assert.deepEqual(
    (await fetchFriends(client)).map(({ id, name, mapVisible }) => ({ id, name, mapVisible })),
    [{ id: 'user-3', name: 'kairo', mapVisible: true }],
  );
});

test('friend actions call the matching RPCs with their IDs', async () => {
  const client = createClient({ data: true, error: null });
  const requestId = 'request-1';
  await acceptFriendRequest(client, requestId);
  await declineFriendRequest(client, requestId);
  await cancelFriendRequest(client, requestId);
  await removeFriend(client, 'user-2');

  assert.deepEqual(client.calls, [
    { name: 'accept_friend_request', args: { p_request_id: requestId } },
    { name: 'decline_friend_request', args: { p_request_id: requestId } },
    { name: 'cancel_friend_request', args: { p_request_id: requestId } },
    { name: 'remove_friend', args: { p_friend_id: 'user-2' } },
  ]);
});

test('surfaces Supabase errors instead of hiding failed friend operations', async () => {
  const client = createClient({ data: null, error: { message: 'permission denied' } });

  await assert.rejects(fetchFriends(client), /Could not load friends: permission denied/);
  await assert.rejects(
    sendFriendRequest(client, 'user-2'),
    /Could not send friend request: permission denied/,
  );
});
