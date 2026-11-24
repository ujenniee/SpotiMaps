import { getGenreFamily } from '../theme';

type MusicBrainzGenre = {
  name: string;
  count: number;
};

type MusicBrainzArtist = {
  id: string;
  name: string;
  score?: number;
};

type ArtistSearchResponse = {
  artists?: MusicBrainzArtist[];
};

type ArtistLookupResponse = {
  genres?: MusicBrainzGenre[];
};

const API_BASE = 'https://musicbrainz.org/ws/2';

// Search MusicBrainz for an artist
export async function searchArtist(
  artistName: string
): Promise<string | null> {
  const name = artistName.trim();

  if (!name) return null;

  const query = encodeURIComponent(
    `artist:"${name.replace(/"/g, '')}"`
  );

  const response = await fetch(
    `${API_BASE}/artist/?query=${query}&fmt=json&limit=10`,
    {
      headers: {
        'User-Agent': 'SpotiMaps/1.0 (contact: your-email@example.com)',
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `MusicBrainz artist search failed (${response.status}).`
    );
  }

  const data = (await response.json()) as ArtistSearchResponse;

  const match = data.artists?.find(
    (artist) =>
      artist.name.trim().toLowerCase() === name.toLowerCase()
  );

  return match?.id ?? null;
}

// Retrieve genres for an artist
export async function getArtistGenres(
  artistId: string
): Promise<MusicBrainzGenre[]> {
    const response = await fetch(
        `${API_BASE}/artist/${artistId}?inc=genres&fmt=json`,
        {
          headers: {
            'User-Agent': 'SpotiMaps/1.0 (contact: your-email@example.com)',
          },
        }
      );

  if (!response.ok) {
    throw new Error(
      `MusicBrainz genre lookup failed (${response.status}).`
    );
  }

  const data = (await response.json()) as ArtistLookupResponse;

  return (data.genres ?? [])
    .filter((genre) => genre.count > 0)
    .sort((a, b) => b.count - a.count);
}

// Select the best genre for SpotiMaps
export function selectGenre(
  genres: MusicBrainzGenre[]
): string | null {
  const sorted = [...genres].sort(
    (a, b) => b.count - a.count
  );

  const recognized = sorted.find(
    (genre) => getGenreFamily(genre.name) !== 'Other'
  );

  return recognized?.name ?? sorted[0]?.name ?? null;
}

// Main function: artist name -> genre
export async function lookupArtistGenre(
  artistName: string
): Promise<string | null> {
  const artistId = await searchArtist(artistName);

  if (!artistId) return null;

  // Respect the delay between MusicBrainz requests
  await new Promise((resolve) => setTimeout(resolve, 1100));

  const genres = await getArtistGenres(artistId);

  return selectGenre(genres);
}