const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  getMapExportGenres,
  getMapExportMarkerPosition,
  getMapExportRegion,
  getMapExportSongs,
} = require('../src/utils/mapExport.ts');

function place(id, latitude, longitude, songs) {
  return { id, name: id, area: 'Test area', latitude, longitude, songs };
}

test('whole-map export aggregates duplicate tracks and ranks the most-played songs', () => {
  const places = [
    place('first', 47.65, -122.31, [
      { title: 'Track A', artist: 'Artist', genre: 'Pop', plays: 4 },
      { title: 'Track B', artist: 'Artist', genre: 'Rock', plays: 3 },
    ]),
    place('second', 47.66, -122.30, [
      { title: 'track a', artist: 'Artist', genre: 'Pop', plays: 5 },
      { title: 'Track C', artist: 'Artist', genre: 'Jazz', plays: 0 },
    ]),
  ];

  assert.deepEqual(getMapExportSongs(places), [
    { title: 'Track A', artist: 'Artist', genre: 'Pop', plays: 9 },
    { title: 'Track B', artist: 'Artist', genre: 'Rock', plays: 3 },
  ]);
});

test('selected-place export only includes songs from that place', () => {
  const places = [
    place('first', 47.65, -122.31, [
      { title: 'Track A', artist: 'Artist', genre: 'Pop', plays: 2 },
    ]),
    place('second', 47.66, -122.30, [
      { title: 'Track B', artist: 'Artist', genre: 'Jazz', plays: 5 },
    ]),
  ];

  assert.deepEqual(getMapExportSongs(places, 'second'), [
    { title: 'Track B', artist: 'Artist', genre: 'Jazz', plays: 5 },
  ]);
});

test('whole-map region contains every place with padding for a wide image', () => {
  const places = [
    place('first', 47.65, -122.31, []),
    place('second', 47.67, -122.29, []),
  ];

  const region = getMapExportRegion(places);
  assert.ok(Math.abs(region.latitude - 47.66) < 1e-10);
  assert.ok(Math.abs(region.longitude - (-122.3)) < 1e-10);
  assert.ok(region.latitudeDelta > 0.02);
  assert.ok(region.longitudeDelta > 0.02);
  for (const spot of places) {
    const position = getMapExportMarkerPosition(spot, region);
    assert.ok(position.x > 0 && position.x < 1);
    assert.ok(position.y > 0 && position.y < 1);
  }
});

test('single and coincident places receive a usable minimum map span', () => {
  const placeAt = place('same', 47.65, -122.31, []);
  const region = getMapExportRegion([placeAt, { ...placeAt, id: 'same-again' }]);

  assert.ok(Math.abs(region.latitude - 47.65) < 1e-10);
  assert.ok(Math.abs(region.longitude - (-122.31)) < 1e-10);
  assert.ok(Number.isFinite(region.latitudeDelta));
  assert.ok(Number.isFinite(region.longitudeDelta));
  assert.ok(region.latitudeDelta >= 0.012);
  assert.ok(region.longitudeDelta >= 0.012);
});

test('projects spot coordinates to the corresponding static-map positions', () => {
  const region = {
    latitude: 0,
    longitude: 0,
    latitudeDelta: 20,
    longitudeDelta: 40,
  };
  const center = getMapExportMarkerPosition(place('center', 0, 0, []), region);
  const northwest = getMapExportMarkerPosition(place('northwest', 10, -20, []), region);
  const southeast = getMapExportMarkerPosition(place('southeast', -10, 20, []), region);

  assert.ok(Math.abs(center.x - 0.5) < 1e-10);
  assert.ok(Math.abs(center.y - 0.5) < 1e-10);
  assert.ok(Math.abs(northwest.x) < 1e-10);
  assert.ok(Math.abs(northwest.y) < 1e-10);
  assert.ok(Math.abs(southeast.x - 1) < 1e-10);
  assert.ok(Math.abs(southeast.y - 1) < 1e-10);
});

test('share legend only includes marker colors and displayed song genres', () => {
  const places = [
    place('first', 47.65, -122.31, [
      { title: 'Track A', artist: 'Artist', genre: 'indie pop', plays: 4 },
      { title: 'Track B', artist: 'Artist', genre: null, plays: 2 },
    ]),
    place('second', 47.66, -122.30, [
      { title: 'Track C', artist: 'Artist', genre: 'Indie', plays: 5 },
      { title: 'Track D', artist: 'Artist', genre: 'Rock', plays: 3 },
    ]),
  ];

  const displayedSongs = [
    { title: 'Track A', artist: 'Artist', genre: 'indie pop', plays: 4 },
    { title: 'Track E', artist: 'Artist', genre: 'Jazz', plays: 8 },
  ];

  assert.deepEqual(getMapExportGenres(places, displayedSongs), ['Indie', 'Jazz']);
});
