
-- Add allow_cashout column to markets (default true for backward compat)
ALTER TABLE public.markets ADD COLUMN allow_cashout boolean NOT NULL DEFAULT true;

-- Update cashout_bet function to check allow_cashout
CREATE OR REPLACE FUNCTION public.cashout_bet(p_bet_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet RECORD;
  v_market RECORD;
  v_option_total numeric;
  v_market_total numeric;
  v_current_probability numeric;
  v_cashout_value numeric;
BEGIN
  SELECT * INTO v_bet FROM bets WHERE id = p_bet_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Apuesta no encontrada');
  END IF;

  IF v_bet.is_winner IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Esta apuesta ya fue resuelta');
  END IF;

  SELECT * INTO v_market FROM markets WHERE id = v_bet.market_id;
  IF v_market.status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'El mercado no está activo');
  END IF;

  IF v_market.closes_at <= now() THEN
    RETURN json_build_object('success', false, 'error', 'El mercado ha expirado');
  END IF;

  -- Check if cashout is allowed for this market
  IF NOT v_market.allow_cashout THEN
    RETURN json_build_object('success', false, 'error', 'El retiro de apuestas no está habilitado para este mercado');
  END IF;

  SELECT total_amount INTO v_option_total
  FROM market_options WHERE market_id = v_bet.market_id AND option_name = v_bet.option;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_market_total
  FROM market_options WHERE market_id = v_bet.market_id;

  v_current_probability := CASE WHEN v_market_total > 0 THEN v_option_total / v_market_total ELSE 0 END;
  v_cashout_value := ROUND(v_bet.amount * (1 + (1 - v_current_probability)), 2);

  IF v_bet.potential_payout IS NOT NULL AND v_cashout_value > v_bet.potential_payout THEN
    v_cashout_value := v_bet.potential_payout;
  END IF;

  IF v_cashout_value < v_bet.amount * 0.01 THEN
    v_cashout_value := ROUND(v_bet.amount * 0.01, 2);
  END IF;

  UPDATE profiles SET balance = balance + v_cashout_value WHERE id = p_user_id;

  UPDATE market_options 
  SET total_amount = GREATEST(total_amount - v_bet.amount, 0)
  WHERE market_id = v_bet.market_id AND option_name = v_bet.option;

  UPDATE bets SET is_winner = false, payout_amount = v_cashout_value WHERE id = p_bet_id;

  INSERT INTO transactions (user_id, amount, type, description, market_id)
  VALUES (p_user_id, v_cashout_value, 'payout', 'Retiro de apuesta (cashout)', v_bet.market_id);

  RETURN json_build_object(
    'success', true, 
    'cashout_value', v_cashout_value,
    'original_amount', v_bet.amount
  );
END;
$$;
