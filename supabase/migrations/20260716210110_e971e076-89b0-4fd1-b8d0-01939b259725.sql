-- Revoke EXECUTE on all SECURITY DEFINER functions from anon/authenticated/PUBLIC.
-- These functions are now only reachable via the service_role (server functions).
REVOKE EXECUTE ON FUNCTION public.create_booking_request(text, text, text, date, date, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_availability(date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_booking_request(text, text, text, date, date, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_availability(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;