-- Multi-property foundation. Purely additive: the existing apartment becomes the first
-- row in public.properties and every existing record is assigned to it.

CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_name TEXT NOT NULL,
  public_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','inactive')),
  short_description TEXT,
  full_description TEXT,
  -- Per-language content for de/en/ar, e.g.
  -- {"de":{"public_name":"…","short_description":"…","full_description":"…"}, "en":{…}, "ar":{…}}
  translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  address TEXT,
  area TEXT,
  maximum_guests INTEGER NOT NULL DEFAULT 2 CHECK (maximum_guests BETWEEN 1 AND 30),
  bedrooms INTEGER NOT NULL DEFAULT 1 CHECK (bedrooms >= 0),
  beds INTEGER NOT NULL DEFAULT 1 CHECK (beds >= 0),
  bathrooms INTEGER NOT NULL DEFAULT 1 CHECK (bathrooms >= 0),
  check_in_time TIME NOT NULL DEFAULT '14:00',
  check_out_time TIME NOT NULL DEFAULT '11:00',
  minimum_nights INTEGER NOT NULL DEFAULT 1 CHECK (minimum_nights >= 1),
  maximum_nights INTEGER NOT NULL DEFAULT 60 CHECK (maximum_nights >= 1),
  base_price INTEGER NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  min_price INTEGER NOT NULL DEFAULT 0 CHECK (min_price >= 0),
  max_price INTEGER NOT NULL DEFAULT 0 CHECK (max_price >= 0),
  cleaning_fee INTEGER NOT NULL DEFAULT 0 CHECK (cleaning_fee >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  direct_booking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  instant_booking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pricing_integration TEXT,
  pricing_integration_ref TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.properties.base_price IS 'Minor currency units (integer). Never floats.';

GRANT SELECT ON public.properties TO anon, authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active properties" ON public.properties
  FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "Admins read all properties" ON public.properties
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage properties" ON public.properties
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.properties TO authenticated;

CREATE TRIGGER properties_updated_at BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- The apartment that exists today.
INSERT INTO public.properties (
  id, internal_name, public_name, slug, status, short_description, translations,
  area, maximum_guests, bedrooms, beds, bathrooms, minimum_nights, base_price,
  cleaning_fee, currency, direct_booking_enabled, sort_order
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Madaris Apartment',
  'Madaris Apartment',
  'madaris-apartment',
  'active',
  'Boutique apartment in Hurghada by the Red Sea.',
  jsonb_build_object(
    'de', jsonb_build_object('public_name','Madaris Apartment'),
    'en', jsonb_build_object('public_name','Madaris Apartment'),
    'ar', jsonb_build_object('public_name','Madaris Apartment')
  ),
  'Hurghada', 6, 1, 2, 1, 1, 2000, 0, 'EUR', TRUE, 0
) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- existing tables

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS booking_number TEXT;

ALTER TABLE public.calendar_blocks
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;

ALTER TABLE public.ical_sync_log
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE;

UPDATE public.bookings SET property_id = '11111111-1111-4111-8111-111111111111' WHERE property_id IS NULL;
UPDATE public.calendar_blocks SET property_id = '11111111-1111-4111-8111-111111111111' WHERE property_id IS NULL;
UPDATE public.payment_transactions SET property_id = '11111111-1111-4111-8111-111111111111' WHERE property_id IS NULL;
UPDATE public.ical_sync_log SET property_id = '11111111-1111-4111-8111-111111111111' WHERE property_id IS NULL;
UPDATE public.calendar_blocks SET source = 'airbnb' WHERE external_uid IS NOT NULL AND source <> 'airbnb';

ALTER TABLE public.bookings ALTER COLUMN property_id SET DEFAULT '11111111-1111-4111-8111-111111111111';
ALTER TABLE public.calendar_blocks ALTER COLUMN property_id SET DEFAULT '11111111-1111-4111-8111-111111111111';
ALTER TABLE public.bookings ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE public.calendar_blocks ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_source_chk CHECK (source IN ('direct','airbnb','manual','other')) NOT VALID;
ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_source_chk;

-- Globally unique booking number, independent of the property.
CREATE SEQUENCE IF NOT EXISTS public.booking_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.assign_booking_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.booking_number IS NULL THEN
    NEW.booking_number := 'SS-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.booking_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER bookings_booking_number BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.assign_booking_number();

UPDATE public.bookings
   SET booking_number = 'SS-' || to_char(created_at, 'YYYY') || '-' ||
       lpad(nextval('public.booking_number_seq')::text, 5, '0')
 WHERE booking_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_booking_number_idx ON public.bookings (booking_number);
CREATE INDEX IF NOT EXISTS bookings_property_idx ON public.bookings (property_id, checkin, checkout);
CREATE INDEX IF NOT EXISTS calendar_blocks_property_idx ON public.calendar_blocks (property_id, start_date, end_date);

-- Airbnb UIDs are only unique per property feed.
DROP INDEX IF EXISTS calendar_blocks_external_uid_idx;
CREATE UNIQUE INDEX IF NOT EXISTS calendar_blocks_property_external_uid_idx
  ON public.calendar_blocks (property_id, external_uid) WHERE external_uid IS NOT NULL;

-- ---------------------------------------------------------------- new per-property tables

CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  airbnb_ical_url TEXT,
  export_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  last_sync_imported INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.calendar_integrations TO service_role;
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER calendar_integrations_updated_at BEFORE UPDATE ON public.calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Carry the existing single-apartment Airbnb settings over unchanged.
INSERT INTO public.calendar_integrations
  (property_id, airbnb_ical_url, export_token, last_sync_at, last_sync_status, last_sync_error, last_sync_imported)
SELECT '11111111-1111-4111-8111-111111111111', s.airbnb_ical_url, s.export_token,
       s.last_sync_at, s.last_sync_status, s.last_sync_error, s.last_sync_imported
  FROM public.ical_settings s WHERE s.id
ON CONFLICT (property_id) DO NOTHING;

COMMENT ON TABLE public.ical_settings IS 'DEPRECATED: replaced by public.calendar_integrations (per property). cron_secret still used by the sync endpoint.';

CREATE TABLE IF NOT EXISTS public.daily_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  minimum_nights INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, date)
);
GRANT SELECT ON public.daily_prices TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.daily_prices TO authenticated;
GRANT ALL ON public.daily_prices TO service_role;
ALTER TABLE public.daily_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads daily prices" ON public.daily_prices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage daily prices" ON public.daily_prices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER daily_prices_updated_at BEFORE UPDATE ON public.daily_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'season' CHECK (rule_type IN ('season','weekend','length_of_stay','last_minute','early_bird')),
  start_date DATE,
  end_date DATE,
  price INTEGER CHECK (price IS NULL OR price >= 0),
  percent_adjustment INTEGER,
  minimum_nights INTEGER,
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage pricing rules" ON public.pricing_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.property_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.property_images TO authenticated;
GRANT ALL ON public.property_images TO service_role;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads property images" ON public.property_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage property images" ON public.property_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label JSONB NOT NULL DEFAULT '{}'::jsonb,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, key)
);
GRANT SELECT ON public.amenities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.amenities TO authenticated;
GRANT ALL ON public.amenities TO service_role;
ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads amenities" ON public.amenities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage amenities" ON public.amenities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  template TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_notifications TO authenticated;
GRANT ALL ON public.email_notifications TO service_role;
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read email notifications" ON public.email_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------- property-aware logic

