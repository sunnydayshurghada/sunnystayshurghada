-- update_updated_at_column: trigger-only helper, never called via the API
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;

-- check_availability: only used internally by create_booking_request, not exposed
REVOKE EXECUTE ON FUNCTION public.check_availability(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_availability(date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_availability(date, date) FROM authenticated;

-- has_role: required by RLS policies for authenticated users; keep them, remove others
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- create_booking_request: intentional public booking entry point for guests
REVOKE EXECUTE ON FUNCTION public.create_booking_request(text, text, text, date, date, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_request(text, text, text, date, date, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_booking_request(text, text, text, date, date, integer, text) TO authenticated;