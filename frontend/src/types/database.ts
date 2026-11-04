export type UserProfile = {
  id: string;
  email: string | null;
  username: string | null;
  created_at: string;
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
  location_id: string | null;
  listened_at: string;
  created_at: string;
};

export type ListeningHistoryInsert = Pick<
  ListeningEvent,
  'user_id' | 'track_id' | 'title' | 'artist' | 'duration_ms' | 'spotify_url' | 'listened_at'
>;

export type StoredLocationSample = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  created_at: string;
};

export type LocationSampleInsert = Pick<
  StoredLocationSample,
  'user_id' | 'latitude' | 'longitude' | 'recorded_at'
>;

export type ListeningMatchResult = {
  examined_count: number;
  matched_count: number;
  unmatched_count: number;
  changed_count: number;
};

export type MatchedListeningEvent = Pick<
  ListeningEvent,
  'id' | 'track_id' | 'title' | 'artist' | 'duration_ms' | 'spotify_url' | 'genre'
  | 'listened_at' | 'location_id' | 'latitude' | 'longitude'
> & {
  location_recorded_at: string | null;
  time_gap_seconds: number | null;
  match_status: 'matched' | 'unmatched';
};

// Only tables defined in committed migrations are included in the client schema.
export type Database = {
  public: {
    Tables: {
      location_samples: {
        Row: StoredLocationSample;
        Insert: LocationSampleInsert;
        Update: Partial<LocationSampleInsert>;
        Relationships: [];
      };
      profiles: {
        Row: UserProfile;
        Insert: {
          id: string;
          email?: string | null;
          username?: string | null;
          created_at?: string;
        };
        Update: {
          username?: string | null;
        };
        Relationships: [];
      };
      listening_history: {
        Row: ListeningEvent;
        Insert: ListeningHistoryInsert;
        Update: Partial<ListeningHistoryInsert>;
        Relationships: [{
          foreignKeyName: 'listening_history_location_sample_fkey';
          columns: ['user_id', 'location_id'];
          isOneToOne: false;
          referencedRelation: 'location_samples';
          referencedColumns: ['user_id', 'id'];
        }];
      };
    };
    Views: { [key: string]: never };
    Functions: {
      match_listening_locations: {
        Args: { p_from: string; p_to: string; p_max_gap_seconds?: number };
        Returns: ListeningMatchResult[];
      };
      get_matched_listening_history: {
        Args: { p_from: string; p_to: string; p_limit?: number; p_offset?: number };
        Returns: MatchedListeningEvent[];
      };
    };
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
