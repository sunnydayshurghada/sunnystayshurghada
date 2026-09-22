-- 1. Calendar entries owned by the host: manual bookings and blocked periods
CREATE TABLE public.calendar_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'block' CHECK (entry_type IN ('booking','block')),
  source TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('direct','airbnb','booking_com','other')),
  guest_name TEXT,
  guests INTEGER,
  guest_phone TEXT,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_blocks_range_check CHECK (end_date > start_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_blocks TO authenticated;
GRANT ALL ON public.calendar_blocks TO service_role;

ALTER TABLE public.calendar_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage calendar blocks" ON public.calendar_blocks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX calendar_blocks_dates_idx ON public.calendar_blocks (start_date, end_date);

CREATE TRIGGER calendar_blocks_updated_at BEFORE UPDATE ON public.calendar_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Admin allowlist: emails that may claim the host role after signing up
CREATE TABLE public.admin_allowlist (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_allowlist TO service_role;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.user_roles TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_admin_role()
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email TEXT := lower(coalesce(auth.jwt() ->> 'email', ''));
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL OR _email = '' THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = _email) THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN TRUE;
END; $$;

-- 3. Availability: only confirmed bookings and host calendar entries block a range
CREATE OR REPLACE FUNCTION public.check_availability(_checkin DATE, _checkout DATE)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE status = 'confirmed'
      AND daterange(checkin, checkout, '[)') && daterange(_checkin, _checkout, '[)')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.calendar_blocks
    WHERE daterange(start_date, end_date, '[)') && daterange(_checkin, _checkout, '[)')
  );
$$;

-- 4. Public, privacy-safe list of unavailable ranges
CREATE OR REPLACE FUNCTION public.public_blocked_ranges()
RETURNS TABLE (start_date DATE, end_date DATE)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.checkin, b.checkout FROM public.bookings b
    WHERE b.status = 'confirmed' AND b.checkout >= CURRENT_DATE
  UNION ALL
  SELECT c.start_date, c.end_date FROM public.calendar_blocks c
    WHERE c.end_date >= CURRENT_DATE;
$$;

-- 5. Overlap guard for host calendar entries
CREATE OR REPLACE FUNCTION public.calendar_blocks_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.calendar_blocks c
    WHERE c.id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND daterange(c.start_date, c.end_date, '[)') && daterange(NEW.start_date, NEW.end_date, '[)')
  ) OR EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.status = 'confirmed'
      AND daterange(b.checkin, b.checkout, '[)') && daterange(NEW.start_date, NEW.end_date, '[)')
  ) THEN
    RAISE EXCEPTION 'dates_unavailable';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER calendar_blocks_no_overlap
  BEFORE INSERT OR UPDATE ON public.calendar_blocks
  FOR EACH ROW EXECUTE FUNCTION public.calendar_blocks_guard();

-- 6. Host decisions with re-checked conflict detection
CREATE OR REPLACE FUNCTION public.admin_confirm_booking(_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.bookings%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.bookings WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;
  IF NOT public.check_availability(r.checkin, r.checkout) THEN RAISE EXCEPTION 'dates_unavailable'; END IF;
  UPDATE public.bookings SET status = 'confirmed' WHERE id = _id;
  RETURN 'confirmed';
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_booking_status(_id UUID, _status TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('rejected','cancelled','pending') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE public.bookings SET status = _status WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN _status;
END; $$;

REVOKE EXECUTE ON FUNCTION public.claim_admin_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.public_blocked_ranges() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_confirm_booking(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_booking_status(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calendar_blocks_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_availability(DATE, DATE) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_admin_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_blocked_ranges() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_booking(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_booking_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_availability(DATE, DATE) TO anon, authenticated;