const assert = require('node:assert/strict');
const { test } = require('node:test');
const { matchListeningLocations } = require('../src/services/ListeningMatchService.ts');
const { getMatchedListeningHistory } = require('../src/services/MatchedListeningHistoryService.ts');

const range = { from: '2026-01-15T12:00:00Z', to: '2026-01-15T12:15:00Z' };

test('matching calls the backend with the time range and preserves its statistics', async () => {
  const result = { examined_count: 3, matched_count: 2, unmatched_count: 1, changed_count: 2 };
  const client = { rpc: async (name, args) => {
    assert.equal(name, 'match_listening_locations');
    assert.deepEqual(args, { p_from: range.from, p_to: range.to, p_max_gap_seconds: 30 });
    return { data: [result], error: null };
  } };
  assert.deepEqual(await matchListeningLocations(client, { ...range, maxGapSeconds: 30 }), result);
});

test('omitted settings use database defaults without sending undefined parameters', async () => {
  const client = { rpc: async (_name, args) => {
    assert.deepEqual(args, { p_from: range.from, p_to: range.to });
    return { data: [{ changed_count: 0 }], error: null };
  } };
  await matchListeningLocations(client, range);
  client.rpc = async (_name, args) => {
    assert.deepEqual(args, { p_from: range.from, p_to: range.to });
    return { data: [], error: null };
  };
  assert.deepEqual(await getMatchedListeningHistory(client, range), []);
});

test('retrieval returns matched and unplaced rows without calling the matcher', async () => {
  const rows = [{ id: 'placed', match_status: 'matched' }, { id: 'unplaced', location_id: null }];
  let calls = 0;
  const client = { rpc: async (name, args) => {
    calls += 1;
    assert.equal(name, 'get_matched_listening_history');
    assert.deepEqual(args, { p_from: range.from, p_to: range.to, p_limit: 10, p_offset: 20 });
    return { data: rows, error: null };
  } };
  assert.deepEqual(await getMatchedListeningHistory(client, { ...range, limit: 10, offset: 20 }), rows);
  assert.equal(calls, 1);
});

test('RPC failures and unexpected empty responses remain visible to the caller', async () => {
  const client = { rpc: async () => ({ data: null, error: { message: 'permission denied' } }) };
  await assert.rejects(matchListeningLocations(client, range), /Could not match.*permission denied/);
  await assert.rejects(getMatchedListeningHistory(client, range), /Could not retrieve.*permission denied/);
  client.rpc = async () => ({ data: [], error: null });
  await assert.rejects(matchListeningLocations(client, range), /did not return a result/);
  client.rpc = async () => ({ data: null, error: null });
  await assert.rejects(getMatchedListeningHistory(client, range), /did not return a result/);
});
