CREATE TABLE public.friendships (
    user_low UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    user_high UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_low, user_high),
    CONSTRAINT friendships_distinct_users CHECK (user_low < user_high)
);

CREATE INDEX friendships_user_high_idx
    ON public.friendships (user_high, user_low);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.friendships FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.friendships TO authenticated;
GRANT ALL ON TABLE public.friendships TO service_role;

CREATE POLICY friendships_select_participant
    ON public.friendships FOR SELECT TO authenticated
    USING (
        (SELECT auth.uid()) = user_low
        OR (SELECT auth.uid()) = user_high
    );

CREATE TABLE public.friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT friend_requests_distinct_users CHECK (requester_id <> recipient_id)
);

CREATE UNIQUE INDEX friend_requests_pair_unique
    ON public.friend_requests (
        LEAST(requester_id, recipient_id),
        GREATEST(requester_id, recipient_id)
    );

CREATE INDEX friend_requests_recipient_created_idx
    ON public.friend_requests (recipient_id, created_at DESC);
CREATE INDEX friend_requests_requester_created_idx
    ON public.friend_requests (requester_id, created_at DESC);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.friend_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.friend_requests TO authenticated;
GRANT ALL ON TABLE public.friend_requests TO service_role;

CREATE POLICY friend_requests_select_participant
    ON public.friend_requests FOR SELECT TO authenticated
    USING (
        (SELECT auth.uid()) = requester_id
        OR (SELECT auth.uid()) = recipient_id
    );

CREATE INDEX profiles_username_lookup_idx
    ON public.profiles (pg_catalog.lower(pg_catalog.btrim(username)))
    WHERE username IS NOT NULL;

