import * as Location from 'expo-location';
import {
  startTracking,
  stopTracking,
  syncLocationHistory,
} from '../src/services/LocationService';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
  );

jest.mock('expo-task-manager', () => ({
defineTask: jest.fn(),
}));
const mockPermissions = jest.mocked(Location.getForegroundPermissionsAsync);
const mockWatchPosition = jest.mocked(Location.watchPositionAsync);

beforeEach(() => {
  jest.clearAllMocks();
  stopTracking();

  mockPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  } as Location.PermissionResponse);
});

function gpsUploadClient() {
  const saved = new Map<string, unknown>();
  const select = jest.fn(async () => ({ data: [{ id: 'sample' }], error: null as { message: string } | null }));
  const upsert = jest.fn((rows, _options) => {
    select.mockImplementation(async () => {
      const inserted = rows.filter((row: { user_id: string; recorded_at: string }) => {
        const key = `${row.user_id}/${row.recorded_at}`;
        if (saved.has(key)) return false;
        saved.set(key, row);
        return true;
      });
      return { data: inserted.map(() => ({ id: 'sample' })), error: null };
    });
    return { select };
  });
  const client = {
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-a' } }, error: null })) },
    from: jest.fn((_table: string) => ({ upsert })),
    rpc: jest.fn(async (_name: string, _args: unknown) => ({ data: [{}], error: null as { message: string } | null })),
  };
  return { client, saved, upsert, select, typed: client as unknown as Parameters<typeof syncLocationHistory>[0] };
}

test('uploads captured GPS timestamps for the signed-in user before matching, and safely retries duplicates', async () => {
  const { client, saved, upsert, typed } = gpsUploadClient();
  const readings = [{ latitude: 47.65, longitude: -122.3, timestamp: Date.parse('2026-11-03T14:00:00Z') }];
  client.rpc.mockImplementation(async (name, args) => {
    expect(saved.size).toBe(1);
    expect(name).toBe('match_listening_locations');
    expect(args).toEqual({
      p_from: '2026-11-03T13:59:00.000Z', p_to: '2026-11-03T14:01:00.001Z', p_max_gap_seconds: 60,
    });
    return { data: [{}], error: null };
  });
  expect(await syncLocationHistory(typed, readings)).toEqual({ receivedCount: 1, insertedCount: 1, matchingError: null });
  expect(client.from).toHaveBeenCalledWith('location_samples');
  expect(upsert).toHaveBeenCalledWith([{
    user_id: 'user-a', latitude: 47.65, longitude: -122.3, recorded_at: '2026-11-03T14:00:00.000Z',
  }], { onConflict: 'user_id,recorded_at', ignoreDuplicates: true });
  expect((await syncLocationHistory(typed, readings)).insertedCount).toBe(0);
  expect(client.rpc).toHaveBeenCalledTimes(2);
  expect(readings[0].timestamp).toBe(Date.parse('2026-11-03T14:00:00Z'));
});

test('does not match invalid readings, an empty batch, or a failed GPS upload', async () => {
  const { client, upsert, typed } = gpsUploadClient();
  expect((await syncLocationHistory(typed, [])).insertedCount).toBe(0);
  await expect(syncLocationHistory(typed, [{ latitude: 91, longitude: 0, timestamp: 1000 }])).rejects.toThrow('valid coordinates');
  expect(client.from).not.toHaveBeenCalled();
  upsert.mockReturnValue({ select: jest.fn(async () => ({ data: [], error: { message: 'permission denied' } })) });
  await expect(syncLocationHistory(typed, [{ latitude: 47, longitude: -122, timestamp: 1000 }])).rejects.toThrow('Could not save GPS');
  expect(client.rpc).not.toHaveBeenCalled();
});

test('saves large GPS batches in chunks and reports matching failure separately', async () => {
  const { client, upsert, typed } = gpsUploadClient();
  const readings = Array.from({ length: 501 }, (_, i) => ({ latitude: 47, longitude: -122, timestamp: 1000 + i }));
  client.rpc.mockResolvedValue({ data: [], error: { message: 'matching unavailable' } });
  expect(await syncLocationHistory(typed, readings)).toEqual({
    receivedCount: 501, insertedCount: 501, matchingError: 'matching unavailable',
  });
  expect(upsert.mock.calls.map(([rows]) => rows.length)).toEqual([500, 1]);
});

test('starts tracking when location permission is granted', async () => {
  const remove = jest.fn();

  mockWatchPosition.mockResolvedValue({ remove });

  const started = await startTracking();

  expect(started).toBe(true);
  expect(mockWatchPosition).toHaveBeenCalledTimes(1);
});

test('collects GPS readings and stops tracking', async () => {
  const remove = jest.fn();

  mockWatchPosition.mockResolvedValue({ remove });

  await startTracking();

  const callback = mockWatchPosition.mock.calls[0][1];

  callback({
    coords: {
      latitude: 47.65,
      longitude: -122.30,
    },
    timestamp: 1000,
  } as Location.LocationObject);

  callback({
    coords: {
      latitude: 47.66,
      longitude: -122.31,
    },
    timestamp: 2000,
  } as Location.LocationObject);

  const readings = stopTracking();

  expect(readings).toEqual([
    { latitude: 47.65, longitude: -122.30, timestamp: 1000 },
    { latitude: 47.66, longitude: -122.31, timestamp: 2000 },
  ]);

  expect(remove).toHaveBeenCalledTimes(1);
});
