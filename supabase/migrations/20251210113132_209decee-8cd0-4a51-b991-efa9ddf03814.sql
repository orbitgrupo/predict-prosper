-- Add is_blocked column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.profiles.is_blocked IS 'Whether the user is blocked from using the platform';