
-- Create app_settings table for configurable promotion
CREATE TABLE public.app_settings (
  id text PRIMARY KEY DEFAULT 'default',
  welcome_bonus_enabled boolean NOT NULL DEFAULT true,
  welcome_bonus_amount numeric NOT NULL DEFAULT 100,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO public.app_settings (id, welcome_bonus_enabled, welcome_bonus_amount)
VALUES ('default', true, 100);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed for landing page)
CREATE POLICY "Anyone can view settings"
ON public.app_settings FOR SELECT
USING (true);

-- Only admins can update
CREATE POLICY "Admins can update settings"
ON public.app_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Replace the handle_new_user function to use dynamic bonus
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bonus_enabled boolean;
  v_bonus_amount numeric;
BEGIN
  -- Get current promotion settings
  SELECT welcome_bonus_enabled, welcome_bonus_amount
  INTO v_bonus_enabled, v_bonus_amount
  FROM app_settings
  WHERE id = 'default';

  INSERT INTO public.profiles (id, email, username, balance)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'username',
    CASE WHEN v_bonus_enabled THEN v_bonus_amount ELSE 0 END);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  IF v_bonus_enabled AND v_bonus_amount > 0 THEN
    INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (NEW.id, 'bonus', v_bonus_amount, 'Bono de bienvenida');
  END IF;

  RETURN NEW;
END;
$function$;
