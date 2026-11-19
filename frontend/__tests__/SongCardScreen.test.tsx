import { render } from '@testing-library/react-native';
import SongCardScreen from '../src/screens/SongCardScreen';
import type { MapPlace } from '../src/data/mockData';

const place: MapPlace = {
  id: 'place-1',
  name: 'Test Place',
  area: 'Test Area',
  latitude: 0,
  longitude: 0,
  songs: [
    { title: 'Known Genre', artist: 'Artist A', genre: 'R&B', plays: 2 },
    { title: 'Missing Genre', artist: 'Artist B', genre: null, plays: 1 },
  ],
};

test('shows each song genre and labels missing genres as Other', async () => {
  const screen = await render(
    <SongCardScreen place={place} isExpanded onToggle={jest.fn()} onClose={jest.fn()} />,
  );

  expect(screen.getByText('R&B')).toBeTruthy();
  expect(screen.getByText('Other')).toBeTruthy();
});
