CREATE TABLE public.location_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT location_samples_unique_reading UNIQUE (user_id, recorded_at)
);

COMMENT ON COLUMN public.location_samples.recorded_at IS
    'GPS capture time, not the time the reading was uploaded.';

ALTER TABLE public.location_samples ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.location_samples FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.location_samples TO authenticated;
GRANT ALL ON TABLE public.location_samples TO service_role;

CREATE POLICY location_samples_select_own
    ON public.location_samples FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY location_samples_insert_own
    ON public.location_samples FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY location_samples_delete_own
    ON public.location_samples FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);
