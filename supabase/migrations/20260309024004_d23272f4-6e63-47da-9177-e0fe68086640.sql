
-- Add referral_clicks column to profiles
ALTER TABLE public.profiles ADD COLUMN referral_clicks integer NOT NULL DEFAULT 0;

-- Create anon-accessible function to track referral link clicks
CREATE OR REPLACE FUNCTION public.track_referral_click(p_referral_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE profiles SET referral_clicks = referral_clicks + 1
  WHERE referral_code = UPPER(p_referral_code);
END;
$$;
