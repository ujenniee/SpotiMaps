CREATE OR REPLACE FUNCTION public.search_users(p_username TEXT)
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
        AND pg_catalog.strpos(pg_catalog.lower(pg_catalog.btrim(p.username)), v_username) > 0
    ORDER BY p.username, p.id
    LIMIT 20;
END;
$$;
