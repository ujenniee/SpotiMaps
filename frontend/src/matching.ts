export type LocationSample = { lat: number; lng: number; t: number };

export function nearestSample(
  playedAt: number,
  samples: LocationSample[],
  windowMs: number,
): LocationSample | null {
  let closest: LocationSample | null = null;
  let closestDistance = Infinity;

  for (const sample of samples) {
    const distance = Math.abs(sample.t - playedAt);
    if (distance <= windowMs && distance < closestDistance) {
      closest = sample;
      closestDistance = distance;
    }
  }

  return closest;
}
