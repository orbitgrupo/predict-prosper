-- Keep signup/profile creation resilient and mirror email confirmation into profiles.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bonus_enabled boolean := true;
  v_bonus_amount numeric := 100;
  v_referral_code text;
  v_ref_code_input text;
  v_referrer_id uuid;
  v_referral_enabled boolean := false;
  v_bonus_referrer numeric := 0;
  v_bonus_referred numeric := 0;
  v_phone_required boolean := false;
  v_phone text;
BEGIN
  SELECT
    COALESCE(welcome_bonus_enabled, true),
    COALESCE(welcome_bonus_amount, 100),
    COALESCE(referral_enabled, false),
    COALESCE(referral_bonus_referrer, 0),
    COALESCE(referral_bonus_referred, 0),
    COALESCE(phone_required_on_signup, false)
  INTO
    v_bonus_enabled,
    v_bonus_amount,
    v_referral_enabled,
    v_bonus_referrer,
    v_bonus_referred,
    v_phone_required
  FROM public.app_settings
  WHERE id = 'default';

  v_phone := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), '');
  IF v_phone IS NOT NULL AND v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'El número telefónico debe usar formato internacional, por ejemplo +18095551234.';
  END IF;
  IF COALESCE(v_phone_required, false) AND v_phone IS NULL THEN
    RAISE EXCEPTION 'El número telefónico es obligatorio para crear una cuenta.';
  END IF;

  v_referral_code := UPPER(SUBSTRING(NEW.id::text FROM 1 FOR 8));

  INSERT INTO public.profiles (
    id,
    email,
    username,
    phone,
    balance,
    referral_code,
    verified_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'username', '')), ''),
    v_phone,
    CASE WHEN COALESCE(v_bonus_enabled, true) THEN COALESCE(v_bonus_amount, 100) ELSE 0 END,
    v_referral_code,
    NEW.email_confirmed_at
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    verified_at = COALESCE(public.profiles.verified_at, EXCLUDED.verified_at),
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF COALESCE(v_bonus_enabled, true) AND COALESCE(v_bonus_amount, 100) > 0 THEN
    INSERT INTO public.transactions (user_id, type, amount, description)
    SELECT NEW.id, 'bonus', COALESCE(v_bonus_amount, 100), 'Bono de bienvenida'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.transactions
      WHERE user_id = NEW.id
        AND type = 'bonus'
        AND description = 'Bono de bienvenida'
    );
  END IF;

  v_ref_code_input := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'referral_code', '')));
  IF COALESCE(v_referral_enabled, false) AND v_ref_code_input <> '' THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = v_ref_code_input AND id <> NEW.id;

    IF v_referrer_id IS NOT NULL THEN
      UPDATE public.profiles SET referred_by = v_referrer_id WHERE id = NEW.id;

      INSERT INTO public.referrals (referrer_id, referred_id, referrer_bonus, referred_bonus)
      VALUES (
        v_referrer_id,
        NEW.id,
        COALESCE(v_bonus_referrer, 0),
        COALESCE(v_bonus_referred, 0)
      )
      ON CONFLICT (referred_id) DO NOTHING;

      IF COALESCE(v_bonus_referrer, 0) > 0 THEN
        UPDATE public.profiles SET balance = balance + v_bonus_referrer WHERE id = v_referrer_id;
        INSERT INTO public.transactions (user_id, type, amount, description)
        VALUES (v_referrer_id, 'referral_bonus', v_bonus_referrer, 'Bono por referir usuario');
      END IF;

      IF COALESCE(v_bonus_referred, 0) > 0 THEN
        UPDATE public.profiles SET balance = balance + v_bonus_referred WHERE id = NEW.id;
        INSERT INTO public.transactions (user_id, type, amount, description)
        VALUES (NEW.id, 'referral_bonus', v_bonus_referred, 'Bono por ser referido');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_email_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at THEN
    UPDATE public.profiles
    SET verified_at = COALESCE(verified_at, NEW.email_confirmed_at),
        updated_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email_confirmation();

UPDATE public.profiles p
SET verified_at = u.email_confirmed_at,
    updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND p.verified_at IS NULL
  AND u.email_confirmed_at IS NOT NULL;
