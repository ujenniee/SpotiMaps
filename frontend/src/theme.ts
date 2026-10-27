export const colors = {
  cream: '#FAF3DD', 
  sage: '#8FC0A9', 
  input: '#CFCFCF',
  spotifyGreen: '#1ED760',
  card: '#696D7D',
  white: '#FFFFFF',
  text: '#000000',
  textMuted: '#4A4A4A',
  error: '#B3261E',
};
export const genreColors: Record<string, string> = {
  'R&B': '#6C63E0',
  'Hip Hop': '#4CAF6A',
  Jazz: '#4A90E2',
};
export const unknownGenreColor = '#8E8E8E';

export function getGenreColor(genre: string | null): string {
  if (genre === null) {
    return unknownGenreColor;
  }
  return genreColors[genre] ?? unknownGenreColor;
}
