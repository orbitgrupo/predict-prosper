-- Harden betting RPCs for production safety

CREATE OR REPLACE FUNCTION public.place_bet(p_user_id uuid, p_market_id uuid, p_option text, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance numeric;
  v_is_blocked boolean;
  v_market_status market_status;
  v_market_closes_at timestamptz;
  v_bet_id uuid;
  v_option_exists boolean;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'El monto debe ser mayor a cero');
  END IF;

  SELECT status, closes_at
  INTO v_market_status, v_market_closes_at
  FROM markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Mercado no encontrado');
  END IF;

  IF v_market_status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Este mercado ya no esta activo');
  END IF;

  IF v_market_closes_at <= now() THEN
    RETURN json_build_object('success', false, 'error', 'Este mercado ya cerro');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM market_options
    WHERE market_id = p_market_id AND option_name = p_option
  ) INTO v_option_exists;

  IF NOT v_option_exists THEN
    RETURN json_build_object('success', false, 'error', 'Opcion de apuesta no valida para este mercado');
  END IF;

  SELECT balance, is_blocked
  INTO v_current_balance, v_is_blocked
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  IF v_is_blocked THEN
    RETURN json_build_object('success', false, 'error', 'Tu cuenta esta bloqueada');
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Saldo insuficiente');
  END IF;

  INSERT INTO bets (user_id, market_id, option, amount)
  VALUES (p_user_id, p_market_id, p_option, p_amount)
  RETURNING id INTO v_bet_id;

  UPDATE profiles
  SET balance = balance - p_amount
  WHERE id = p_user_id;

  UPDATE market_options
  SET total_amount = total_amount + p_amount
  WHERE market_id = p_market_id AND option_name = p_option;

  IF lower(p_option) IN ('yes', 'si', 'sí') THEN
    UPDATE markets SET total_yes_amount = total_yes_amount + p_amount WHERE id = p_market_id;
  ELSIF lower(p_option) = 'no' THEN
    UPDATE markets SET total_no_amount = total_no_amount + p_amount WHERE id = p_market_id;
  END IF;

  INSERT INTO transactions (user_id, type, amount, description, market_id)
  VALUES (p_user_id, 'bet', -p_amount, 'Apuesta en mercado: ' || p_option, p_market_id);

  RETURN json_build_object('success', true, 'bet_id', v_bet_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cashout_bet(p_bet_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bet RECORD;
  v_market RECORD;
  v_option_total numeric;
  v_market_total numeric;
  v_current_probability numeric;
  v_cashout_value numeric;
  v_is_blocked boolean;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT is_blocked INTO v_is_blocked
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  IF v_is_blocked THEN
    RETURN json_build_object('success', false, 'error', 'Tu cuenta esta bloqueada');
  END IF;

  SELECT * INTO v_bet
  FROM bets
  WHERE id = p_bet_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Apuesta no encontrada');
  END IF;

  IF v_bet.is_winner IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Esta apuesta ya fue resuelta');
  END IF;

  SELECT * INTO v_market
  FROM markets
  WHERE id = v_bet.market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Mercado no encontrado');
  END IF;

  IF v_market.status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'El mercado no esta activo');
  END IF;

  IF v_market.closes_at <= now() THEN
    RETURN json_build_object('success', false, 'error', 'El mercado ha expirado');
  END IF;

  IF NOT COALESCE(v_market.allow_cashout, true) THEN
    RETURN json_build_object('success', false, 'error', 'El retiro de apuestas no esta habilitado para este mercado');
  END IF;

  SELECT total_amount INTO v_option_total
  FROM market_options
  WHERE market_id = v_bet.market_id AND option_name = v_bet.option
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Opcion no encontrada');
  END IF;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_market_total
  FROM market_options
  WHERE market_id = v_bet.market_id;

  v_current_probability := CASE WHEN v_market_total > 0 THEN v_option_total / v_market_total ELSE 0 END;
  v_cashout_value := ROUND(v_bet.amount * (1 + (1 - v_current_probability)), 2);

  IF v_bet.potential_payout IS NOT NULL AND v_cashout_value > v_bet.potential_payout THEN
    v_cashout_value := v_bet.potential_payout;
  END IF;

  IF v_cashout_value < v_bet.amount * 0.01 THEN
    v_cashout_value := ROUND(v_bet.amount * 0.01, 2);
  END IF;

  UPDATE profiles
  SET balance = balance + v_cashout_value
  WHERE id = p_user_id;

  UPDATE market_options
  SET total_amount = GREATEST(total_amount - v_bet.amount, 0)
  WHERE market_id = v_bet.market_id AND option_name = v_bet.option;

  IF lower(v_bet.option) IN ('yes', 'si', 'sí') THEN
    UPDATE markets SET total_yes_amount = GREATEST(total_yes_amount - v_bet.amount, 0) WHERE id = v_bet.market_id;
  ELSIF lower(v_bet.option) = 'no' THEN
    UPDATE markets SET total_no_amount = GREATEST(total_no_amount - v_bet.amount, 0) WHERE id = v_bet.market_id;
  END IF;

  UPDATE bets
  SET is_winner = false, payout_amount = v_cashout_value
  WHERE id = p_bet_id;

  INSERT INTO transactions (user_id, amount, type, description, market_id)
  VALUES (p_user_id, v_cashout_value, 'payout', 'Retiro de apuesta (cashout)', v_bet.market_id);

  RETURN json_build_object('success', true, 'cashout_value', v_cashout_value, 'original_amount', v_bet.amount);
END;
$$;
