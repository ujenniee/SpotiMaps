export type UserProfile = {
  id: string;
  email: string | null;
  username: string | null;
  location_tracking_enabled: boolean;
  map_visibility: 'private' | 'friends';
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

export type FriendMapEvent = {
  id: string;
  location_id: string;
  title: string;
  artist: string;
  genre: string | null;
  latitude: number;
  longitude: number;
  listened_at: string;
};

export type FriendSummary = {
  friend_id: string;
  username: string | null;
  map_visible: boolean;
};

export type FriendRequestSummary = {
  id: string;
  other_user_id: string;
  username: string | null;
  direction: 'incoming' | 'outgoing';
  created_at: string;
};

export type UserSearchResult = {
  id: string;
  username: string;
};

export type FriendRequestRow = {
  id: string;
  requester_id: string;
  recipient_id: string;
  created_at: string;
};

// Only tables defined in committed migrations are included in the client schema.
export type Database = {
  public: {
    Tables: {
      friendships: {
        Row: {
          user_low: string;
          user_high: string;
          created_at: string;
        };
        Insert: {
          user_low: string;
          user_high: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      friend_requests: {
        Row: FriendRequestRow;
        Insert: Pick<FriendRequestRow, 'requester_id' | 'recipient_id'> & {
          id?: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
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
          location_tracking_enabled?: boolean;
          map_visibility?: 'private' | 'friends';
          created_at?: string;
        };
        Update: {
          username?: string | null;
          location_tracking_enabled?: boolean;
          map_visibility?: 'private' | 'friends';
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
      search_users: {
        Args: { p_username: string };
        Returns: UserSearchResult[];
      };
      list_friends: {
        Args: Record<string, never>;
        Returns: FriendSummary[];
      };
      list_friend_requests: {
        Args: Record<string, never>;
        Returns: FriendRequestSummary[];
      };
      send_friend_request: {
        Args: { p_recipient_id: string };
        Returns: string;
      };
      accept_friend_request: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      decline_friend_request: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      cancel_friend_request: {
        Args: { p_request_id: string };
        Returns: boolean;
      };
      remove_friend: {
        Args: { p_friend_id: string };
        Returns: boolean;
      };
      get_friend_map: {
        Args: {
          p_friend_id: string;
          p_from: string;
          p_to: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: FriendMapEvent[];
      };
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
