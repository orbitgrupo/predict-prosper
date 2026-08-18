-- RPC endpoints that mutate user/admin data require an authenticated session.
REVOKE ALL ON FUNCTION public.accept_terms() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_add_funds(uuid, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cashout_bet(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.place_bet(uuid, uuid, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_referral(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_withdrawal(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_withdrawal(uuid, numeric, public.withdrawal_method, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_market(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_age_confirmation(boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_identity_document(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_market_suggestion(uuid, text, text, text, timestamp with time zone, jsonb, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_market_suggestion(uuid, text, text, text, timestamp with time zone, jsonb, text, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_profile_basic(text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.accept_terms() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_funds(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cashout_bet(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid, uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_referral(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, public.withdrawal_method, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_market(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_age_confirmation(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_identity_document(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_market_suggestion(uuid, text, text, text, timestamp with time zone, jsonb, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_market_suggestion(uuid, text, text, text, timestamp with time zone, jsonb, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_basic(text, text) TO authenticated;

-- Public referral tracking is intentionally available before signup.
GRANT EXECUTE ON FUNCTION public.track_referral_click(text) TO anon, authenticated;

-- Trigger-only helpers should not be public RPC endpoints.
REVOKE ALL ON FUNCTION public.enforce_withdrawal_economy_mode() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_comment_reaction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_comment_reply() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_market_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.switch_active_economy_balance() FROM PUBLIC, anon, authenticated;
