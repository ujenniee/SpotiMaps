import { supabase } from '../lib/supabase';

export const USERNAME_RULES = '3–20 characters: lowercase letters, numbers, periods, or underscores';
const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) {
    return `Usernames must be ${USERNAME_RULES}.`;
  }
  return null;
}

async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('You need to be logged in.');
  }
  return data.user.id;
}

export async function getMyUsername(): Promise<string | null> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Could not load your username: ${error.message}`);
  }
  return data.username;
}

export type UsernameUpdateResult =
  | { ok: true; username: string }
  | { ok: false; error: string };

export async function updateMyUsername(input: string): Promise<UsernameUpdateResult> {
  const username = normalizeUsername(input);
  const invalid = validateUsername(username);
  if (invalid) {
    return { ok: false, error: invalid };
  }

  try {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('profiles')
      .update({ username })
      .eq('id', userId)
      .select('username')
      .single();

    if (error) {
      // 23505 is the database's "duplicate value" error
      if (error.code === '23505') {
        return { ok: false, error: 'That username is already taken. Try another one.' };
      }
      console.warn('Username update failed:', error.message);
      return { ok: false, error: 'Could not save your username. Please try again.' };
    }

    return { ok: true, username: data.username ?? username };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Something went wrong.' };
  }
}