import { fireEvent, render, waitFor } from '@testing-library/react-native';
import PrivacyScreen from '../src/screens/PrivacyScreen';

const settings = {
  location_tracking_enabled: true,
  map_visibility: 'private' as const,
};

const renderPrivacyScreen = (overrides = {}) =>
  render(
    <PrivacyScreen
      settings={settings}
      isSettingsLoading={false}
      settingsError={null}
      trackingStatus={null}
      onSave={jest.fn().mockResolvedValue(undefined)}
      onRetry={jest.fn()}
      onLogout={jest.fn().mockResolvedValue(undefined)}
      {...overrides}
    />,
  );

test('saves tracking and map visibility choices', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(
    <PrivacyScreen
      settings={settings}
      isSettingsLoading={false}
      settingsError={null}
      trackingStatus={null}
      onSave={onSave}
      onRetry={jest.fn()}
      onLogout={jest.fn().mockResolvedValue(undefined)}
    />,
  );

  fireEvent(screen.getByLabelText('Location tracking'), 'valueChange', false);
  await waitFor(() => {
    expect(onSave).toHaveBeenCalledWith({ location_tracking_enabled: false });
  });

  fireEvent.press(screen.getByText('Friends'));
  await waitFor(() => {
    expect(onSave).toHaveBeenCalledWith({ map_visibility: 'friends' });
  });
});

test('shows save failures without changing the saved preference', async () => {
  const onSave = jest.fn().mockRejectedValue(new Error('Network unavailable'));
  const screen = await render(
    <PrivacyScreen
      settings={settings}
      isSettingsLoading={false}
      settingsError={null}
      trackingStatus={null}
      onSave={onSave}
      onRetry={jest.fn()}
      onLogout={jest.fn().mockResolvedValue(undefined)}
    />,
  );

  fireEvent(screen.getByLabelText('Location tracking'), 'valueChange', false);

  expect(await screen.findByText('Network unavailable')).toBeTruthy();
  expect(screen.getByLabelText('Location tracking').props.value).toBe(true);
});

test('logs the user out from the settings screen', async () => {
  const onLogout = jest.fn().mockResolvedValue(undefined);
  const screen = await render(
    <PrivacyScreen
      settings={settings}
      isSettingsLoading={false}
      settingsError={null}
      trackingStatus={null}
      onSave={jest.fn().mockResolvedValue(undefined)}
      onRetry={jest.fn()}
      onLogout={onLogout}
    />,
  );

  fireEvent.press(screen.getByText('Log Out'));

  await waitFor(() => {
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