CREATE FUNCTION public.search_users(p_username TEXT)
RETURNS TABLE (
    id UUID,
    username TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_username TEXT := pg_catalog.lower(pg_catalog.btrim(p_username));
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Sign in before searching for users.'
            USING ERRCODE = '28000';
    END IF;

    IF v_username IS NULL OR v_username = '' THEN
        RAISE EXCEPTION 'Provide a username to search for.'
            USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    SELECT p.id, p.username
    FROM public.profiles AS p
    WHERE p.id <> v_user_id
        AND p.username IS NOT NULL
        AND pg_catalog.lower(pg_catalog.btrim(p.username)) = v_username
    ORDER BY p.username, p.id
    LIMIT 20;
END;
$$;

CREATE FUNCTION public.list_friends()
RETURNS TABLE (
    friend_id UUID,
    username TEXT,
    map_visible BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        CASE WHEN f.user_low = (SELECT auth.uid()) THEN f.user_high ELSE f.user_low END,
        p.username,
        p.map_visibility = 'friends'
    FROM public.friendships AS f
    JOIN public.profiles AS p
        ON p.id = CASE WHEN f.user_low = (SELECT auth.uid()) THEN f.user_high ELSE f.user_low END
    WHERE f.user_low = (SELECT auth.uid()) OR f.user_high = (SELECT auth.uid())
    ORDER BY p.username NULLS LAST, p.id;
$$;

CREATE FUNCTION public.list_friend_requests()
RETURNS TABLE (
    id UUID,
    other_user_id UUID,
    username TEXT,
    direction TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        r.id,
        CASE WHEN r.requester_id = (SELECT auth.uid()) THEN r.recipient_id ELSE r.requester_id END,
        p.username,
        CASE WHEN r.recipient_id = (SELECT auth.uid()) THEN 'incoming' ELSE 'outgoing' END,
        r.created_at
    FROM public.friend_requests AS r
    JOIN public.profiles AS p
        ON p.id = CASE WHEN r.requester_id = (SELECT auth.uid()) THEN r.recipient_id ELSE r.requester_id END
    WHERE r.requester_id = (SELECT auth.uid()) OR r.recipient_id = (SELECT auth.uid())
    ORDER BY r.created_at DESC, r.id;
$$;

CREATE FUNCTION public.send_friend_request(p_recipient_id UUID)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_request_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Sign in before sending friend requests.'
            USING ERRCODE = '28000';
    END IF;

    IF p_recipient_id IS NULL OR p_recipient_id = v_user_id
        OR NOT EXISTS (
            SELECT 1 FROM public.profiles AS p WHERE p.id = p_recipient_id
        ) THEN
        RAISE EXCEPTION 'The requested user is unavailable.'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.friendships AS f
        WHERE f.user_low = LEAST(v_user_id, p_recipient_id)
            AND f.user_high = GREATEST(v_user_id, p_recipient_id)
    ) THEN
        RAISE EXCEPTION 'You are already friends with this user.'
            USING ERRCODE = '23505';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.friend_requests AS r
        WHERE (r.requester_id = v_user_id AND r.recipient_id = p_recipient_id)
            OR (r.requester_id = p_recipient_id AND r.recipient_id = v_user_id)
    ) THEN
        RAISE EXCEPTION 'A pending friend request already exists for this user.'
            USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.friend_requests (requester_id, recipient_id)
    VALUES (v_user_id, p_recipient_id)
    RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$;

CREATE FUNCTION public.accept_friend_request(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_requester_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Sign in before accepting friend requests.'
            USING ERRCODE = '28000';
    END IF;

    SELECT r.requester_id INTO v_requester_id
    FROM public.friend_requests AS r
    WHERE r.id = p_request_id AND r.recipient_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Friend request unavailable.'
            USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.friendships (user_low, user_high)
    VALUES (LEAST(v_user_id, v_requester_id), GREATEST(v_user_id, v_requester_id))
    ON CONFLICT (user_low, user_high) DO NOTHING;

    DELETE FROM public.friend_requests AS r
    WHERE r.id = p_request_id AND r.recipient_id = v_user_id;

    RETURN TRUE;
END;
$$;

CREATE FUNCTION public.decline_friend_request(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Sign in before declining friend requests.'
            USING ERRCODE = '28000';
    END IF;

    DELETE FROM public.friend_requests AS r
    WHERE r.id = p_request_id AND r.recipient_id = v_user_id;

    RETURN FOUND;
END;
$$;

CREATE FUNCTION public.cancel_friend_request(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Sign in before cancelling friend requests.'
            USING ERRCODE = '28000';
    END IF;

    DELETE FROM public.friend_requests AS r
    WHERE r.id = p_request_id AND r.requester_id = v_user_id;

    RETURN FOUND;
END;
$$;

CREATE FUNCTION public.remove_friend(p_friend_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Sign in before removing friends.'
            USING ERRCODE = '28000';
    END IF;

    IF p_friend_id IS NULL OR p_friend_id = v_user_id THEN
        RETURN FALSE;
    END IF;

    DELETE FROM public.friendships AS f
    WHERE f.user_low = LEAST(v_user_id, p_friend_id)
        AND f.user_high = GREATEST(v_user_id, p_friend_id);

    RETURN FOUND;
END;
$$;

CREATE FUNCTION public.get_friend_map(
    p_friend_id UUID,
    p_from TIMESTAMPTZ,
    p_to TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    location_id UUID,
    title TEXT,
    artist TEXT,
    genre TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    listened_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Sign in before viewing friend maps.'
            USING ERRCODE = '28000';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.friendships AS f
        WHERE (f.user_low = v_user_id AND f.user_high = p_friend_id)
            OR (f.user_low = p_friend_id AND f.user_high = v_user_id)
    ) OR NOT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = p_friend_id AND p.map_visibility = 'friends'
    ) THEN
        RAISE EXCEPTION 'Friend map unavailable.'
            USING ERRCODE = '42501';
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
        h.id,
        s.id,
        h.title,
        h.artist,
        h.genre,
        s.latitude,
        s.longitude,
        h.listened_at
    FROM public.listening_history AS h
    JOIN public.location_samples AS s
        ON s.id = h.location_id AND s.user_id = h.user_id
    WHERE h.user_id = p_friend_id
        AND h.listened_at >= p_from AND h.listened_at < p_to
    ORDER BY h.listened_at DESC, h.id DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.search_users(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_friends() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_friend_requests() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.send_friend_request(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.accept_friend_request(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.decline_friend_request(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cancel_friend_request(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.remove_friend(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_friend_map(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.search_users(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friend_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_map(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;
