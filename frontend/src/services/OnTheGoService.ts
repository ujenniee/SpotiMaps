import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GPSReading } from './LocationService';

export type OnTheGoSession = {
  id: string;
  userId: string;
  startedAt: number;
  endedAt: number | null;
  readings: GPSReading[];
};

const ACTIVE_SESSION_PREFIX = 'spotimaps-on-the-go-active:';
const COMPLETED_SESSIONS_PREFIX = 'spotimaps-on-the-go-completed:';

let sessionWriteQueue: Promise<void> = Promise.resolve();
export async function startOnTheGoSession(
  userId: string
): Promise<OnTheGoSession> {
  if (!userId) {
    throw new Error('You must be logged in to start a trip.');
  }

  const key = `${ACTIVE_SESSION_PREFIX}${userId}`;
  const existing = await AsyncStorage.getItem(key);

  if (existing) {
    throw new Error('An On-the-Go session is already active.');
  }

  const session: OnTheGoSession = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId,
    startedAt: Date.now(),
    endedAt: null,
    readings: [],
  };

  await AsyncStorage.setItem(key, JSON.stringify(session));

  return session;
}

export async function getActiveOnTheGoSession(
  userId: string
): Promise<OnTheGoSession | null> {
  if (!userId) return null;

  const raw = await AsyncStorage.getItem(
    `${ACTIVE_SESSION_PREFIX}${userId}`
  );

  return raw ? (JSON.parse(raw) as OnTheGoSession) : null;
}
export function appendOnTheGoReadings(
  userId: string,
  newReadings: GPSReading[]
): Promise<void> {
  const operation = sessionWriteQueue.then(async () => {
    if (!userId || newReadings.length === 0) {
      return;
    }

    const key = `${ACTIVE_SESSION_PREFIX}${userId}`;
    const raw = await AsyncStorage.getItem(key);

    if (!raw) {
      return;
    }

    const session = JSON.parse(raw) as OnTheGoSession;

    if (session.userId !== userId || session.endedAt !== null) {
      return;
    }

    const existingTimestamps = new Set(
      session.readings.map((reading) => reading.timestamp)
    );

    const validReadings = newReadings.filter((reading) => {
      if (
        !Number.isFinite(reading.latitude) ||
        !Number.isFinite(reading.longitude) ||
        !Number.isFinite(reading.timestamp) ||
        Math.abs(reading.latitude) > 90 ||
        Math.abs(reading.longitude) > 180 ||
        reading.timestamp < session.startedAt ||
        existingTimestamps.has(reading.timestamp)
      ) {
        return false;
      }

      existingTimestamps.add(reading.timestamp);
      return true;
    });

    if (validReadings.length === 0) {
      return;
    }

    session.readings.push(...validReadings);
    session.readings.sort((a, b) => a.timestamp - b.timestamp);

    await AsyncStorage.setItem(key, JSON.stringify(session));

    console.log(
      `Added ${validReadings.length} GPS readings to On-the-Go session.`
    );
  });

  sessionWriteQueue = operation.catch((error) => {
    console.error('Failed to append On-the-Go readings:', error);
  });

  return operation;
}
export function endOnTheGoSession(
  userId: string
): Promise<OnTheGoSession> {
  const operation = sessionWriteQueue.then(async () => {
    if (!userId) {
      throw new Error('You must be logged in to end a trip.');
    }

    const activeKey = `${ACTIVE_SESSION_PREFIX}${userId}`;
    const completedKey = `${COMPLETED_SESSIONS_PREFIX}${userId}`;

    const raw = await AsyncStorage.getItem(activeKey);

    if (!raw) {
      throw new Error('No active On-the-Go session found.');
    }

    const session = JSON.parse(raw) as OnTheGoSession;

    if (session.userId !== userId) {
      throw new Error('This trip belongs to another user.');
    }

    session.endedAt = Date.now();

    // Retrieve previously completed trips.
    const completedRaw = await AsyncStorage.getItem(completedKey);

    const completedSessions: OnTheGoSession[] = completedRaw
      ? JSON.parse(completedRaw)
      : [];

    // Avoid saving the same trip twice.
    if (!completedSessions.some((trip) => trip.id === session.id)) {
      completedSessions.push(session);
    }

    // Save the completed trip before removing the active session.
    await AsyncStorage.setItem(
      completedKey,
      JSON.stringify(completedSessions)
    );

    // Remove the active session so another trip can begin.
    await AsyncStorage.removeItem(activeKey);

    console.log(
      `On-the-Go trip completed with ${session.readings.length} GPS readings.`
    );

    return session;
  });

  sessionWriteQueue = operation.then(
    () => undefined,
    (error) => {
      console.error('Failed to end On-the-Go session:', error);
    }
  );

  return operation;
}