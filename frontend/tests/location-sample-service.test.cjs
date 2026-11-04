const assert = require('node:assert/strict');
const { test } = require('node:test');
const { saveLocationSamples } = require('../src/services/LocationSampleService.ts');

function createClient({ user = { id: 'user-1' }, upsertError = null } = {}) {
  const uploads = [];
  const matchArgs = [];
  return {
    uploads,
    matchArgs,
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from: (table) => ({
      upsert: (rows, options) => {
        assert.equal(table, 'location_samples');
        uploads.push({ rows, options });
        return {
          select: async () => ({
            data: upsertError ? null : rows.map((_, index) => ({ id: `sample-${index}` })),
            error: upsertError,
          }),
        };
      },
    }),
    rpc: async (name, args) => {
      assert.equal(name, 'match_listening_locations');
      matchArgs.push(args);
      return {
        data: [{ examined_count: 1, matched_count: 1, unmatched_count: 0, changed_count: 1 }],
        error: null,
      };
    },
  };
}

test('saves unique GPS timestamps and runs matching for the saved time range', async () => {
  const client = createClient();
  const readings = [
    { latitude: 47.65, longitude: -122.3, timestamp: 2000 },
    { latitude: 47.66, longitude: -122.31, timestamp: 1000 },
    { latitude: 47.67, longitude: -122.32, timestamp: 2000 },
  ];

  const result = await saveLocationSamples(client, readings);

  assert.equal(client.uploads.length, 1);
  assert.deepEqual(client.uploads[0].options, {
    onConflict: 'user_id,recorded_at',
    ignoreDuplicates: true,
  });
  assert.deepEqual(client.uploads[0].rows.map((row) => row.user_id), ['user-1', 'user-1']);
  assert.deepEqual(client.uploads[0].rows.map((row) => row.latitude), [47.66, 47.67]);
  assert.equal(client.matchArgs.length, 1);
  assert.equal(client.matchArgs[0].p_max_gap_seconds, 60);
  assert.deepEqual(result, {
    insertedCount: 2,
    matchingResults: [{
      examined_count: 1,
      matched_count: 1,
      unmatched_count: 0,
      changed_count: 1,
    }],
  });
});

test('splits matching ranges so each request stays within seven days', async () => {
  const client = createClient();
  const result = await saveLocationSamples(client, [
    { latitude: 47.65, longitude: -122.3, timestamp: 0 },
    { latitude: 47.66, longitude: -122.31, timestamp: 8 * 24 * 60 * 60 * 1000 },
  ]);

  assert.equal(client.matchArgs.length, 2);
  for (const args of client.matchArgs) {
    assert.ok(Date.parse(args.p_to) - Date.parse(args.p_from) <= 7 * 24 * 60 * 60 * 1000);
  }
  assert.equal(result.matchingResults.length, 2);
});

test('rejects unauthenticated, invalid, and failed sample saves', async () => {
  await assert.rejects(
    saveLocationSamples(createClient({ user: null }), [
      { latitude: 47.65, longitude: -122.3, timestamp: 1 },
    ]),
    /Sign in to SpotiMaps/,
  );
  await assert.rejects(
    saveLocationSamples(createClient(), [{ latitude: 91, longitude: -122.3, timestamp: 1 }]),
    /valid coordinates and timestamps/,
  );
  await assert.rejects(
    saveLocationSamples(createClient({ upsertError: { message: 'insert denied' } }), [
      { latitude: 47.65, longitude: -122.3, timestamp: 1 },
    ]),
    /Could not save location samples: insert denied/,
  );
});

test('empty sample batches do not require authentication or make database calls', async () => {
  const client = createClient({ user: null });
  assert.deepEqual(await saveLocationSamples(client, []), {
    insertedCount: 0,
    matchingResults: [],
  });
  assert.equal(client.uploads.length, 0);
  assert.equal(client.matchArgs.length, 0);
});
