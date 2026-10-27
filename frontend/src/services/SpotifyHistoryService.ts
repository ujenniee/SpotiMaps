import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ListeningHistoryInsert } from '../types/database';

type SpotifyPlay = Omit<ListeningHistoryInsert, 'user_id'>;

type SpotifyHistoryItem = {
  played_at: string;
  track: {
    id: string | null;
    name: string;
    artists: { name: string }[];
    duration_ms: number;
    is_local?: boolean;
    external_urls?: { spotify?: string };
  } | null;
};

export class SpotifyHistoryError extends Error {
  status: number;
  retryAfterSeconds: number | null;

  constructor(status: number, retryAfterSeconds: number | null = null) {
    const messages: Record<number, string> = {
      401: 'Spotify authorization expired. Reconnect Spotify and retry.',
      403: 'Spotify denied access. Check the listening-history permission and tester access.',
      429: 'Spotify rate limit reached. Wait before retrying.',
    };
    super(messages[status] ?? 'Could not fetch Spotify listening history.');
    this.name = 'SpotifyHistoryError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Fetch up to 50 recent plays. Login must supply a token with user-read-recently-played. */
export async function fetchRecentlyPlayed(accessToken: string, fetcher: typeof fetch = fetch) {
  if (!accessToken.trim()) {
    throw new Error('A Spotify access token is required.');
  }

  const response = await fetcher('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
    headers: { Authorization: `Bearer ${accessToken.trim()}` },
  });
  if (!response.ok) {
    const header = response.headers.get('Retry-After');
    const seconds = header === null ? NaN : Number(header);
    throw new SpotifyHistoryError(response.status, Number.isFinite(seconds) && seconds >= 0 ? seconds : null);
  }

  const body = await response.json() as { items?: SpotifyHistoryItem[] } | null;
  if (!body || !Array.isArray(body.items)) {
    throw new Error('Spotify returned an invalid listening-history response.');
  }

  const plays: SpotifyPlay[] = [];
  let skippedCount = 0;
  for (const item of body.items) {
    const track = item?.track;
    // Local files and unavailable tracks have no usable Spotify track ID.
    if (track === null || track?.is_local || track?.id === null) {
      skippedCount += 1;
      continue;
    }
    if (!track || typeof track.id !== 'string' || !track.id.trim()
      || typeof track.name !== 'string' || !track.name.trim()
      || !Array.isArray(track.artists) || track.artists.length === 0
      || !track.artists.every((artist) => artist && typeof artist.name === 'string' && artist.name.trim())
      || !Number.isInteger(track.duration_ms) || track.duration_ms < 0
      || typeof item.played_at !== 'string'
      || !/(Z|[+-]\d{2}:\d{2})$/i.test(item.played_at)
      || !Number.isFinite(Date.parse(item.played_at))) {
      throw new Error('Spotify returned invalid song metadata or a play timestamp.');
    }
    plays.push({
      track_id: track.id,
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(', '),
      duration_ms: track.duration_ms,
      spotify_url: track.external_urls?.spotify ?? null,
      listened_at: new Date(item.played_at).toISOString(),
    });
  }
  return { plays, skippedCount };
}

/** Append recent plays to the signed-in Supabase user's history without duplicates. */
export async function syncListeningHistory(
  client: SupabaseClient<Database>,
  spotifyAccessToken: string,
  fetcher: typeof fetch = fetch,
) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) {
    throw new Error('Sign in to SpotiMaps before syncing listening history.');
  }
  const { plays, skippedCount } = await fetchRecentlyPlayed(spotifyAccessToken, fetcher);
  let insertedCount = 0;
  if (plays.length > 0) {
    const rows = plays.map((play) => ({ ...play, user_id: auth.user.id }));
    const { data, error } = await client.from('listening_history')
      .upsert(rows, { onConflict: 'user_id,track_id,listened_at', ignoreDuplicates: true })
      .select('id');
    if (error) {
      throw new Error(`Could not save listening history: ${error.message}`);
    }
    insertedCount = data?.length ?? 0;
  }
  return { fetchedCount: plays.length, insertedCount, skippedCount };
}
