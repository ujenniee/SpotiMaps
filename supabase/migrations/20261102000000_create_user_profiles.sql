CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email TEXT,
    username TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
    'Application profile linked one-to-one with a Supabase Auth user.';

INSERT INTO public.profiles (id, email, username)
SELECT
    id,
    email,
    NULLIF(BTRIM(raw_user_meta_data ->> 'username'), '')
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, email, username, created_at) ON TABLE public.profiles TO authenticated;
GRANT UPDATE (username) ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

CREATE POLICY profiles_select_own
    ON public.profiles FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = id);

CREATE POLICY profiles_update_own
    ON public.profiles FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, username)
    VALUES (
        NEW.id,
        NEW.email,
        NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'username'), '')
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_or_email_updated
    AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
