import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export type MapVisibility = 'private' | 'friends';

export type PrivacySettings = {
  location_tracking_enabled: boolean;
  map_visibility: MapVisibility;
};

export type PrivacySettingsUpdate = Partial<PrivacySettings>;

const PRIVACY_COLUMNS = 'location_tracking_enabled, map_visibility';

function isPrivacySettings(value: unknown): value is PrivacySettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const settings = value as Record<string, unknown>;
  return typeof settings.location_tracking_enabled === 'boolean'
    && (settings.map_visibility === 'private' || settings.map_visibility === 'friends');
}

function parsePrivacySettings(value: unknown): PrivacySettings {
  if (!isPrivacySettings(value)) {
    throw new Error('Supabase returned invalid privacy settings.');
  }
  return value;
}

/** Read the signed-in user's privacy settings, enforced by profile RLS. */
export async function getPrivacySettings(
  client: SupabaseClient<Database>,
): Promise<PrivacySettings> {
  const { data, error } = await client
    .from('profiles')
    .select(PRIVACY_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Could not load privacy settings: ${error.message}`);
  }
  return parsePrivacySettings(data);
}

/** Save settings on the signed-in user's profile, enforced by profile RLS. */
export async function updatePrivacySettings(
  client: SupabaseClient<Database>,
  updates: PrivacySettingsUpdate,
): Promise<PrivacySettings> {
  if (Object.keys(updates).length === 0) {
    return getPrivacySettings(client);
  }

  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) {
    throw new Error(`Could not identify signed-in user: ${authError.message}`);
  }
  if (!auth.user) {
    throw new Error('Sign in before updating privacy settings.');
  }

  const { data, error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', auth.user.id)
    .select(PRIVACY_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Could not save privacy settings: ${error.message}`);
  }
  return parsePrivacySettings(data);
}
