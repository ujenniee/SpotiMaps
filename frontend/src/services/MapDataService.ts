import { supabase } from '../lib/supabase';
import type { MapPlace, Song } from '../data/mockData';

export type MapPlacesResult =
  | { status: 'ok'; places: MapPlace[] }
  | { status: 'empty' }
  | { status: 'error'; message: string };

function normalizeGenre(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function aggregateSongs(rows: Array<Record<string, unknown>>): Song[] {
  const totals = new Map<string, { song: Song; key: string }>();

  rows.forEach((row) => {
    const title = typeof row.title === 'string' ? row.title : '';
    const artist = typeof row.artist === 'string' ? row.artist : 'Unknown artist';
    const genre = normalizeGenre(row.genre);
    const plays = Number(row.plays ?? row.listen_count ?? 1);

    if (!title) {
      return;
    }

    const key = `${title}|${artist}|${genre ?? 'unknown'}`;
    const existing = totals.get(key);

    if (existing) {
      existing.song.plays += Number.isFinite(plays) ? plays : 1;
      return;
    }

    totals.set(key, {
      key,
      song: {
        title,
        artist,
        genre,
        plays: Number.isFinite(plays) ? plays : 1,
      },
    });
  });

  return [...totals.values()].map((entry) => entry.song).sort((a, b) => b.plays - a.plays);
}

export async function fetchMapPlaces(): Promise<MapPlacesResult> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return { status: 'empty' };
    }

    const { data, error } = await supabase.from('listening_history').select('*').limit(200);

    if (error) {
      console.warn('fetchMapPlaces Supabase error:', error.message);
      return { status: 'error', message: error.message };
    }

    // No plays yet (for example, Spotify isn't connected yet)
    if (!data || data.length === 0) {
      return { status: 'empty' };
    }

    const grouped = new Map<string, { place: MapPlace; rows: Record<string, unknown>[] }>();

    data.forEach((row) => {
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      const key = `${latitude.toFixed(5)}|${longitude.toFixed(5)}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.rows.push(row);
        return;
      }

      grouped.set(key, {
        place: {
          id: key,
          name: `Listening stop ${grouped.size + 1}`,
          area: 'Supabase',
          latitude,
          longitude,
          songs: [],
        },
        rows: [row],
      });
    });

    const places = [...grouped.values()].map(({ place, rows }) => ({
      ...place,
      songs: aggregateSongs(rows),
    }));

    return places.length > 0 ? { status: 'ok', places } : { status: 'empty' };
  } catch (error) {
    console.warn('fetchMapPlaces crashed:', error);
    const message = error instanceof Error ? error.message : 'Something went wrong.';
    return { status: 'error', message };
  }
}