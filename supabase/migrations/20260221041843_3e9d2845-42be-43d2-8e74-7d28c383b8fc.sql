
-- Fix 1: Add auth.uid() validation to place_bet
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
  v_bet_id uuid;
  v_current_yes_amount numeric;
  v_current_no_amount numeric;
  v_option_exists boolean;
BEGIN
  -- CRITICAL: Validate caller identity
  IF p_user_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'El monto debe ser mayor a cero');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM market_options 
    WHERE market_id = p_market_id AND option_name = p_option
  ) INTO v_option_exists;

  IF NOT v_option_exists THEN
    RETURN json_build_object('success', false, 'error', 'Opción de apuesta no válida para este mercado');
  END IF;

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

  INSERT INTO bets (user_id, market_id, option, amount)
  VALUES (p_user_id, p_market_id, p_option, p_amount)
  RETURNING id INTO v_bet_id;

  UPDATE profiles
  SET balance = balance - p_amount
  WHERE id = p_user_id;

  IF p_option = 'yes' THEN
    UPDATE markets SET total_yes_amount = total_yes_amount + p_amount WHERE id = p_market_id;
  ELSE
    UPDATE markets SET total_no_amount = total_no_amount + p_amount WHERE id = p_market_id;
  END IF;

  UPDATE market_options 
  SET total_amount = total_amount + p_amount 
  WHERE market_id = p_market_id AND option_name = p_option;

  INSERT INTO transactions (user_id, type, amount, description, market_id)
  VALUES (p_user_id, 'bet', -p_amount, 'Apuesta en mercado: ' || UPPER(p_option), p_market_id);

  RETURN json_build_object('success', true, 'bet_id', v_bet_id);
END;
$$;

-- Fix 2: Add auth.uid() validation to submit_market_suggestion
CREATE OR REPLACE FUNCTION public.submit_market_suggestion(p_user_id uuid, p_title text, p_description text, p_category text, p_closes_at timestamp with time zone, p_options jsonb, p_selected_option text, p_fee_amount numeric DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_is_blocked BOOLEAN;
  v_suggestion_id UUID;
BEGIN
  -- CRITICAL: Validate caller identity
  IF p_user_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF p_fee_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'El monto de la tarifa debe ser mayor a cero');
  END IF;

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

  IF v_current_balance < p_fee_amount THEN
    RETURN json_build_object('success', false, 'error', 'Saldo insuficiente para pagar la tarifa de sugerencia');
  END IF;

  INSERT INTO market_suggestions (user_id, title, description, category, closes_at, options, selected_option, fee_amount)
  VALUES (p_user_id, p_title, p_description, p_category, p_closes_at, p_options, p_selected_option, p_fee_amount)
  RETURNING id INTO v_suggestion_id;

  UPDATE profiles
  SET balance = balance - p_fee_amount
  WHERE id = p_user_id;

  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'fee', -p_fee_amount, 'Tarifa por sugerencia de predicción: ' || p_title);

  RETURN json_build_object('success', true, 'suggestion_id', v_suggestion_id);
END;
$$;

-- Fix 3: Add admin INSERT policy on transactions
CREATE POLICY "Admins can create transactions for any user"
ON public.transactions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix 4: Create atomic admin_add_funds function to prevent race conditions
CREATE OR REPLACE FUNCTION public.admin_add_funds(p_user_id uuid, p_amount numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_new_balance numeric;
BEGIN
  -- Validate admin role
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'El monto debe ser mayor a cero');
  END IF;

  -- Atomic balance update with row locking
  UPDATE profiles 
  SET balance = balance + p_amount 
  WHERE id = p_user_id 
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  -- Record transaction
  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'admin_credit', p_amount, 'Créditos agregados por administrador');

  RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- Fix 5: Create atomic resolve_market function to prevent race conditions
CREATE OR REPLACE FUNCTION public.resolve_market(p_market_id uuid, p_winning_option text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_market_status market_status;
  v_total_winning numeric := 0;
  v_total_losing numeric := 0;
  v_bet RECORD;
  v_payout numeric;
  v_market_title text;
BEGIN
  -- Validate admin role
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  -- Lock market
  SELECT status, title INTO v_market_status, v_market_title
  FROM markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Mercado no encontrado');
  END IF;

  IF v_market_status = 'resolved' THEN
    RETURN json_build_object('success', false, 'error', 'Este mercado ya fue resuelto');
  END IF;

  -- Update market status
  UPDATE markets
  SET status = 'resolved', resolved_option = p_winning_option
  WHERE id = p_market_id;

  -- Calculate totals
  SELECT COALESCE(SUM(amount), 0) INTO v_total_winning
  FROM bets
  WHERE market_id = p_market_id AND LOWER(option) = LOWER(p_winning_option);

  SELECT COALESCE(SUM(amount), 0) INTO v_total_losing
  FROM bets
  WHERE market_id = p_market_id AND LOWER(option) != LOWER(p_winning_option);

  -- Process winning bets
  FOR v_bet IN
    SELECT id, user_id, amount
    FROM bets
    WHERE market_id = p_market_id AND LOWER(option) = LOWER(p_winning_option)
  LOOP
    v_payout := v_bet.amount + (CASE WHEN v_total_winning > 0 THEN (v_total_losing * v_bet.amount / v_total_winning) ELSE 0 END);

    UPDATE bets SET is_winner = true, payout_amount = v_payout WHERE id = v_bet.id;

    -- Atomic balance update
    UPDATE profiles SET balance = balance + v_payout WHERE id = v_bet.user_id;

    INSERT INTO transactions (user_id, type, amount, description, market_id)
    VALUES (v_bet.user_id, 'payout', v_payout, 'Ganancia: ' || v_market_title, p_market_id);
  END LOOP;

  -- Mark losing bets
  UPDATE bets SET is_winner = false, payout_amount = 0
  WHERE market_id = p_market_id AND LOWER(option) != LOWER(p_winning_option);

  RETURN json_build_object('success', true);
END;
$$;
