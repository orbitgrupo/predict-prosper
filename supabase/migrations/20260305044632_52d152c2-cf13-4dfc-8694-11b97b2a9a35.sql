
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
  v_ref_code_input text;
  v_referrer_id uuid;
  v_referral_enabled boolean;
  v_bonus_referrer numeric;
  v_bonus_referred numeric;
BEGIN
  SELECT welcome_bonus_enabled, welcome_bonus_amount, referral_enabled, referral_bonus_referrer, referral_bonus_referred
  INTO v_bonus_enabled, v_bonus_amount, v_referral_enabled, v_bonus_referrer, v_bonus_referred
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

  -- Process referral if provided
  v_ref_code_input := UPPER(COALESCE(NEW.raw_user_meta_data ->> 'referral_code', ''));
  IF v_referral_enabled AND v_ref_code_input != '' THEN
    SELECT id INTO v_referrer_id FROM profiles WHERE referral_code = v_ref_code_input AND id != NEW.id;
    IF v_referrer_id IS NOT NULL THEN
      UPDATE profiles SET referred_by = v_referrer_id WHERE id = NEW.id;
      
      INSERT INTO referrals (referrer_id, referred_id, referrer_bonus, referred_bonus)
      VALUES (v_referrer_id, NEW.id, v_bonus_referrer, v_bonus_referred);

      IF v_bonus_referrer > 0 THEN
        UPDATE profiles SET balance = balance + v_bonus_referrer WHERE id = v_referrer_id;
        INSERT INTO transactions (user_id, type, amount, description)
        VALUES (v_referrer_id, 'referral_bonus', v_bonus_referrer, 'Bono por referir usuario');
      END IF;

      IF v_bonus_referred > 0 THEN
        UPDATE profiles SET balance = balance + v_bonus_referred WHERE id = NEW.id;
        INSERT INTO transactions (user_id, type, amount, description)
        VALUES (NEW.id, 'referral_bonus', v_bonus_referred, 'Bono por ser referido');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
