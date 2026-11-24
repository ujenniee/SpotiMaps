const assert = require('node:assert/strict');
const { test } = require('node:test');
const { genreColors, getGenreColor, getGenreFamily } = require('../src/theme.ts');
const {
  getMarkerGenreFamilies,
  getPresentGenreFamilies,
} = require('../src/utils/placeStats.ts');

function place(id, songs) {
  return {
    id,
    name: id,
    area: 'Test area',
    latitude: 0,
    longitude: 0,
    songs,
  };
}

test('popular genre families have distinct colors and preserve existing genres', () => {
  assert.equal(getGenreColor('Rap'), '#E53935');
  assert.equal(getGenreColor('Hip Hop'), '#4CAF6A');
  assert.equal(getGenreColor('R&B'), '#6C63E0');
  assert.equal(getGenreColor('Jazz'), '#4A90E2');
  assert.equal(new Set(Object.values(genreColors)).size, Object.keys(genreColors).length);
});

test('maps common Spotify subgenres to families and unknown genres to Other', () => {
  assert.equal(getGenreFamily('indie-pop'), 'Indie');
  assert.equal(getGenreFamily('UK Drill'), 'Rap');
  assert.equal(getGenreFamily('K-pop'), 'K-pop');
  assert.equal(getGenreFamily('R&B'), 'R&B');
  assert.equal(getGenreFamily(null), 'Other');
  assert.equal(getGenreFamily('unmapped genre'), 'Other');
  assert.equal(getGenreColor(null), '#8E8E8E');
});

test('returns only populated genre families across map places', () => {
  assert.deepEqual(getPresentGenreFamilies([
    place('first', [
      { title: 'Song A', artist: 'Artist', genre: 'indie pop', plays: 2 },
      { title: 'Song B', artist: 'Artist', genre: 'Rock', plays: 1 },
      { title: 'Song C', artist: 'Artist', genre: null, plays: 3 },
    ]),
    place('second', [
      { title: 'Song D', artist: 'Artist', genre: 'unknown tag', plays: 1 },
      { title: 'Song E', artist: 'Artist', genre: 'Jazz', plays: 0 },
    ]),
  ]), ['Indie', 'Other', 'Rock']);
});

test('marker legend contains only genres used by each place marker', () => {
  assert.deepEqual(getMarkerGenreFamilies([
    place('first', [
      { title: 'Song A', artist: 'Artist', genre: 'indie pop', plays: 4 },
      { title: 'Song B', artist: 'Artist', genre: 'Rock', plays: 2 },
    ]),
    place('second', [
      { title: 'Song C', artist: 'Artist', genre: 'unknown tag', plays: 3 },
      { title: 'Song D', artist: 'Artist', genre: 'Jazz', plays: 1 },
    ]),
  ]), ['Indie', 'Other']);
});

test('returns no legend genres for an empty map or zero-play songs', () => {
  assert.deepEqual(getPresentGenreFamilies([]), []);
  assert.deepEqual(getPresentGenreFamilies([
    place('empty', [{ title: 'Song', artist: 'Artist', genre: 'Pop', plays: 0 }]),
  ]), []);
});
