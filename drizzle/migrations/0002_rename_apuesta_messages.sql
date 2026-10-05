DO $$
DECLARE r record; d text;
BEGIN
  FOR r IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' AND p.prosrc ~* 'apuesta' LOOP
    d := pg_get_functiondef(r.oid);
    d := replace(d,'apuestas','predicciones'); d := replace(d,'Apuestas','Predicciones');
    d := replace(d,'apuesta','predicción'); d := replace(d,'Apuesta','Predicción');
    EXECUTE d;
  END LOOP;
END $$;