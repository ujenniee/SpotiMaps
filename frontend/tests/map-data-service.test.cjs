const assert = require('node:assert/strict');
const { test } = require('node:test');
const { fetchMapPlaces } = require('../src/services/MapDataService.ts');

function matchedRow(overrides = {}) {
  return {
    id: 'play-1',
    track_id: 'track-1',
    title: 'Song',
    artist: 'Artist',
    duration_ms: 180000,
    spotify_url: null,
    genre: 'Indie',
    listened_at: '2026-01-15T12:00:00Z',
    location_id: 'location-1',
    latitude: 47.65,
    longitude: -122.3,
    location_recorded_at: '2026-01-15T12:00:05Z',
    time_gap_seconds: 5,
    match_status: 'matched',
    ...overrides,
  };
}

test('map places use matched rows, group plays by saved location, and ignore unmatched rows', async () => {
  const rows = [
    matchedRow(),
    matchedRow({ id: 'play-2' }),
    matchedRow({
      id: 'play-3',
      title: 'Other song',
      genre: null,
      location_id: 'location-2',
      latitude: 47.66,
    }),
    matchedRow({ id: 'play-4', match_status: 'unmatched', location_id: null, latitude: null, longitude: null }),
  ];
  const client = {
    rpc: async (name, args) => {
      if (name === 'match_listening_locations') {
        assert.ok(Date.parse(args.p_to) - Date.parse(args.p_from) <= 7 * 24 * 60 * 60 * 1000);
        return { data: [{ examined_count: 0, matched_count: 0, unmatched_count: 0, changed_count: 0 }], error: null };
      }
      assert.equal(name, 'get_matched_listening_history');
      assert.equal(args.p_limit, 500);
      assert.equal(args.p_offset, 0);
      assert.ok(Date.parse(args.p_to) - Date.parse(args.p_from) <= 7 * 24 * 60 * 60 * 1000);
      return { data: rows, error: null };
    },
  };

  assert.deepEqual(await fetchMapPlaces(client), [
    {
      id: 'location-1',
      name: 'Listening stop 1',
      area: 'Recorded GPS location',
      latitude: 47.65,
      longitude: -122.3,
      songs: [{ title: 'Song', artist: 'Artist', genre: 'Indie', plays: 2 }],
    },
    {
      id: 'location-2',
      name: 'Listening stop 2',
      area: 'Recorded GPS location',
      latitude: 47.66,
      longitude: -122.3,
      songs: [{ title: 'Other song', artist: 'Artist', genre: null, plays: 1 }],
    },
  ]);
});

test('map loading paginates matched history and surfaces RPC failures', async () => {
  const fullPage = Array.from({ length: 500 }, (_, index) =>
    matchedRow({ id: `play-${index}`, location_id: `location-${index}` }));
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      if (name === 'match_listening_locations') {
        return { data: [{ examined_count: 0, matched_count: 0, unmatched_count: 0, changed_count: 0 }], error: null };
      }
      calls.push(args.p_offset);
      return { data: args.p_offset === 0 ? fullPage : [], error: null };
    },
  };

  assert.equal((await fetchMapPlaces(client)).length, 500);
  assert.deepEqual(calls, [0, 500]);

  await assert.rejects(
    fetchMapPlaces({ rpc: async (name) => name === 'match_listening_locations'
      ? { data: [{ examined_count: 0, matched_count: 0, unmatched_count: 0, changed_count: 0 }], error: null }
      : { data: null, error: { message: 'permission denied' } } }),
    /Could not retrieve matched listening history: permission denied/,
  );
});