CREATE OR REPLACE FUNCTION public.default_property_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.properties
   WHERE status = 'active'
   ORDER BY sort_order, created_at
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.default_property_id() TO anon, authenticated, service_role;

-- Overlap checks are always scoped to one property.
CREATE OR REPLACE FUNCTION public.check_property_availability(_property_id uuid, _checkin date, _checkout date)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE property_id = _property_id AND status = 'confirmed'
      AND daterange(checkin, checkout, '[)') && daterange(_checkin, _checkout, '[)')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE property_id = _property_id AND booking_status = 'payment_pending'
      AND payment_expires_at IS NOT NULL AND payment_expires_at > now()
      AND daterange(checkin, checkout, '[)') && daterange(_checkin, _checkout, '[)')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.calendar_blocks
    WHERE property_id = _property_id
      AND daterange(start_date, end_date, '[)') && daterange(_checkin, _checkout, '[)')
  );
$$;
GRANT EXECUTE ON FUNCTION public.check_property_availability(uuid, date, date) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_availability(_checkin date, _checkout date)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.check_property_availability(public.default_property_id(), _checkin, _checkout);
$$;

CREATE OR REPLACE FUNCTION public.public_blocked_ranges_for(_property_id uuid)
RETURNS TABLE(start_date date, end_date date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT b.checkin, b.checkout FROM public.bookings b
    WHERE b.property_id = _property_id AND b.status = 'confirmed' AND b.checkout >= CURRENT_DATE
  UNION ALL
  SELECT b.checkin, b.checkout FROM public.bookings b
    WHERE b.property_id = _property_id AND b.booking_status = 'payment_pending'
      AND b.payment_expires_at IS NOT NULL AND b.payment_expires_at > now()
      AND b.checkout >= CURRENT_DATE
  UNION ALL
  SELECT c.start_date, c.end_date FROM public.calendar_blocks c
    WHERE c.property_id = _property_id AND c.end_date >= CURRENT_DATE;
$$;
GRANT EXECUTE ON FUNCTION public.public_blocked_ranges_for(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.public_blocked_ranges()
RETURNS TABLE(start_date date, end_date date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.public_blocked_ranges_for(public.default_property_id());
$$;

-- Blocks may only clash with entries of the same property.
CREATE OR REPLACE FUNCTION public.calendar_blocks_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.external_uid IS NOT NULL THEN
    RETURN NEW; -- Airbnb is the source of truth for its own ranges
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.calendar_blocks c
    WHERE c.property_id = NEW.property_id
      AND c.id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND daterange(c.start_date, c.end_date, '[)') && daterange(NEW.start_date, NEW.end_date, '[)')
  ) OR EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.property_id = NEW.property_id
      AND b.status = 'confirmed'
      AND daterange(b.checkin, b.checkout, '[)') && daterange(NEW.start_date, NEW.end_date, '[)')
  ) THEN
    RAISE EXCEPTION 'dates_unavailable';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.create_property_booking_request(
  _property_id uuid, _guest_name text, _guest_email text, _guest_phone text,
  _checkin date, _checkout date, _guests integer, _message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_id UUID;
  prop public.properties%ROWTYPE;
BEGIN
  SELECT * INTO prop FROM public.properties WHERE id = coalesce(_property_id, public.default_property_id());
  IF NOT FOUND THEN RAISE EXCEPTION 'property_not_found'; END IF;
  IF prop.status <> 'active' OR NOT prop.direct_booking_enabled THEN RAISE EXCEPTION 'property_not_bookable'; END IF;
  IF _checkin < CURRENT_DATE THEN RAISE EXCEPTION 'checkin_in_past'; END IF;
  IF _checkout <= _checkin THEN RAISE EXCEPTION 'invalid_range'; END IF;
  IF (_checkout - _checkin) < prop.minimum_nights THEN RAISE EXCEPTION 'below_minimum_nights'; END IF;
  IF (_checkout - _checkin) > prop.maximum_nights THEN RAISE EXCEPTION 'range_too_long'; END IF;
  IF _guests < 1 OR _guests > prop.maximum_guests THEN RAISE EXCEPTION 'invalid_guests'; END IF;
  IF length(_guest_name) < 2 OR length(_guest_name) > 120 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF _guest_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF NOT public.check_property_availability(prop.id, _checkin, _checkout) THEN RAISE EXCEPTION 'dates_unavailable'; END IF;

  INSERT INTO public.bookings (property_id, guest_name, guest_email, guest_phone, checkin, checkout, guests, message, source, currency, cleaning_fee)
  VALUES (prop.id, trim(_guest_name), lower(trim(_guest_email)), _guest_phone, _checkin, _checkout, _guests, _message, 'direct', prop.currency, prop.cleaning_fee)
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_property_booking_request(uuid, text, text, text, date, date, integer, text) TO anon, authenticated, service_role;

-- Existing single-apartment entry point keeps working, now delegating.
CREATE OR REPLACE FUNCTION public.create_booking_request(
  _guest_name text, _guest_email text, _guest_phone text,
  _checkin date, _checkout date, _guests integer, _message text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.create_property_booking_request(
    public.default_property_id(), _guest_name, _guest_email, _guest_phone,
    _checkin, _checkout, _guests, _message);
$$;

CREATE OR REPLACE FUNCTION public.admin_confirm_booking(_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r public.bookings%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO r FROM public.bookings WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;
  IF NOT public.check_property_availability(r.property_id, r.checkin, r.checkout) THEN RAISE EXCEPTION 'dates_unavailable'; END IF;
  UPDATE public.bookings
     SET status = 'confirmed', booking_status = 'confirmed', confirmed_at = now()
   WHERE id = _id;
  RETURN 'confirmed';
END; $$;