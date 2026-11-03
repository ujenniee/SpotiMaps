import { supabase } from '../lib/supabase';
import type { MapPlace, Song } from '../data/mockData';
import type { MatchedListeningEvent } from '../types/database';

export type MapPlacesResult =
  | { status: 'ok'; places: MapPlace[] }
  | { status: 'empty' }
  | { status: 'error'; message: string };

const MAX_EVENTS = 500;

function normalizeGenre(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildSongs(events: MatchedListeningEvent[]): Song[] {
  const songs = new Map<string, Song>();

  events.forEach((event) => {
    const key = event.track_id || `${event.title}|${event.artist}`;
    const existing = songs.get(key);

    if (existing) {
      existing.plays += 1;
      return;
    }

    songs.set(key, {
      title: event.title,
      artist: event.artist || 'Unknown artist',
      genre: normalizeGenre(event.genre),
      plays: 1,
    });
  });

  return [...songs.values()].sort((a, b) => b.plays - a.plays);
}

export async function fetchMapPlaces(): Promise<MapPlacesResult> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return { status: 'empty' };
    }

    const from = new Date(0).toISOString();
    const to = new Date().toISOString();

    const { error: matchError } = await supabase.rpc('match_listening_locations', {
      p_from: from,
      p_to: to,
    });
    if (matchError) {
      console.warn('match_listening_locations error:', matchError.message);
    }

    const { data, error } = await supabase.rpc('get_matched_listening_history', {
      p_from: from,
      p_to: to,
      p_limit: MAX_EVENTS,
    });

    if (error) {
      console.warn('get_matched_listening_history error:', error.message);
      return { status: 'error', message: error.message };
    }

    const events = (data ?? []) as MatchedListeningEvent[];


    const matched = events.filter(
      (event) =>
        event.match_status === 'matched' && event.latitude !== null && event.longitude !== null,
    );

    if (matched.length === 0) {
      return { status: 'empty' };
    }

    const groups = new Map<string, { latitude: number; longitude: number; events: MatchedListeningEvent[] }>();

    matched.forEach((event) => {
      const latitude = event.latitude as number;
      const longitude = event.longitude as number;
      const key = event.location_id ?? `${latitude.toFixed(4)}|${longitude.toFixed(4)}`;
      const existing = groups.get(key);

      if (existing) {
        existing.events.push(event);
        return;
      }

      groups.set(key, { latitude, longitude, events: [event] });
    });

    const places: MapPlace[] = [...groups.entries()].map(([key, group], index) => ({
      id: key,
      name: `Listening spot ${index + 1}`,
      area: 'From your listening history',
      latitude: group.latitude,
      longitude: group.longitude,
      songs: buildSongs(group.events),
    }));

    return { status: 'ok', places };
  } catch (error) {
    console.warn('fetchMapPlaces crashed:', error);
    const message = error instanceof Error ? error.message : 'Something went wrong.';
    return { status: 'error', message };
  }
}