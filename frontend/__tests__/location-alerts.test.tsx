import { Alert, AppState, type AppStateStatus, Linking } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import LocationAvailabilityAlert from '../src/components/LocationAvailabilityAlert';
import LocationPermissionScreen from '../src/screens/LocationPermissionScreen';
import {
  getLocationPermission,
  requestLocationPermission,
} from '../src/services/LocationService';

jest.mock('expo-location', () => ({
  hasServicesEnabledAsync: jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}));
jest.mock('../src/services/LocationService', () => ({
  getLocationPermission: jest.fn(),
  requestLocationPermission: jest.fn(),
}));

const mockHasServicesEnabled = jest.mocked(Location.hasServicesEnabledAsync);
const mockGetLocationPermission = jest.mocked(getLocationPermission);
const mockRequestLocationPermission = jest.mocked(requestLocationPermission);
let emitAppState: (state: AppStateStatus) => void;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    emitAppState = listener;
    return { remove: jest.fn() };
  });
  jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  mockGetLocationPermission.mockResolvedValue({ granted: false, canAskAgain: true });
  mockHasServicesEnabled.mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('shows one native location alert after the user denies permission', async () => {
  mockRequestLocationPermission.mockResolvedValue('denied');
  const onDone = jest.fn();
  const screen = await render(<LocationPermissionScreen onDone={onDone} />);

  await fireEvent.press(screen.getByText('Allow location'));

  await waitFor(() => {
    expect(Alert.alert).toHaveBeenCalledWith(
      'Location Unavailable',
      expect.stringContaining('turn on Location Services'),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Not Now', style: 'cancel' }),
        expect.objectContaining({ text: 'Open Settings' }),
      ]),
      expect.any(Object),
    );
  });
  expect(mockRequestLocationPermission).toHaveBeenCalledTimes(1);
});

test('uses the same native alert when device Location Services are off', async () => {
  mockHasServicesEnabled.mockResolvedValue(false);
  const screen = await render(<LocationPermissionScreen onDone={jest.fn()} />);

  await waitFor(() => {
    expect(Alert.alert).toHaveBeenCalledWith(
      'Location Unavailable',
      expect.any(String),
      expect.any(Array),
      expect.any(Object),
    );
  });
  expect(mockRequestLocationPermission).not.toHaveBeenCalled();
});

test('the Not Now action continues without location', async () => {
  mockRequestLocationPermission.mockResolvedValue('denied');
  const onDone = jest.fn();
  const screen = await render(<LocationPermissionScreen onDone={onDone} />);
  await fireEvent.press(screen.getByText('Allow location'));

  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  const buttons = jest.mocked(Alert.alert).mock.calls[0][2];
  const notNow = buttons?.find((button) => button.text === 'Not Now');
  notNow?.onPress?.();

  expect(onDone).toHaveBeenCalledTimes(1);
});

test('shows a native alert when location is turned off while the app is backgrounded', async () => {
  mockGetLocationPermission.mockResolvedValue({ granted: true, canAskAgain: true });
  const screen = await render(<LocationAvailabilityAlert enabled />);

  await waitFor(() => expect(mockHasServicesEnabled).toHaveBeenCalledTimes(1));
  expect(Alert.alert).not.toHaveBeenCalled();

  mockHasServicesEnabled.mockResolvedValue(false);
  emitAppState('inactive');
  emitAppState('active');

  await waitFor(() => {
    expect(Alert.alert).toHaveBeenCalledWith(
      'Location Unavailable',
      expect.any(String),
      expect.any(Array),
      expect.any(Object),
    );
  });
  screen.unmount();
});

test('allows the location alert to appear again after returning from Settings', async () => {
  mockGetLocationPermission.mockResolvedValue({ granted: true, canAskAgain: true });
  mockHasServicesEnabled.mockResolvedValue(false);
  const screen = await render(<LocationAvailabilityAlert enabled />);

  await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));
  const openSettings = jest.mocked(Alert.alert).mock.calls[0][2]
    ?.find((button) => button.text === 'Open Settings');
  openSettings?.onPress?.();

  expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  emitAppState('inactive');
  emitAppState('active');

  await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(2));
  screen.unmount();
});
