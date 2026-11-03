import type { MapPlace, Song } from '../data/mockData';

export type GenreShare = {
  genre: string | null;
  plays: number;
  percent: number;
};

export function getTotalPlays(place: MapPlace): number {
  return place.songs.reduce((sum, song) => sum + song.plays, 0);
}

export function getGenreBreakdown(place: MapPlace): GenreShare[] {
  const totals = new Map<string | null, number>();
  place.songs.forEach((song) => {
    totals.set(song.genre, (totals.get(song.genre) ?? 0) + song.plays);
  });
  const total = getTotalPlays(place);
  return [...totals.entries()]
    .map(([genre, plays]) => ({
      genre,
      plays,
      percent: total === 0 ? 0 : Math.round((plays / total) * 100),
    }))
    .sort((a, b) => b.plays - a.plays);
}

export function getTopGenre(place: MapPlace): string | null {
  return getGenreBreakdown(place)[0]?.genre ?? null;
}

// Songs sorted by most played, for the Song Card list
export function getRankedSongs(place: MapPlace): Song[] {
  return [...place.songs].sort((a, b) => b.plays - a.plays);
}