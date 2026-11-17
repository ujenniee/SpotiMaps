const assert = require('node:assert/strict');
const test = require('node:test');
const {
  acceptFriendRequest,
  fetchFriendRequests,
  fetchFriends,
  searchUsers,
  sendFriendRequest,
} = require('../src/services/FriendService.ts');
const {
  fetchFriendMapPlaces,
  FriendMapUnavailableError,
} = require('../src/services/FriendMapService.ts');

test('friend service maps request and friend RPC results', async () => {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push([name, args]);
      if (name === 'list_friend_requests') {
        return {
          data: [{
            id: 'request-1',
            other_user_id: 'user-1',
            username: 'alex',
            direction: 'incoming',
            created_at: '2026-01-01T00:00:00Z',
          }],
          error: null,
        };
      }
      return {
        data: [{ friend_id: 'user-2', username: 'sam', map_visible: true }],
        error: null,
      };
    },
  };

  const requests = await fetchFriendRequests(client);
  const friends = await fetchFriends(client);

  assert.equal(requests[0].id, 'request-1');
  assert.equal(requests[0].userId, 'user-1');
  assert.equal(requests[0].direction, 'incoming');
  assert.equal(friends[0].id, 'user-2');
  assert.equal(friends[0].mapVisible, true);
  assert.deepEqual(calls.map(([name]) => name), ['list_friend_requests', 'list_friends']);
});

test('friend service searches exact usernames and sends/accepts requests through RPCs', async () => {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push([name, args]);
      if (name === 'search_users') {
        return { data: [{ id: 'user-1', username: 'alex' }], error: null };
      }
      if (name === 'send_friend_request') {
        return { data: 'request-1', error: null };
      }
      return { data: true, error: null };
    },
  };

  assert.deepEqual(await searchUsers(client, ' alex '), [{ id: 'user-1', username: 'alex' }]);
  assert.equal(await sendFriendRequest(client, 'user-1'), 'request-1');
  assert.equal(await acceptFriendRequest(client, 'request-1'), true);
  assert.deepEqual(calls, [
    ['search_users', { p_username: 'alex' }],
    ['send_friend_request', { p_recipient_id: 'user-1' }],
    ['accept_friend_request', { p_request_id: 'request-1' }],
  ]);
});

test('blank username searches do not call the backend', async () => {
  let called = false;
  const client = { rpc: async () => { called = true; return { data: [], error: null }; } };

  assert.deepEqual(await searchUsers(client, '   '), []);
  assert.equal(called, false);
});

test('friend map service groups matched rows and hides private/non-friend distinction', async () => {
  const client = {
    async rpc(name, args) {
      assert.equal(name, 'get_friend_map');
      assert.equal(args.p_friend_id, 'friend-1');
      return {
        data: [
          {
            id: 'play-1',
            location_id: 'place-1',
            title: 'Song',
            artist: 'Artist',
            genre: 'Pop',
            latitude: 47.6,
            longitude: -122.3,
            listened_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 'play-2',
            location_id: 'place-1',
            title: 'Song',
            artist: 'Artist',
            genre: 'Pop',
            latitude: 47.6,
            longitude: -122.3,
            listened_at: '2026-01-01T00:01:00Z',
          },
        ],
        error: null,
      };
    },
  };

  const places = await fetchFriendMapPlaces(client, 'friend-1');
  assert.equal(places.length, 1);
  assert.equal(places[0].id, 'place-1');
  assert.equal(places[0].songs[0].plays, 2);

  const deniedClient = {
    rpc: async () => ({ data: null, error: { code: '42501', message: 'Friend map unavailable.' } }),
  };
  await assert.rejects(
    fetchFriendMapPlaces(deniedClient, 'friend-1'),
    FriendMapUnavailableError,
  );
});
