import { mockPlaces } from '../data/mockData';

export type FriendRequest = {
  id: string;
  name: string;
  color: string;
  direction: 'incoming' | 'outgoing';
};

export type Friend = {
  id: string;
  name: string;
  color: string;
  mapVisible: boolean;
};

const FALLBACK_REQUESTS: FriendRequest[] = [
  { id: 'emily', name: 'Emily Phan', color: '#6C63E0', direction: 'incoming' },
  { id: 'jennie', name: 'Jennie Ung', color: '#E0525E', direction: 'outgoing' },
];

const FALLBACK_FRIENDS: Friend[] = [
  { id: 'kairo', name: 'Kairo', color: '#E8C547', mapVisible: true },
  { id: 'aidan', name: 'Aidan', color: '#4FB3A5', mapVisible: true },
  { id: 'zu', name: 'Zu', color: '#E8914A', mapVisible: false },
];

export async function fetchFriendRequests(): Promise<FriendRequest[]> {
  return FALLBACK_REQUESTS;
}

export async function fetchFriends(): Promise<Friend[]> {
  return FALLBACK_FRIENDS;
}

export function getMockPlacesCount() {
  return mockPlaces.length;
}
