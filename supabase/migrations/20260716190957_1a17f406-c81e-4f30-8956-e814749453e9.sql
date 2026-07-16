-- Tighten EXECUTE on SECURITY DEFINER functions.
-- Default: revoke from PUBLIC (and anon/authenticated), grant back only where required.

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_availability(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_booking_request(text, text, text, date, date, integer, text) FROM PUBLIC, anon, authenticated;

-- has_role is referenced by RLS policies evaluated for signed-in users.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Public booking widget submits requests as anon; signed-in users can also submit.
GRANT EXECUTE ON FUNCTION public.create_booking_request(text, text, text, date, date, integer, text) TO anon, authenticated;

-- update_updated_at_column is only invoked internally by triggers — no API caller needs EXECUTE.
-- check_availability is only invoked inside create_booking_request (SECURITY DEFINER) — no direct caller needs EXECUTE.