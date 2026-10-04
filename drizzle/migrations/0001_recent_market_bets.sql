CREATE OR REPLACE FUNCTION public.get_recent_market_bets(p_market_id uuid, p_limit int DEFAULT 12)
RETURNS TABLE(id uuid, option text, amount numeric, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.option, b.amount, b.created_at FROM bets b
  WHERE b.market_id = p_market_id
  ORDER BY b.created_at DESC LIMIT LEAST(GREATEST(p_limit,1),50);
$$;
GRANT EXECUTE ON FUNCTION public.get_recent_market_bets(uuid,int) TO anon, authenticated;