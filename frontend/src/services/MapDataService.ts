import { supabase } from '../lib/supabase';
import { mockPlaces, type MapPlace, type Song } from '../data/mockData';

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

export async function fetchMapPlaces(): Promise<MapPlace[]> {
  try {
    const { data, error } = await supabase.from('listening_history').select('*').limit(200);

    if (error || !data || data.length === 0) {
      return mockPlaces;
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

    return places.length > 0 ? places : mockPlaces;
  } catch {
    return mockPlaces;
  }
}
