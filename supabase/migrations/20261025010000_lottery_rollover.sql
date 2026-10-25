-- Lotería diaria: pozo acumulativo (rollover) y reparto del acumulado.
--
-- Reglas:
-- - Los mercados de categoría 'Lotería' usan el mismo motor de pozo que el
--   resto: los ganadores se reparten el pozo en proporción a lo jugado.
-- - app_settings.lottery_rollover guarda el pozo acumulado de sorteos sin
--   ganador. Al resolver un mercado de Lotería, el acumulado entra en el
--   reparto (se suma al pozo perdedor que se distribuye entre ganadores).
-- - Si nadie acierta el número ganador, no se paga nada y el pozo completo
--   (apuestas de ese mercado + acumulado previo) queda guardado para el
--   próximo sorteo.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS lottery_rollover numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.resolve_market(p_market_id uuid, p_winning_option text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_market_status market_status;
  v_market_category text;
  v_total_winning numeric := 0;
  v_total_losing numeric := 0;
  v_rollover numeric := 0;
  v_new_rollover numeric := 0;
  v_bet RECORD;
  v_payout numeric;
  v_market_title text;
BEGIN
  -- Validate admin role
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  -- Lock market
  SELECT status, title, category INTO v_market_status, v_market_title, v_market_category
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

  -- Lotería: el pozo acumulado entra en el reparto de los ganadores.
  IF v_market_category = 'Lotería' THEN
    SELECT COALESCE(lottery_rollover, 0) INTO v_rollover FROM app_settings WHERE id = 'default';
    v_total_losing := v_total_losing + v_rollover;
  END IF;

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

  -- Lotería: si hubo ganadores el acumulado se consume; si nadie acertó,
  -- el pozo completo (apuestas + acumulado previo) se acumula.
  IF v_market_category = 'Lotería' THEN
    IF v_total_winning > 0 THEN
      v_new_rollover := 0;
    ELSE
      v_new_rollover := v_total_losing;
    END IF;
    UPDATE app_settings SET lottery_rollover = v_new_rollover WHERE id = 'default';
  END IF;

  RETURN json_build_object('success', true, 'rollover', v_new_rollover);
END;
$$;
