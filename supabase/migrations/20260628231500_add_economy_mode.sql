-- Introduce a safe points-only mode before enabling real-money operations.
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS economy_mode text NOT NULL DEFAULT 'points';

ALTER TABLE public.app_settings
DROP CONSTRAINT IF EXISTS app_settings_economy_mode_check;

ALTER TABLE public.app_settings
ADD CONSTRAINT app_settings_economy_mode_check
CHECK (economy_mode IN ('points', 'real_money'));


ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS points_balance numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_balance numeric NOT NULL DEFAULT 0;

-- Existing balances belong to the initial points mode.
UPDATE public.profiles
SET points_balance = balance
WHERE points_balance = 0 AND balance <> 0;

CREATE OR REPLACE FUNCTION public.switch_active_economy_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.economy_mode = NEW.economy_mode THEN
    RETURN NEW;
  END IF;

  IF NEW.economy_mode = 'real_money' THEN
    UPDATE public.profiles
    SET points_balance = balance,
        balance = cash_balance;
  ELSE
    UPDATE public.profiles
    SET cash_balance = balance,
        balance = points_balance;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS switch_active_economy_balance ON public.app_settings;
CREATE TRIGGER switch_active_economy_balance
AFTER UPDATE OF economy_mode ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.switch_active_economy_balance();

CREATE OR REPLACE FUNCTION public.enforce_withdrawal_economy_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text;
BEGIN
  SELECT economy_mode INTO v_mode FROM public.app_settings WHERE id = 'default';
  IF COALESCE(v_mode, 'points') <> 'real_money' THEN
    RAISE EXCEPTION 'Los retiros no están disponibles mientras la plataforma usa puntos.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_withdrawal_economy_mode ON public.withdrawal_requests;
CREATE TRIGGER enforce_withdrawal_economy_mode
BEFORE INSERT ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_withdrawal_economy_mode();
