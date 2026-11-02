import { supabase } from '../lib/supabase';

export type AuthResult =
  | { ok: true; authenticated: true }
  | { ok: true; authenticated: false }
  | { ok: false; error: string };

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const trimmedEmail = email.trim();

  if (!trimmedEmail || password.length === 0) {
    return { ok: false, error: 'Email and password are required.' };
  }

  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data.user) {
    return { ok: false, error: 'Sign up did not return a user. Please try again.' };
  }

  return { ok: true, authenticated: data.session !== null };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const trimmedEmail = email.trim();

  if (!trimmedEmail || password.length === 0) {
    return { ok: false, error: 'Email and password are required.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data.user || !data.session) {
    return { ok: false, error: 'Login did not create an active session. Please try again.' };
  }

  return { ok: true, authenticated: true };
}

export async function signOutSupabase(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getSupabaseSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}
