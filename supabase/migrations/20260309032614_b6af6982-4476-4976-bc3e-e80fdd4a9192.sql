
-- Table to store market probability snapshots over time
CREATE TABLE public.market_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  option_name text NOT NULL,
  probability numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  total_volume numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view snapshots" ON public.market_snapshots
  FOR SELECT USING (true);

CREATE INDEX idx_market_snapshots_market_id ON public.market_snapshots(market_id, created_at);

-- Function to record a snapshot after each bet
CREATE OR REPLACE FUNCTION public.record_market_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_option RECORD;
BEGIN
  -- Get total volume for the market
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total
  FROM market_options WHERE market_id = NEW.market_id;

  -- Insert a snapshot for each option
  FOR v_option IN SELECT option_name, total_amount FROM market_options WHERE market_id = NEW.market_id
  LOOP
    INSERT INTO market_snapshots (market_id, option_name, probability, total_amount, total_volume)
    VALUES (
      NEW.market_id,
      v_option.option_name,
      CASE WHEN v_total > 0 THEN (v_option.total_amount / v_total) * 100 ELSE 0 END,
      v_option.total_amount,
      v_total
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger on market_options when total_amount changes
CREATE TRIGGER trg_record_market_snapshot
  AFTER UPDATE OF total_amount ON public.market_options
  FOR EACH ROW
  EXECUTE FUNCTION public.record_market_snapshot();

-- Cashout function: sells a bet at current market value
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
  -- Get the bet
  SELECT * INTO v_bet FROM bets WHERE id = p_bet_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Apuesta no encontrada');
  END IF;

  -- Check bet hasn't been resolved
  IF v_bet.is_winner IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Esta apuesta ya fue resuelta');
  END IF;

  -- Get market
  SELECT * INTO v_market FROM markets WHERE id = v_bet.market_id;
  IF v_market.status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'El mercado no está activo');
  END IF;

  -- Check market hasn't expired
  IF v_market.closes_at <= now() THEN
    RETURN json_build_object('success', false, 'error', 'El mercado ha expirado');
  END IF;

  -- Get current option total and market total
  SELECT total_amount INTO v_option_total
  FROM market_options WHERE market_id = v_bet.market_id AND option_name = v_bet.option;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_market_total
  FROM market_options WHERE market_id = v_bet.market_id;

  -- Calculate current probability and cashout value
  v_current_probability := CASE WHEN v_market_total > 0 THEN v_option_total / v_market_total ELSE 0 END;
  
  -- Cashout = bet_amount * current_probability * payout_multiplier
  -- Simplified: the user gets back their share of the pool based on current odds
  v_cashout_value := ROUND(v_bet.amount * (1 + (1 - v_current_probability)), 2);
  
  -- Cap cashout at potential payout
  IF v_bet.potential_payout IS NOT NULL AND v_cashout_value > v_bet.potential_payout THEN
    v_cashout_value := v_bet.potential_payout;
  END IF;

  -- Minimum cashout is 1% of bet
  IF v_cashout_value < v_bet.amount * 0.01 THEN
    v_cashout_value := ROUND(v_bet.amount * 0.01, 2);
  END IF;

  -- Update balance
  UPDATE profiles SET balance = balance + v_cashout_value WHERE id = p_user_id;

  -- Remove bet amount from market option
  UPDATE market_options 
  SET total_amount = GREATEST(total_amount - v_bet.amount, 0)
  WHERE market_id = v_bet.market_id AND option_name = v_bet.option;

  -- Mark bet as cashed out (is_winner = false, payout_amount = cashout_value)
  UPDATE bets SET is_winner = false, payout_amount = v_cashout_value WHERE id = p_bet_id;

  -- Record transaction
  INSERT INTO transactions (user_id, amount, type, description, market_id)
  VALUES (p_user_id, v_cashout_value, 'payout', 'Retiro de apuesta (cashout)', v_bet.market_id);

  RETURN json_build_object(
    'success', true, 
    'cashout_value', v_cashout_value,
    'original_amount', v_bet.amount
  );
END;
$$;
