-- Store the chosen GPS sample instead of calculating a match on every map read.
ALTER TABLE public.listening_history ADD COLUMN location_id UUID;

-- Including user_id in the reference prevents cross-user associations, even for
-- privileged writes. Deleting GPS data unplaces the play without deleting it.
ALTER TABLE public.location_samples
    ADD CONSTRAINT location_samples_user_id_id_key UNIQUE (user_id, id);

ALTER TABLE public.listening_history
    ADD CONSTRAINT listening_history_location_sample_fkey
    FOREIGN KEY (user_id, location_id)
    REFERENCES public.location_samples (user_id, id)
    ON DELETE SET NULL (location_id);

CREATE INDEX listening_history_location_id_idx
    ON public.listening_history (location_id) WHERE location_id IS NOT NULL;

COMMENT ON COLUMN public.listening_history.location_id IS
    'Saved nearest GPS sample for this user; NULL means unplaced. Later samples may improve the match.';

-- Preserve the existing insert permissions, but let only the matching function
-- assign location_id. Table-level INSERT would include every future column.
REVOKE INSERT ON public.listening_history FROM authenticated;
GRANT INSERT (
    id, user_id, track_id, title, artist, duration_ms, spotify_url,
    listened_at, created_at, genre, latitude, longitude
) ON public.listening_history TO authenticated;

CREATE FUNCTION public.match_listening_locations(
    p_from TIMESTAMPTZ,
    p_to TIMESTAMPTZ,
    p_max_gap_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (
    examined_count INTEGER,
    matched_count INTEGER,
    unmatched_count INTEGER,
    changed_count INTEGER
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_window INTERVAL;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Sign in to SpotiMaps before matching listening history.'
            USING ERRCODE = '28000';
    END IF;

    IF p_from IS NULL OR p_to IS NULL
        OR NOT pg_catalog.isfinite(p_from) OR NOT pg_catalog.isfinite(p_to)
        OR p_to <= p_from OR p_to - p_from > INTERVAL '7 days' THEN
        RAISE EXCEPTION 'Provide a finite time range greater than zero and no longer than 7 days.'
            USING ERRCODE = '22023';
    END IF;

    IF p_max_gap_seconds IS NULL OR p_max_gap_seconds < 1 OR p_max_gap_seconds > 300 THEN
        RAISE EXCEPTION 'The matching window must be between 1 and 300 seconds.'
            USING ERRCODE = '22023';
    END IF;

    -- Uploads can request matching concurrently. Serialize matching for each user
    -- so a call using older inputs cannot overwrite a more recent calculation.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::TEXT, 0));
    v_window := pg_catalog.make_interval(secs => p_max_gap_seconds);

    RETURN QUERY
    WITH candidates AS MATERIALIZED (
        SELECT h.id, nearest.id AS sample_id
        FROM public.listening_history AS h
        LEFT JOIN LATERAL (
            SELECT s.id
            FROM public.location_samples AS s
            WHERE s.user_id = v_user_id
                AND s.recorded_at >= h.listened_at - v_window
                AND s.recorded_at <= h.listened_at + v_window
            ORDER BY
                pg_catalog.abs(EXTRACT(EPOCH FROM s.recorded_at - h.listened_at)),
                s.recorded_at,
                s.id
            LIMIT 1
        ) AS nearest ON TRUE
        WHERE h.user_id = v_user_id
            AND h.listened_at >= p_from AND h.listened_at < p_to
    ), changed AS (
        UPDATE public.listening_history AS h
        SET location_id = c.sample_id
        FROM candidates AS c
        WHERE h.id = c.id AND h.user_id = v_user_id
            AND h.location_id IS DISTINCT FROM c.sample_id
        RETURNING h.id
    )
    SELECT
        COUNT(*)::INTEGER,
        COUNT(c.sample_id)::INTEGER,
        COUNT(*) FILTER (WHERE c.sample_id IS NULL)::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM changed)
    FROM candidates AS c;
END;
$$;

COMMENT ON FUNCTION public.match_listening_locations IS
    'Matches the signed-in user''s plays in [p_from, p_to). Uses the preserved listened_at timestamp, nearest sample within the window, and earlier sample on ties. Repeated calls refresh affected matches safely.';

REVOKE ALL ON FUNCTION public.match_listening_locations FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_listening_locations TO authenticated;

CREATE FUNCTION public.get_matched_listening_history(
    p_from TIMESTAMPTZ,
    p_to TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    track_id TEXT,
    title TEXT,
    artist TEXT,
    duration_ms INTEGER,
    spotify_url TEXT,
    genre TEXT,
    listened_at TIMESTAMPTZ,
    location_id UUID,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_recorded_at TIMESTAMPTZ,
    time_gap_seconds DOUBLE PRECISION,
    match_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Sign in to SpotiMaps before reading listening history.'
            USING ERRCODE = '28000';
    END IF;

    IF p_from IS NULL OR p_to IS NULL
        OR NOT pg_catalog.isfinite(p_from) OR NOT pg_catalog.isfinite(p_to)
        OR p_to <= p_from OR p_to - p_from > INTERVAL '7 days' THEN
        RAISE EXCEPTION 'Provide a finite time range greater than zero and no longer than 7 days.'
            USING ERRCODE = '22023';
    END IF;

    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 500
        OR p_offset IS NULL OR p_offset < 0 THEN
        RAISE EXCEPTION 'Provide a limit between 1 and 500 and a nonnegative offset.'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    SELECT
        h.id, h.track_id, h.title, h.artist, h.duration_ms,
        h.spotify_url, h.genre, h.listened_at,
        s.id, s.latitude, s.longitude, s.recorded_at,
        pg_catalog.abs(EXTRACT(EPOCH FROM s.recorded_at - h.listened_at))::DOUBLE PRECISION,
        CASE WHEN s.id IS NULL THEN 'unmatched' ELSE 'matched' END
    FROM public.listening_history AS h
    LEFT JOIN public.location_samples AS s
        ON s.id = h.location_id AND s.user_id = h.user_id
    WHERE h.user_id = v_user_id
        AND h.listened_at >= p_from AND h.listened_at < p_to
    ORDER BY h.listened_at DESC, h.id DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION public.get_matched_listening_history IS
    'Reads saved associations without recalculating matches. Includes unplaced plays with NULL coordinates. Uses the signed-in user, RLS, [p_from, p_to), and stable pagination.';

REVOKE ALL ON FUNCTION public.get_matched_listening_history FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_matched_listening_history TO authenticated;
