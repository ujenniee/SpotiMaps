import * as Location from 'expo-location';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';
import { syncCurrentLocation } from '../src/services/LocationService';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const reading = {
  latitude: 47.65,
  longitude: -122.3,
  timestamp: Date.parse('2026-11-02T14:05:00Z'),
};
const mockPermission = jest.mocked(Location.getForegroundPermissionsAsync);
const mockPosition = jest.mocked(Location.getCurrentPositionAsync);

function setup() {
  const getUser = jest.fn().mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null });
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn().mockReturnValue({ upsert });
  const client = { auth: { getUser }, from } as unknown as SupabaseClient<Database>;
  return { client, getUser, upsert, from };
}

function mockGPSReading(value: typeof reading) {
  mockPosition.mockResolvedValue({
    timestamp: value.timestamp,
    coords: {
      latitude: value.latitude, longitude: value.longitude,
      altitude: null, accuracy: 5, altitudeAccuracy: null, heading: null, speed: null,
    },
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockPermission.mockResolvedValue({
    granted: true, canAskAgain: true, status: Location.PermissionStatus.GRANTED, expires: 'never',
  });
  mockGPSReading(reading);
});

test('sync collects a GPS reading and sends that exact reading to the database', async () => {
  const { client, from, upsert } = setup();
  expect(await syncCurrentLocation(client)).toEqual(reading);
  expect(mockPosition).toHaveBeenCalledWith({ accuracy: Location.Accuracy.High });
  expect(from).toHaveBeenCalledWith('location_samples');
  expect(upsert).toHaveBeenCalledWith({
    user_id: 'user-a', latitude: 47.65, longitude: -122.3,
    recorded_at: '2026-11-02T14:05:00.000Z',
  }, { onConflict: 'user_id,recorded_at', ignoreDuplicates: true });
});

test('sync does not collect or save if location permission is denied', async () => {
  const { client, from } = setup();
  mockPermission.mockResolvedValue({
    granted: false, canAskAgain: true, status: Location.PermissionStatus.DENIED, expires: 'never',
  });
  expect(await syncCurrentLocation(client)).toBeNull();
  expect(mockPosition).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});

test('a GPS failure does not cause a database write', async () => {
  const { client, from } = setup();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    mockPosition.mockRejectedValue(new Error('GPS unavailable'));
    expect(await syncCurrentLocation(client)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

test('retries preserve the timestamp and use duplicate-safe inserts', async () => {
  const { client, upsert } = setup();
  await syncCurrentLocation(client);
  await syncCurrentLocation(client);
  expect(upsert.mock.calls[0]).toEqual(upsert.mock.calls[1]);
  mockGPSReading({ ...reading, timestamp: reading.timestamp + 1000 });
  await syncCurrentLocation(client);
  expect(upsert.mock.calls[2][0].recorded_at).toBe('2026-11-02T14:05:01.000Z');
});

test('invalid coordinates and timestamps are rejected before a database write', async () => {
  const { client, from } = setup();
  for (const invalid of [
    { ...reading, latitude: 91 }, { ...reading, longitude: -181 },
    { ...reading, latitude: NaN }, { ...reading, longitude: Infinity },
    { ...reading, timestamp: NaN }, { ...reading, timestamp: -1 },
    { ...reading, timestamp: 8640000000000001 },
  ]) {
    mockGPSReading(invalid);
    await expect(syncCurrentLocation(client)).rejects.toThrow('valid coordinates and a timestamp');
  }
  expect(from).not.toHaveBeenCalled();
});

test('saving requires authentication and propagates database failures', async () => {
  const { client, from, getUser, upsert } = setup();
  getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  await expect(syncCurrentLocation(client)).rejects.toThrow('Sign in to SpotiMaps');
  expect(mockPosition).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
  upsert.mockResolvedValueOnce({ error: { message: 'permission denied' } });
  await expect(syncCurrentLocation(client)).rejects.toThrow('Could not save GPS location: permission denied');
});
