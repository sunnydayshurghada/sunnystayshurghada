
-- Bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  checkin DATE NOT NULL,
  checkout DATE NOT NULL,
  guests INTEGER NOT NULL DEFAULT 2,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bookings_dates_check CHECK (checkout > checkin),
  CONSTRAINT bookings_guests_check CHECK (guests BETWEEN 1 AND 6)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE INDEX bookings_dates_idx ON public.bookings (checkin, checkout) WHERE status IN ('pending','confirmed');

-- Roles infrastructure
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Policies: admins read/manage; users see their own role row
CREATE POLICY "Admins view all bookings" ON public.bookings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update bookings" ON public.bookings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete bookings" ON public.bookings
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users see their own role" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public availability check: returns true if the requested range is free
CREATE OR REPLACE FUNCTION public.check_availability(_checkin DATE, _checkout DATE)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE status IN ('pending','confirmed')
      AND daterange(checkin, checkout, '[)') && daterange(_checkin, _checkout, '[)')
  );
$$;

-- Public booking request: validates and inserts a pending booking
CREATE OR REPLACE FUNCTION public.create_booking_request(
  _guest_name TEXT, _guest_email TEXT, _guest_phone TEXT,
  _checkin DATE, _checkout DATE, _guests INTEGER, _message TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id UUID;
BEGIN
  IF _checkin < CURRENT_DATE THEN RAISE EXCEPTION 'checkin_in_past'; END IF;
  IF _checkout <= _checkin THEN RAISE EXCEPTION 'invalid_range'; END IF;
  IF (_checkout - _checkin) > 60 THEN RAISE EXCEPTION 'range_too_long'; END IF;
  IF _guests < 1 OR _guests > 6 THEN RAISE EXCEPTION 'invalid_guests'; END IF;
  IF length(_guest_name) < 2 OR length(_guest_name) > 120 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF _guest_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF NOT public.check_availability(_checkin, _checkout) THEN RAISE EXCEPTION 'dates_unavailable'; END IF;

  INSERT INTO public.bookings (guest_name, guest_email, guest_phone, checkin, checkout, guests, message)
  VALUES (trim(_guest_name), lower(trim(_guest_email)), _guest_phone, _checkin, _checkout, _guests, _message)
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.check_availability(DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_request(TEXT, TEXT, TEXT, DATE, DATE, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;

-- Public read of booked date ranges (no PII) so calendars can render availability
CREATE OR REPLACE VIEW public.booked_ranges
WITH (security_invoker = true) AS
SELECT checkin, checkout FROM public.bookings WHERE status IN ('pending','confirmed');

GRANT SELECT ON public.booked_ranges TO anon, authenticated;
CREATE POLICY "Anyone can see booked ranges via view" ON public.bookings
  FOR SELECT TO anon USING (false);
-- (Above ensures direct table SELECT stays blocked; the view uses SECURITY DEFINER? No — invoker.)
-- Actually with security_invoker=true, anon cannot read via view either. So use definer instead:
