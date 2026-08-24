-- These functions are only used by Auth triggers and must not be callable as public RPC endpoints.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_email_confirmation() FROM PUBLIC, anon, authenticated;
