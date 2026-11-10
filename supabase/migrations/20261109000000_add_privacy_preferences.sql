ALTER TABLE public.profiles
    ADD COLUMN location_tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN map_visibility TEXT NOT NULL DEFAULT 'private'
        CHECK (map_visibility IN ('private', 'friends'));

COMMENT ON COLUMN public.profiles.location_tracking_enabled IS
    'Whether the user has enabled GPS collection for their account.';
COMMENT ON COLUMN public.profiles.map_visibility IS
    'Who may view the user map; friend access requires separate friend-scoped policies.';

-- Existing own-profile RLS policies continue to govern these newly granted
-- columns; this migration does not add cross-user access.
GRANT SELECT (location_tracking_enabled, map_visibility)
    ON TABLE public.profiles TO authenticated;
GRANT UPDATE (location_tracking_enabled, map_visibility)
    ON TABLE public.profiles TO authenticated;
