import type { MapPlace, Song } from '../data/mockData';
import { getGenreFamily } from '../theme.ts';
import { getRankedSongs, getTopGenre, getTotalPlays } from './placeStats.ts';

export type MapExportRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapExportPoint = {
  x: number;
  y: number;
};

export const MAP_EXPORT_ASPECT_RATIO = 360 / 205;

const DEFAULT_MAP_CENTER = { latitude: 47.6545, longitude: -122.307 };
const MIN_REGION_DELTA = 0.012;
const REGION_PADDING = 1.35;
const MAX_MERCATOR_LATITUDE = 85.05112878;

function mercatorY(latitude: number): number {
  const clampedLatitude = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, latitude),
  );
  const radians = (clampedLatitude * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function getMapExportRegion(
  places: MapPlace[],
  aspectRatio = MAP_EXPORT_ASPECT_RATIO,
): MapExportRegion {
  const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0
    ? aspectRatio
    : MAP_EXPORT_ASPECT_RATIO;
  const validPlaces = places.filter(
    (place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
  );
  if (validPlaces.length === 0) {
    return {
      ...DEFAULT_MAP_CENTER,
      latitudeDelta: MIN_REGION_DELTA,
      longitudeDelta: MIN_REGION_DELTA,
    };
  }

  const latitudes = validPlaces.map((place) => place.latitude);
  const longitudes = validPlaces.map((place) => place.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitude = (minLatitude + maxLatitude) / 2;
  const longitude = (minLongitude + maxLongitude) / 2;
  const cosineLatitude = Math.max(
    0.01,
    Math.cos((latitude * Math.PI) / 180),
  );
  const latitudeSpan = maxLatitude - minLatitude;
  const longitudeSpan = maxLongitude - minLongitude;
  const requiredLatitudeSpan = Math.max(
    latitudeSpan,
    (longitudeSpan * cosineLatitude) / safeAspectRatio,
  );
  const latitudeDelta = Math.max(
    MIN_REGION_DELTA,
    requiredLatitudeSpan * REGION_PADDING,
  );

  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta: Math.max(
      MIN_REGION_DELTA,
      (latitudeDelta * safeAspectRatio) / cosineLatitude,
      longitudeSpan * REGION_PADDING,
    ),
  };
}

export function getMapExportMarkerPosition(
  place: MapPlace,
  region: MapExportRegion,
): MapExportPoint {
  const west = region.longitude - region.longitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;
  const south = region.latitude - region.latitudeDelta / 2;
  const northY = mercatorY(north);
  const southY = mercatorY(south);
  const verticalSpan = northY - southY;

  return {
    x: clampUnit((place.longitude - west) / region.longitudeDelta),
    y: verticalSpan > 0
      ? clampUnit((northY - mercatorY(place.latitude)) / verticalSpan)
      : 0.5,
  };
}

export function getMapExportSongs(places: MapPlace[], selectedPlaceId?: string | null): Song[] {
  const selectedPlace = places.find((place) => place.id === selectedPlaceId);
  if (selectedPlace) {
    return getRankedSongs(selectedPlace).filter((song) => song.plays > 0).slice(0, 3);
  }

  const songsByTrack = new Map<string, Song>();
  places.forEach((place) => {
    place.songs.forEach((song) => {
      if (song.plays <= 0) {
        return;
      }

      const key = `${song.title.trim().toLowerCase()}\u0000${song.artist.trim().toLowerCase()}`;
      const existing = songsByTrack.get(key);
      if (existing) {
        existing.plays += song.plays;
      } else {
        songsByTrack.set(key, { ...song });
      }
    });
  });

  return [...songsByTrack.values()].sort((first, second) => second.plays - first.plays).slice(0, 3);
}

export function getMapExportGenres(places: MapPlace[], displayedSongs: Song[] = []): string[] {
  const playsByGenre = new Map<string, number>();
  places.forEach((place) => {
    const markerGenre = getGenreFamily(getTopGenre(place));
    playsByGenre.set(markerGenre, (playsByGenre.get(markerGenre) ?? 0) + getTotalPlays(place));
  });
  displayedSongs.forEach((song) => {
    if (song.plays > 0) {
      const family = getGenreFamily(song.genre);
      playsByGenre.set(family, (playsByGenre.get(family) ?? 0) + song.plays);
    }
  });

  return [...playsByGenre.entries()]
    .sort(([firstGenre, firstPlays], [secondGenre, secondPlays]) => (
      secondPlays - firstPlays || firstGenre.localeCompare(secondGenre)
    ))
    .map(([genre]) => genre);
}
