// Demo fixtures retained for non-map mock consumers. Map data comes from Supabase.

export type Song = {
  title: string;
  artist: string;
  genre: string | null;
  plays: number;
};

export type MapPlace = {
  id: string;
  name: string;
  area: string;
  latitude: number;
  longitude: number;
  songs: Song[];
};

export const mockPlaces: MapPlace[] = [
  {
    id: 'hub',
    name: 'Husky Union Building',
    area: 'University District',
    latitude: 47.6553,
    longitude: -122.3051,
    songs: [
      { title: "Don't", artist: 'Bryson Tiller', genre: 'R&B', plays: 14 },
      { title: 'Snooze', artist: 'SZA', genre: 'R&B', plays: 12 },
      { title: 'PUSH 2 START', artist: 'Tyla', genre: 'R&B', plays: 10 },
      { title: 'Pink + White', artist: 'Frank Ocean', genre: 'R&B', plays: 8 },
      { title: 'NOKIA', artist: 'Drake', genre: 'Hip Hop', plays: 6 },
      { title: 'TIMELESS', artist: 'Playboi Carti & The Weeknd', genre: 'Hip Hop', plays: 4 },
      { title: 'Promise', artist: 'Laufey', genre: 'Jazz', plays: 4 },
      { title: 'Best Part', artist: 'Daniel Caesar ft. H.E.R.', genre: 'R&B', plays: 3 },
    ],
  },
  {
    id: 'allen',
    name: 'Paul G. Allen Center',
    area: 'University District',
    latitude: 47.6534,
    longitude: -122.3059,
    songs: [
      { title: 'NOKIA', artist: 'Drake', genre: 'Hip Hop', plays: 20 },
      { title: 'TIMELESS', artist: 'Playboi Carti & The Weeknd', genre: 'Hip Hop', plays: 18 },
      { title: 'Snooze', artist: 'SZA', genre: 'R&B', plays: 13 },
      { title: 'Promise', artist: 'Laufey', genre: 'Jazz', plays: 10 },
    ],
  },
  {
    id: 'gates',
    name: 'Bill & Melinda Gates Center',
    area: 'University District',
    latitude: 47.6527,
    longitude: -122.3046,
    songs: [
      { title: 'Promise', artist: 'Laufey', genre: 'Jazz', plays: 20 },
      { title: 'From The Start', artist: 'Laufey', genre: 'Jazz', plays: 15 },
      { title: 'Best Part', artist: 'Daniel Caesar ft. H.E.R.', genre: 'R&B', plays: 8 },
      { title: 'NOKIA', artist: 'Drake', genre: 'Hip Hop', plays: 5 },
    ],
  },
];