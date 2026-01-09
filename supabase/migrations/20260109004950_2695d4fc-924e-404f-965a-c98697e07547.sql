-- Create table for market suggestions
CREATE TABLE public.market_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  closes_at TIMESTAMP WITH TIME ZONE NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_option TEXT NOT NULL,
  fee_amount NUMERIC NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.market_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can view their own suggestions
CREATE POLICY "Users can view their own suggestions"
ON public.market_suggestions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create suggestions
CREATE POLICY "Users can insert suggestions"
ON public.market_suggestions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all suggestions
CREATE POLICY "Admins can view all suggestions"
ON public.market_suggestions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update suggestions
CREATE POLICY "Admins can update suggestions"
ON public.market_suggestions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete suggestions
CREATE POLICY "Admins can delete suggestions"
ON public.market_suggestions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_market_suggestions_updated_at
BEFORE UPDATE ON public.market_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create function to submit a market suggestion with fee
CREATE OR REPLACE FUNCTION public.submit_market_suggestion(
  p_user_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_category TEXT,
  p_closes_at TIMESTAMP WITH TIME ZONE,
  p_options JSONB,
  p_selected_option TEXT,
  p_fee_amount NUMERIC DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_is_blocked BOOLEAN;
  v_suggestion_id UUID;
BEGIN
  -- Validate fee amount
  IF p_fee_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'El monto de la tarifa debe ser mayor a cero');
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

  IF v_current_balance < p_fee_amount THEN
    RETURN json_build_object('success', false, 'error', 'Saldo insuficiente para pagar la tarifa de sugerencia');
  END IF;

  -- Insert suggestion
  INSERT INTO market_suggestions (user_id, title, description, category, closes_at, options, selected_option, fee_amount)
  VALUES (p_user_id, p_title, p_description, p_category, p_closes_at, p_options, p_selected_option, p_fee_amount)
  RETURNING id INTO v_suggestion_id;

  -- Deduct fee from balance
  UPDATE profiles
  SET balance = balance - p_fee_amount
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'fee', -p_fee_amount, 'Tarifa por sugerencia de predicción: ' || p_title);

  RETURN json_build_object('success', true, 'suggestion_id', v_suggestion_id);
END;
$$;