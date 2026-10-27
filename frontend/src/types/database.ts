export type UserProfile = {
  id: string;
  email: string | null;
  username: string | null;
  created_at: string | null;
};

export type ListeningEvent = {
  id: string;
  user_id: string;
  track_id: string;
  title: string;
  artist: string;
  duration_ms: number;
  spotify_url: string | null;
  genre: string | null;
  latitude: number | null;
  longitude: number | null;
  listened_at: string;
  created_at: string;
};

export type ListeningHistoryInsert = Pick<
  ListeningEvent,
  'user_id' | 'track_id' | 'title' | 'artist' | 'duration_ms' | 'spotify_url' | 'listened_at'
>;

// Only tables defined in committed migrations are included in the client schema.
export type Database = {
  public: {
    Tables: {
      listening_history: {
        Row: ListeningEvent;
        Insert: ListeningHistoryInsert;
        Update: Partial<ListeningHistoryInsert>;
        Relationships: [];
      };
    };
    Views: { [key: string]: never };
    Functions: { [key: string]: never };
    Enums: { [key: string]: never };
    CompositeTypes: { [key: string]: never };
  };
};

export type FriendConnection = {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string | null;
};
