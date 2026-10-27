import { supabase } from '../lib/supabase';

export type AuthResult = {
  ok: boolean;
  user?: unknown | null;
  error?: string;
};

export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();

  if (!trimmedEmail || !trimmedPassword) {
    return { ok: false, error: 'Email and password are required.' };
  }

  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password: trimmedPassword,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, user: data.user };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();

  if (!trimmedEmail || !trimmedPassword) {
    return { ok: false, error: 'Email and password are required.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password: trimmedPassword,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, user: data.user };
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
