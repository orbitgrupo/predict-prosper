-- F-09: Performance indexes on audit and operational tables
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id
  ON public.audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON public.audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bets_user_id
  ON public.bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_market_id
  ON public.bets(market_id);
CREATE INDEX IF NOT EXISTS idx_bets_created_at
  ON public.bets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id
  ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_market_id
  ON public.transactions(market_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
  ON public.transactions(created_at DESC);