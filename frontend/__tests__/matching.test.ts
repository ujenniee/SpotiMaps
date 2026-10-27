import { nearestSample, type LocationSample } from '../src/matching';

const playedAt = 1_000;

describe('nearestSample', () => {
  it('chooses the sample closest in time', () => {
    const samples: LocationSample[] = [
      { lat: 1, lng: 1, t: 900 },
      { lat: 2, lng: 2, t: 1_020 },
      { lat: 3, lng: 3, t: 1_100 },
    ];

    expect(nearestSample(playedAt, samples, 100)).toBe(samples[1]);
  });

  it('returns null when no sample is within the window', () => {
    const samples: LocationSample[] = [{ lat: 1, lng: 1, t: 1_101 }];

    expect(nearestSample(playedAt, samples, 100)).toBeNull();
  });

  it('returns null for an empty sample list', () => {
    expect(nearestSample(playedAt, [], 100)).toBeNull();
  });

  it('keeps the first sample when two samples are tied', () => {
    const samples: LocationSample[] = [
      { lat: 1, lng: 1, t: 900 },
      { lat: 2, lng: 2, t: 1_100 },
    ];

    expect(nearestSample(playedAt, samples, 100)).toBe(samples[0]);
  });
});
