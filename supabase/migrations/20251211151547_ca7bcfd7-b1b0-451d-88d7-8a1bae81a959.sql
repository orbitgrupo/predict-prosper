-- Create an atomic function for placing bets with proper validation and locking
CREATE OR REPLACE FUNCTION public.place_bet(
  p_user_id uuid,
  p_market_id uuid,
  p_option text,
  p_amount numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance numeric;
  v_is_blocked boolean;
  v_market_status market_status;
  v_bet_id uuid;
  v_current_yes_amount numeric;
  v_current_no_amount numeric;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'El monto debe ser mayor a cero');
  END IF;

  -- Lock and check user profile
  SELECT balance, is_blocked INTO v_current_balance, v_is_blocked
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  IF v_is_blocked THEN
    RETURN json_build_object('success', false, 'error', 'Tu cuenta está bloqueada');
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Saldo insuficiente');
  END IF;

  -- Lock and check market
  SELECT status, total_yes_amount, total_no_amount 
  INTO v_market_status, v_current_yes_amount, v_current_no_amount
  FROM markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Mercado no encontrado');
  END IF;

  IF v_market_status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Este mercado ya no está activo');
  END IF;

  -- Insert bet
  INSERT INTO bets (user_id, market_id, option, amount)
  VALUES (p_user_id, p_market_id, p_option, p_amount)
  RETURNING id INTO v_bet_id;

  -- Deduct balance
  UPDATE profiles
  SET balance = balance - p_amount
  WHERE id = p_user_id;

  -- Update market totals
  IF p_option = 'yes' THEN
    UPDATE markets SET total_yes_amount = total_yes_amount + p_amount WHERE id = p_market_id;
  ELSE
    UPDATE markets SET total_no_amount = total_no_amount + p_amount WHERE id = p_market_id;
  END IF;

  -- Record transaction
  INSERT INTO transactions (user_id, type, amount, description, market_id)
  VALUES (p_user_id, 'bet', -p_amount, 'Apuesta en mercado: ' || UPPER(p_option), p_market_id);

  RETURN json_build_object('success', true, 'bet_id', v_bet_id);
END;
$$;

-- Add CHECK constraint for positive bet amounts
ALTER TABLE bets ADD CONSTRAINT positive_bet_amount CHECK (amount > 0);