import { fireEvent, render, waitFor } from '@testing-library/react-native';
import FriendScreen from '../src/screens/FriendScreen';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriendRequests,
  fetchFriends,
  removeFriend,
  searchUsers,
  sendFriendRequest,
} from '../src/services/FriendService';
import { supabase } from '../src/lib/supabase';
jest.mock('../src/screens/FriendMapScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
}));
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
jest.mock('../src/services/FriendService', () => ({
  acceptFriendRequest: jest.fn().mockResolvedValue(true),
  cancelFriendRequest: jest.fn().mockResolvedValue(true),
  declineFriendRequest: jest.fn().mockResolvedValue(true),
  fetchFriendRequests: jest.fn(),
  fetchFriends: jest.fn(),
  removeFriend: jest.fn().mockResolvedValue(true),
  searchUsers: jest.fn(),
  sendFriendRequest: jest.fn().mockResolvedValue('new-request'),
}));
jest.setTimeout(15000);
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchFriendRequests).mockResolvedValue([
    { id: 'incoming-1', userId: 'user-2', name: 'alice', color: '#123456', direction: 'incoming' },
    { id: 'outgoing-1', userId: 'user-3', name: 'bob', color: '#654321', direction: 'outgoing' },
  ]);
  jest.mocked(fetchFriends).mockResolvedValue([
    { id: 'user-4', name: 'charlie', color: '#abcdef', mapVisible: false },
  ]);
  jest.mocked(searchUsers).mockResolvedValue([{ id: 'user-5', username: 'dana' }]);
});

async function renderFriendScreen() {
  const screen = await render(<FriendScreen />);
  await screen.findByText('ALICE');
  return screen;
}

async function waitForRefresh() {
  await waitFor(() => {
    expect(fetchFriendRequests).toHaveBeenCalledTimes(2);
  });
}

test('shows fetched friends and requests and accepts incoming requests', async () => {
  const screen = await renderFriendScreen();
  expect(screen.getByText('BOB')).toBeTruthy();
  expect(screen.getByText('CHARLIE')).toBeTruthy();

  fireEvent.press(screen.getByText('Accept'));
  await waitFor(() => {
    expect(acceptFriendRequest).toHaveBeenCalledWith(supabase, 'incoming-1');
  });
  await waitForRefresh();
});

test('declines incoming requests', async () => {
  const screen = await renderFriendScreen();
  fireEvent.press(screen.getByText('Decline'));
  await waitFor(() => {
    expect(declineFriendRequest).toHaveBeenCalledWith(supabase, 'incoming-1');
  });
  await waitForRefresh();
});

test('cancels outgoing requests', async () => {
  const screen = await renderFriendScreen();
  fireEvent.press(screen.getByText('Cancel'));
  await waitFor(() => {
    expect(cancelFriendRequest).toHaveBeenCalledWith(supabase, 'outgoing-1');
  });
  await waitForRefresh();
});

test('removes a friend', async () => {
  const screen = await renderFriendScreen();
  fireEvent.press(screen.getByText('Remove'));
  await waitFor(() => {
    expect(removeFriend).toHaveBeenCalledWith(supabase, 'user-4');
  });
  await waitForRefresh();
});

test('searches users by username and sends a request', async () => {
  const screen = await renderFriendScreen();
  fireEvent.changeText(screen.getByPlaceholderText('Search by username'), 'dan');
  await waitFor(() => {
    expect(searchUsers).toHaveBeenCalledWith(supabase, 'dan');
  });
  fireEvent.press(await screen.findByText('Add Friend'));
  await waitFor(() => {
    expect(sendFriendRequest).toHaveBeenCalledWith(supabase, 'user-5');
  });
  await waitForRefresh();
});
