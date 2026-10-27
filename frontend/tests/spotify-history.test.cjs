// Uses Node 22.18+ built-in TypeScript support; no test dependencies are required.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { fetchRecentlyPlayed, syncListeningHistory } = require('../src/services/SpotifyHistoryService.ts');

const item = {
  played_at: '2026-10-26T14:00:00Z',
  track: {
    id: 'example-track', name: 'Example Song', duration_ms: 180000,
    artists: [{ name: 'First Artist' }, { name: 'Second Artist' }],
    external_urls: { spotify: 'https://open.spotify.com/track/example-track' },
  },
};
const reply = (items) => new Response(JSON.stringify({ items }));

test('fetches the exact song metadata and timestamp supplied by Spotify', async () => {
  const result = await fetchRecentlyPlayed('spotify-token', async (url, options) => {
    assert.equal(url, 'https://api.spotify.com/v1/me/player/recently-played?limit=50');
    assert.equal(options.headers.Authorization, 'Bearer spotify-token');
    return reply([item]);
  });
  assert.deepEqual(result, {
    plays: [{
      track_id: 'example-track', title: 'Example Song', artist: 'First Artist, Second Artist',
      duration_ms: 180000, spotify_url: 'https://open.spotify.com/track/example-track',
      listened_at: '2026-10-26T14:00:00.000Z',
    }],
    skippedCount: 0,
  });
});

test('counts unsupported tracks and rejects malformed data', async () => {
  const result = await fetchRecentlyPlayed('token', async () => reply([
    { track: null }, { track: { id: null } }, { track: { is_local: true } },
  ]));
  assert.deepEqual(result, { plays: [], skippedCount: 3 });
  await assert.rejects(fetchRecentlyPlayed('token', async () => reply([
    { ...item, played_at: 'bad timestamp' },
  ])), /invalid song metadata/);
  await assert.rejects(fetchRecentlyPlayed('token', async () => new Response('{}')), /invalid listening-history/);
});

test('reports expired authorization, missing permissions, and rate limits', async () => {
  for (const status of [401, 403, 429]) {
    await assert.rejects(fetchRecentlyPlayed('token', async () => new Response('{}', {
      status, headers: { 'Retry-After': '15' },
    })), (error) => error.status === status && error.retryAfterSeconds === 15);
  }
  await assert.rejects(fetchRecentlyPlayed('', async () => assert.fail('Unexpected request')), /access token is required/);
});

test('stores plays for the signed-in user and ignores duplicates across syncs', async () => {
  const saved = new Map();
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }) },
    from: (table) => ({
      upsert: (rows, options) => ({
        select: async () => {
          assert.equal(table, 'listening_history');
          assert.deepEqual(options, { onConflict: 'user_id,track_id,listened_at', ignoreDuplicates: true });
          const inserted = [];
          for (const row of rows) {
            assert.equal(row.user_id, 'user-a');
            const key = `${row.user_id}/${row.track_id}/${row.listened_at}`;
            if (!saved.has(key)) {
              saved.set(key, row);
              inserted.push({ id: String(saved.size) });
            }
          }
          return { data: inserted, error: null };
        },
      }),
    }),
  };
  const repeatedListen = { ...item, played_at: '2026-10-26T14:05:00Z' };
  const fetcher = async () => reply([item, repeatedListen]);
  assert.deepEqual(await syncListeningHistory(client, 'token', fetcher), {
    fetchedCount: 2, insertedCount: 2, skippedCount: 0,
  });
  assert.equal((await syncListeningHistory(client, 'token', fetcher)).insertedCount, 0);
  assert.equal(saved.size, 2);
});

test('requires Supabase login and reports database failures', async () => {
  const client = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } };
  await assert.rejects(syncListeningHistory(client, 'token'), /Sign in to SpotiMaps/);
  client.auth.getUser = async () => ({ data: { user: { id: 'user-a' } }, error: null });
  client.from = () => ({ upsert: () => ({ select: async () => ({ error: { message: 'permission denied' } }) }) });
  await assert.rejects(syncListeningHistory(client, 'token', async () => reply([item])), /Could not save listening history/);
});

test('an empty Spotify history needs no database write', async () => {
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }) } };
  assert.deepEqual(await syncListeningHistory(client, 'token', async () => reply([])), {
    fetchedCount: 0, insertedCount: 0, skippedCount: 0,
  });
});
