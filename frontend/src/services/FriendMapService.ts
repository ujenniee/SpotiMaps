import type { SupabaseClient } from '@supabase/supabase-js';
import type { MapPlace, Song } from '../data/mockData';
import type { Database, FriendMapEvent } from '../types/database';

const HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;

export class FriendMapUnavailableError extends Error {
  constructor() {
    super('This friend map is unavailable.');
    this.name = 'FriendMapUnavailableError';
  }
}

export type FriendMapRange = {
  from: string;
  to: string;
};

function createSongs(rows: FriendMapEvent[]): Song[] {
  const songs = new Map<string, Song>();

  rows.forEach((row) => {
    const title = row.title.trim();
    if (!title) {
      return;
    }

    const artist = row.artist || 'Unknown artist';
    const genre = row.genre?.trim() || null;
    const key = JSON.stringify([title, artist, genre]);
    const existing = songs.get(key);

    if (existing) {
      existing.plays += 1;
    } else {
      songs.set(key, { title, artist, genre, plays: 1 });
    }
  });

  return [...songs.values()].sort((a, b) => b.plays - a.plays);
}

export async function fetchFriendMapPlaces(
  client: SupabaseClient<Database>,
  friendId: string,
  range?: FriendMapRange,
): Promise<MapPlace[]> {
  const to = range?.to ?? new Date().toISOString();
  const from = range?.from ?? new Date(Date.parse(to) - HISTORY_WINDOW_MS).toISOString();
  const rows: FriendMapEvent[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.rpc('get_friend_map', {
      p_friend_id: friendId,
      p_from: from,
      p_to: to,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });

    if (error) {
      if (error.code === '42501') {
        throw new FriendMapUnavailableError();
      }
      throw new Error(`Could not retrieve friend map: ${error.message}`);
    }
    if (!data) {
      throw new Error('Friend-map retrieval did not return a result.');
    }

    rows.push(...data);
    if (data.length < PAGE_SIZE) {
      break;
    }
  }

  const groups = new Map<string, {
    latitude: number;
    longitude: number;
    rows: FriendMapEvent[];
  }>();

  rows.forEach((row) => {
    const group = groups.get(row.location_id);
    if (group) {
      group.rows.push(row);
    } else {
      groups.set(row.location_id, {
        latitude: row.latitude,
        longitude: row.longitude,
        rows: [row],
      });
    }
  });

  return [...groups.entries()].map(([locationId, group], index) => ({
    id: locationId,
    name: `Listening stop ${index + 1}`,
    area: 'Recorded GPS location',
    latitude: group.latitude,
    longitude: group.longitude,
    songs: createSongs(group.rows),
  }));
}
