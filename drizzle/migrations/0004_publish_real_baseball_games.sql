ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS game_starts_at timestamptz;
CREATE OR REPLACE FUNCTION public.publish_baseball_game(p_game_pk integer, p_away text, p_home text, p_starts_at timestamptz, p_closes_at timestamptz, p_image_url text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Solo administradores pueden publicar partidos'; END IF;
  IF p_game_pk IS NULL OR p_game_pk <= 0 OR p_away IS NULL OR p_home IS NULL OR length(trim(p_away)) = 0 OR length(trim(p_home)) = 0 OR lower(trim(p_away)) = lower(trim(p_home)) THEN RAISE EXCEPTION 'Partido o equipos inválidos'; END IF;
  IF p_starts_at IS NULL OR p_closes_at IS NULL OR p_closes_at <= now() OR p_closes_at < p_starts_at THEN RAISE EXCEPTION 'Fecha de cierre inválida'; END IF;
  PERFORM pg_advisory_xact_lock(7281, p_game_pk);
  IF EXISTS(SELECT 1 FROM public.markets WHERE mlb_game_pk = p_game_pk) THEN RAISE EXCEPTION 'Este partido ya tiene un mercado'; END IF;
  INSERT INTO public.markets(title,description,category,closes_at,game_starts_at,created_by,image_url,mlb_game_pk,status)
  VALUES(trim(p_away)||' vs '||trim(p_home), 'Partido oficial MLB. '||trim(p_away)||' (visitante) vs '||trim(p_home)||' (local). Gana el equipo declarado vencedor en el resultado final oficial de MLB, incluyendo entradas extra. Si el partido se aplaza, suspende o cancela, el administrador revisará el mercado antes de resolverlo. Resolución manual tras confirmar el resultado oficial.', 'MLB',p_closes_at,p_starts_at,auth.uid(),nullif(trim(p_image_url),''),p_game_pk,'active') RETURNING id INTO v_id;
  INSERT INTO public.market_options(market_id,option_name) VALUES(v_id,trim(p_away)),(v_id,trim(p_home));
  INSERT INTO public.audit_logs(admin_id,action,target_type,target_id,details) VALUES(auth.uid(),'publish_baseball_game','markets',v_id::text,jsonb_build_object('mlb_game_pk',p_game_pk,'starts_at',p_starts_at,'reason','Publicación de partido oficial MLB'));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.publish_baseball_game(integer,text,text,timestamptz,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_baseball_game(integer,text,text,timestamptz,timestamptz,text) TO authenticated, service_role;