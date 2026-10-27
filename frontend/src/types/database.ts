export type UserProfile = {
  id: string;
  email: string | null;
  username: string | null;
  created_at: string | null;
};

export type ListeningEvent = {
  id: string;
  user_id: string;
  track_id: string | null;
  title: string | null;
  artist: string | null;
  genre: string | null;
  latitude: number | null;
  longitude: number | null;
  listened_at: string | null;
  created_at: string | null;
};

export type FriendConnection = {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string | null;
};
