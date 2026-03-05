
-- Add referral settings to app_settings
ALTER TABLE public.app_settings 
  ADD COLUMN referral_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN referral_bonus_referrer numeric NOT NULL DEFAULT 50,
  ADD COLUMN referral_bonus_referred numeric NOT NULL DEFAULT 25;

-- Add referral_code to profiles
ALTER TABLE public.profiles 
  ADD COLUMN referral_code text UNIQUE,
  ADD COLUMN referred_by uuid REFERENCES public.profiles(id);

-- Generate referral codes for existing users
UPDATE public.profiles SET referral_code = UPPER(SUBSTRING(id::text FROM 1 FOR 8));

-- Make referral_code NOT NULL after populating
ALTER TABLE public.profiles ALTER COLUMN referral_code SET NOT NULL;

-- Create referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id),
  referred_id uuid NOT NULL REFERENCES public.profiles(id),
  referrer_bonus numeric NOT NULL DEFAULT 0,
  referred_bonus numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- RLS policies for referrals
CREATE POLICY "Users can view their own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Admins can view all referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to process referral on signup
CREATE OR REPLACE FUNCTION public.process_referral(p_user_id uuid, p_referral_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_referrer_id uuid;
  v_referral_enabled boolean;
  v_bonus_referrer numeric;
  v_bonus_referred numeric;
BEGIN
  IF p_user_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  -- Check if referral system is enabled
  SELECT referral_enabled, referral_bonus_referrer, referral_bonus_referred
  INTO v_referral_enabled, v_bonus_referrer, v_bonus_referred
  FROM app_settings WHERE id = 'default';

  IF NOT v_referral_enabled THEN
    RETURN json_build_object('success', false, 'error', 'El sistema de referidos no está activo');
  END IF;

  -- Find referrer
  SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = UPPER(p_referral_code);
  
  IF v_referrer_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Código de referido no válido');
  END IF;

  IF v_referrer_id = p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'No puedes usar tu propio código');
  END IF;

  -- Check if already referred
  IF EXISTS (SELECT 1 FROM referrals WHERE referred_id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Ya usaste un código de referido');
  END IF;

  -- Update referred_by
  UPDATE profiles SET referred_by = v_referrer_id WHERE id = p_user_id;

  -- Create referral record
  INSERT INTO referrals (referrer_id, referred_id, referrer_bonus, referred_bonus)
  VALUES (v_referrer_id, p_user_id, v_bonus_referrer, v_bonus_referred);

  -- Give bonuses
  IF v_bonus_referrer > 0 THEN
    UPDATE profiles SET balance = balance + v_bonus_referrer WHERE id = v_referrer_id;
    INSERT INTO transactions (user_id, type, amount, description)
    VALUES (v_referrer_id, 'referral_bonus', v_bonus_referrer, 'Bono por referir usuario');
  END IF;

  IF v_bonus_referred > 0 THEN
    UPDATE profiles SET balance = balance + v_bonus_referred WHERE id = p_user_id;
    INSERT INTO transactions (user_id, type, amount, description)
    VALUES (p_user_id, 'referral_bonus', v_bonus_referred, 'Bono por ser referido');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- Update handle_new_user to generate referral code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bonus_enabled boolean;
  v_bonus_amount numeric;
  v_referral_code text;
BEGIN
  SELECT welcome_bonus_enabled, welcome_bonus_amount
  INTO v_bonus_enabled, v_bonus_amount
  FROM app_settings WHERE id = 'default';

  v_referral_code := UPPER(SUBSTRING(NEW.id::text FROM 1 FOR 8));

  INSERT INTO public.profiles (id, email, username, balance, referral_code)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'username',
    CASE WHEN v_bonus_enabled THEN v_bonus_amount ELSE 0 END,
    v_referral_code);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  IF v_bonus_enabled AND v_bonus_amount > 0 THEN
    INSERT INTO public.transactions (user_id, type, amount, description)
    VALUES (NEW.id, 'bonus', v_bonus_amount, 'Bono de bienvenida');
  END IF;

  RETURN NEW;
END;
$$;
