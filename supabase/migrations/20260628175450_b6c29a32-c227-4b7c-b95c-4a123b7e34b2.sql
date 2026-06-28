
-- Storage policies for market-images bucket
CREATE POLICY "Authenticated users can upload market images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'market-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can update own market images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'market-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can delete own market images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'market-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view market images"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'market-images');

-- Update RPC to accept image_url
CREATE OR REPLACE FUNCTION public.submit_market_suggestion(
  p_user_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_closes_at timestamp with time zone,
  p_options jsonb,
  p_selected_option text,
  p_fee_amount numeric DEFAULT 50,
  p_image_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance NUMERIC;
  v_is_blocked BOOLEAN;
  v_suggestion_id UUID;
BEGIN
  IF p_user_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF p_fee_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'El monto de la tarifa debe ser mayor a cero');
  END IF;

  SELECT balance, is_blocked INTO v_current_balance, v_is_blocked
  FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  IF v_is_blocked THEN
    RETURN json_build_object('success', false, 'error', 'Tu cuenta está bloqueada');
  END IF;

  IF v_current_balance < p_fee_amount THEN
    RETURN json_build_object('success', false, 'error', 'Saldo insuficiente para pagar la tarifa de sugerencia');
  END IF;

  INSERT INTO market_suggestions (user_id, title, description, category, closes_at, options, selected_option, fee_amount, image_url)
  VALUES (p_user_id, p_title, p_description, p_category, p_closes_at, p_options, p_selected_option, p_fee_amount, p_image_url)
  RETURNING id INTO v_suggestion_id;

  UPDATE profiles SET balance = balance - p_fee_amount WHERE id = p_user_id;

  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'fee', -p_fee_amount, 'Tarifa por sugerencia de predicción: ' || p_title);

  RETURN json_build_object('success', true, 'suggestion_id', v_suggestion_id);
END;
$function$;
