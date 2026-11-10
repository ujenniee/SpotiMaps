const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  getPrivacySettings,
  updatePrivacySettings,
} = require('../src/services/PrivacySettingsService.ts');

const savedSettings = {
  location_tracking_enabled: false,
  map_visibility: 'friends',
};

function createClient({
  data = savedSettings,
  error = null,
  user = { id: 'user-1' },
  authError = null,
} = {}) {
  const calls = [];
  return {
    calls,
    auth: {
      getUser: async () => ({ data: { user }, error: authError }),
    },
    from(table) {
      assert.equal(table, 'profiles');
      return {
        select(columns) {
          calls.push({ operation: 'select', columns });
          return {
            single: async () => ({ data, error }),
          };
        },
        update(updates) {
          calls.push({ operation: 'update', updates });
          return {
            eq(column, value) {
              calls.push({ operation: 'eq', column, value });
              return this;
            },
            select(columns) {
              calls.push({ operation: 'select', columns });
              return {
                single: async () => ({ data, error }),
              };
            },
          };
        },
      };
    },
  };
}

test('loads the signed-in profile privacy settings', async () => {
  const client = createClient();

  assert.deepEqual(await getPrivacySettings(client), savedSettings);
  assert.deepEqual(client.calls, [{
    operation: 'select',
    columns: 'location_tracking_enabled, map_visibility',
  }]);
});

test('saves only the requested privacy fields and returns persisted settings', async () => {
  const client = createClient();

  assert.deepEqual(
    await updatePrivacySettings(client, { location_tracking_enabled: false }),
    savedSettings,
  );
  assert.deepEqual(client.calls, [
    { operation: 'update', updates: { location_tracking_enabled: false } },
    { operation: 'eq', column: 'id', value: 'user-1' },
    { operation: 'select', columns: 'location_tracking_enabled, map_visibility' },
  ]);
});

test('surfaces database errors and rejects invalid settings', async () => {
  await assert.rejects(
    getPrivacySettings(createClient({ error: { message: 'permission denied' } })),
    /Could not load privacy settings: permission denied/,
  );
  await assert.rejects(
    getPrivacySettings(createClient({ data: { location_tracking_enabled: true, map_visibility: 'everyone' } })),
    /Supabase returned invalid privacy settings/,
  );
  await assert.rejects(
    updatePrivacySettings(createClient({ error: { message: 'write denied' } }), { map_visibility: 'private' }),
    /Could not save privacy settings: write denied/,
  );
  await assert.rejects(
    updatePrivacySettings(createClient({ user: null }), { map_visibility: 'private' }),
    /Sign in before updating privacy settings/,
  );
  await assert.rejects(
    updatePrivacySettings(createClient({ authError: { message: 'session unavailable' } }), {
      map_visibility: 'private',
    }),
    /Could not identify signed-in user: session unavailable/,
  );
});
