import * as Location from 'expo-location';
import {
  startTracking,
  stopTracking,
} from '../src/services/LocationService';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
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