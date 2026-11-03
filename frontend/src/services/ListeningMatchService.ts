import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ListeningMatchResult } from '../types/database';

export type ListeningMatchOptions = {
  /** Inclusive ISO timestamp. The database limits each call to at most 7 days. */
  from: string;
  /** Exclusive ISO timestamp. */
  to: string;
  /** Maximum timestamp gap, 1-300 seconds. Omit for the database default of 60. */
  maxGapSeconds?: number;
};

/** Call after a successful upload; the matching calculation runs in Supabase. */
export async function matchListeningLocations(
  client: SupabaseClient<Database>,
  options: ListeningMatchOptions,
): Promise<ListeningMatchResult> {
  const args: Database['public']['Functions']['match_listening_locations']['Args'] = {
    p_from: options.from,
    p_to: options.to,
  };
  if (options.maxGapSeconds !== undefined) {
    args.p_max_gap_seconds = options.maxGapSeconds;
  }

  const { data, error } = await client.rpc('match_listening_locations', args);
  if (error) {
    throw new Error(`Could not match listening history: ${error.message}`);
  }
  if (!data || data.length !== 1) {
    throw new Error('Matching did not return a result.');
  }
  return data[0];
}
