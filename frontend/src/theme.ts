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
export const unknownGenreColor = '#8E8E8E';

export const genreColors: Record<string, string> = {
  Pop: '#C2185B',
  Rock: '#795548',
  Electronic: '#00838F',
  Indie: '#7B1FA2',
  Latin: '#EF6C00',
  Country: '#827717',
  'R&B': '#6C63E0',
  'Hip Hop': '#4CAF6A',
  Rap: '#E53935',
  Jazz: '#4A90E2',
  Classical: '#283593',
  Metal: '#546E7A',
  Folk: '#558B2F',
  Reggae: '#00695C',
  'K-pop': '#AD1457',
  Afrobeats: '#8D6E63',
  Other: unknownGenreColor,
};

const genreFamilyAliases: Record<string, string> = {
  pop: 'Pop',
  'dance pop': 'Pop',
  'synth pop': 'Pop',
  electropop: 'Pop',
  'art pop': 'Pop',
  'teen pop': 'Pop',
  'pop rock': 'Pop',
  rock: 'Rock',
  'alternative rock': 'Rock',
  'alt rock': 'Rock',
  'classic rock': 'Rock',
  'hard rock': 'Rock',
  punk: 'Rock',
  'punk rock': 'Rock',
  'post punk': 'Rock',
  grunge: 'Rock',
  'garage rock': 'Rock',
  'progressive rock': 'Rock',
  'hip hop': 'Hip Hop',
  hiphop: 'Hip Hop',
  'conscious hip hop': 'Hip Hop',
  'alternative hip hop': 'Hip Hop',
  rap: 'Rap',
  'gangsta rap': 'Rap',
  'melodic rap': 'Rap',
  'pop rap': 'Rap',
  trap: 'Rap',
  drill: 'Rap',
  'uk drill': 'Rap',
  'r and b': 'R&B',
  'rhythm and blues': 'R&B',
  'contemporary r and b': 'R&B',
  soul: 'R&B',
  'neo soul': 'R&B',
  electronic: 'Electronic',
  edm: 'Electronic',
  dance: 'Electronic',
  house: 'Electronic',
  'deep house': 'Electronic',
  'tech house': 'Electronic',
  techno: 'Electronic',
  trance: 'Electronic',
  dubstep: 'Electronic',
  'drum and bass': 'Electronic',
  dnb: 'Electronic',
  ambient: 'Electronic',
  synthwave: 'Electronic',
  indie: 'Indie',
  'indie pop': 'Indie',
  'indie rock': 'Indie',
  'indie folk': 'Indie',
  'bedroom pop': 'Indie',
  latin: 'Latin',
  'latin pop': 'Latin',
  reggaeton: 'Latin',
  'latin trap': 'Latin',
  bachata: 'Latin',
  salsa: 'Latin',
  merengue: 'Latin',
  'regional mexican': 'Latin',
  country: 'Country',
  'country pop': 'Country',
  bluegrass: 'Country',
  americana: 'Country',
  jazz: 'Jazz',
  'smooth jazz': 'Jazz',
  bebop: 'Jazz',
  'bossa nova': 'Jazz',
  classical: 'Classical',
  opera: 'Classical',
  orchestral: 'Classical',
  'chamber music': 'Classical',
  metal: 'Metal',
  'heavy metal': 'Metal',
  metalcore: 'Metal',
  'death metal': 'Metal',
  'black metal': 'Metal',
  'power metal': 'Metal',
  folk: 'Folk',
  'singer songwriter': 'Folk',
  acoustic: 'Folk',
  'folk rock': 'Folk',
  reggae: 'Reggae',
  dancehall: 'Reggae',
  ska: 'Reggae',
  dub: 'Reggae',
  'k pop': 'K-pop',
  kpop: 'K-pop',
  afrobeats: 'Afrobeats',
  afrobeat: 'Afrobeats',
  amapiano: 'Afrobeats',
};

function normalizeGenreLabel(genre: string): string {
  return genre
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function getGenreFamily(genre: string | null): string {
  if (!genre?.trim()) {
    return 'Other';
  }
  return genreFamilyAliases[normalizeGenreLabel(genre)] ?? 'Other';
}

export function getGenreColor(genre: string | null): string {
  return genreColors[getGenreFamily(genre)];
}
