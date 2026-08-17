-- Add general platform settings. US betting stays disabled by default.
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS us_betting_enabled boolean NOT NULL DEFAULT false;
