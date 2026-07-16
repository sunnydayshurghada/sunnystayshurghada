-- Lock down SECURITY DEFINER function execution to only what is required.
-- Trigger function: not called via API
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Internal helper: only used inside create_booking_request (which runs as definer)
REVOKE ALL ON FUNCTION public.check_availability(date, date) FROM PUBLIC, anon, authenticated;

-- has_role: used by RLS policies, keep authenticated EXECUTE only
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- create_booking_request: intentional public entry point for guests to submit bookings
REVOKE ALL ON FUNCTION public.create_booking_request(text, text, text, date, date, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_request(text, text, text, date, date, integer, text) TO anon, authenticated;