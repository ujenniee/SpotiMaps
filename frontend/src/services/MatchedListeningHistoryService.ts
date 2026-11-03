import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, MatchedListeningEvent } from '../types/database';

export type MatchedHistoryOptions = {
  /** Inclusive ISO timestamp. Each request may cover at most 7 days. */
  from: string;
  /** Exclusive ISO timestamp. */
  to: string;
  /** 1-500 rows, default 100. */
  limit?: number;
  /** Default 0. Rows are ordered by listening timestamp and ID, newest first. */
  offset?: number;
};

/** Fetch saved song-location associations, including plays still unplaced. */
export async function getMatchedListeningHistory(
  client: SupabaseClient<Database>,
  options: MatchedHistoryOptions,
): Promise<MatchedListeningEvent[]> {
  const args: Database['public']['Functions']['get_matched_listening_history']['Args'] = {
    p_from: options.from,
    p_to: options.to,
  };
  if (options.limit !== undefined) args.p_limit = options.limit;
  if (options.offset !== undefined) args.p_offset = options.offset;

  const { data, error } = await client.rpc('get_matched_listening_history', args);
  if (error) {
    throw new Error(`Could not retrieve matched listening history: ${error.message}`);
  }
  if (!data) {
    throw new Error('Listening-history retrieval did not return a result.');
  }
  return data;
}
