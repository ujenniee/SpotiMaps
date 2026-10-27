-- Listening events belong to Supabase Auth users, independently of profile tables.
CREATE TABLE public.listening_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    track_id TEXT NOT NULL CHECK (length(btrim(track_id)) > 0),
    title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
    artist TEXT NOT NULL CHECK (length(btrim(artist)) > 0),
    duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
    spotify_url TEXT,
    listened_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Reserved for later genre lookup and song-to-location matching.
    genre TEXT,
    latitude DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT listening_history_coordinates_pair
        CHECK ((latitude IS NULL) = (longitude IS NULL)),
    CONSTRAINT listening_history_unique_play
        UNIQUE (user_id, track_id, listened_at)
);

CREATE INDEX listening_history_user_time_idx
    ON public.listening_history (user_id, listened_at DESC);

COMMENT ON TABLE public.listening_history IS
    'One row per Spotify play; repeated syncs must not duplicate the same play.';
COMMENT ON COLUMN public.listening_history.listened_at IS
    'Spotify played_at timestamp, preserved without inferring a start or end time.';

ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;

-- Clients may append, read, or delete their own history. Enrichment can be added
-- by a trusted backend later; syncing never overwrites existing locations/genres.
REVOKE ALL ON TABLE public.listening_history FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.listening_history TO authenticated;
GRANT ALL ON TABLE public.listening_history TO service_role;

CREATE POLICY listening_history_select_own
    ON public.listening_history FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY listening_history_insert_own
    ON public.listening_history FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY listening_history_delete_own
    ON public.listening_history FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);
