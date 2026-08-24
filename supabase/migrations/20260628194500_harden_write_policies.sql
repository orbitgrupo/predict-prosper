-- Restrict direct client writes and expose safer profile RPCs

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create bets" ON public.bets;
DROP POLICY IF EXISTS "Users can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert suggestions" ON public.market_suggestions;
DROP POLICY IF EXISTS "Users can create withdrawals" ON public.withdrawal_requests;

CREATE OR REPLACE FUNCTION public.update_profile_basic(p_username text, p_phone text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_username text := trim(p_username);
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF v_username IS NULL OR length(v_username) < 3 OR length(v_username) > 30 THEN
    RETURN json_build_object('success', false, 'error', 'El nombre de usuario debe tener entre 3 y 30 caracteres');
  END IF;

  IF v_username !~ '^[A-Za-z0-9_.\-áéíóúñüÁÉÍÓÚÑÜ]+$' THEN
    RETURN json_build_object('success', false, 'error', 'El nombre de usuario contiene caracteres no permitidos');
  END IF;

  IF v_phone IS NOT NULL AND (length(v_phone) > 20 OR v_phone !~ '^[0-9\s\-+()]+$') THEN
    RETURN json_build_object('success', false, 'error', 'El numero de telefono no es valido');
  END IF;

  UPDATE profiles
  SET username = v_username,
      phone = v_phone,
      updated_at = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Perfil no encontrado');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_terms()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  UPDATE profiles
  SET accepted_terms = true,
      accepted_terms_at = now(),
      updated_at = now()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Perfil no encontrado');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_identity_document(p_side text, p_file_path text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  IF p_side NOT IN ('front', 'back') THEN
    RETURN json_build_object('success', false, 'error', 'Tipo de documento no valido');
  END IF;

  IF p_file_path IS NULL OR p_file_path = '' OR split_part(p_file_path, '/', 1) != auth.uid()::text THEN
    RETURN json_build_object('success', false, 'error', 'Ruta de archivo no valida');
  END IF;

  SELECT document_status INTO v_existing_status
  FROM profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Perfil no encontrado');
  END IF;

  IF v_existing_status = 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'Los documentos ya fueron aprobados');
  END IF;

  IF p_side = 'front' THEN
    UPDATE profiles
    SET document_front_url = p_file_path,
        document_status = 'pending',
        document_rejection_reason = null,
        updated_at = now()
    WHERE id = auth.uid();
  ELSE
    UPDATE profiles
    SET document_back_url = p_file_path,
        document_status = 'pending',
        document_rejection_reason = null,
        updated_at = now()
    WHERE id = auth.uid();
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_age_confirmation(p_is_age_verified boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT document_status INTO v_existing_status
  FROM profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Perfil no encontrado');
  END IF;

  IF v_existing_status = 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'La verificacion ya fue aprobada por un administrador');
  END IF;

  UPDATE profiles
  SET is_age_verified = coalesce(p_is_age_verified, false),
      updated_at = now()
  WHERE id = auth.uid();

  RETURN json_build_object('success', true);
END;
$$;
