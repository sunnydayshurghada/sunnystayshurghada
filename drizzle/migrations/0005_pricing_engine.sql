-- Per-property pricing settings
CREATE TABLE IF NOT EXISTS public.property_pricing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL UNIQUE REFERENCES public.properties(id) ON DELETE CASCADE,
  pricing_mode TEXT NOT NULL DEFAULT 'manual' CHECK (pricing_mode IN ('manual','pricelabs','hybrid')),
  currency TEXT NOT NULL DEFAULT 'EUR',
  base_price INTEGER NOT NULL DEFAULT 2000 CHECK (base_price > 0),
  minimum_price INTEGER NOT NULL DEFAULT 1000 CHECK (minimum_price > 0),
  maximum_price INTEGER NOT NULL DEFAULT 20000 CHECK (maximum_price > 0),
  weekend_price INTEGER CHECK (weekend_price IS NULL OR weekend_price > 0),
  cleaning_fee INTEGER NOT NULL DEFAULT 0 CHECK (cleaning_fee >= 0),
  direct_booking_adjustment_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  direct_booking_adjustment_fixed INTEGER NOT NULL DEFAULT 0,
  minimum_stay INTEGER NOT NULL DEFAULT 1 CHECK (minimum_stay >= 1),
  extra_guest_fee INTEGER NOT NULL DEFAULT 0 CHECK (extra_guest_fee >= 0),
  extra_guest_after INTEGER NOT NULL DEFAULT 2 CHECK (extra_guest_after >= 1),
  weekly_discount_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  monthly_discount_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  length_of_stay_nights INTEGER,
  length_of_stay_discount_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  last_minute_days INTEGER,
  last_minute_discount_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  pricelabs_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pricelabs_listing_id TEXT,
  pricelabs_last_sync_at TIMESTAMPTZ,
  pricelabs_sync_status TEXT,
  pricelabs_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.property_pricing_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.property_pricing_settings TO authenticated;
GRANT ALL ON public.property_pricing_settings TO service_role;
ALTER TABLE public.property_pricing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads pricing settings" ON public.property_pricing_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage pricing settings" ON public.property_pricing_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER property_pricing_settings_updated_at BEFORE UPDATE ON public.property_pricing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed settings for every existing property, derived from its own base data
INSERT INTO public.property_pricing_settings (property_id, currency, base_price, minimum_price, maximum_price, cleaning_fee, minimum_stay)
SELECT p.id,
       COALESCE(p.currency, 'EUR'),
       GREATEST(COALESCE(NULLIF(p.base_price, 0), 2000), 1),
       GREATEST(COALESCE(NULLIF(p.min_price, 0), 1000), 1),
       GREATEST(COALESCE(NULLIF(p.max_price, 0), 20000), 1),
       COALESCE(p.cleaning_fee, 0),
       GREATEST(COALESCE(p.minimum_nights, 1), 1)
FROM public.properties p
ON CONFLICT (property_id) DO NOTHING;

-- daily_prices: richer price provenance (existing rows keep their price)
ALTER TABLE public.daily_prices ADD COLUMN IF NOT EXISTS calculated_price INTEGER;
ALTER TABLE public.daily_prices ADD COLUMN IF NOT EXISTS final_price INTEGER;
ALTER TABLE public.daily_prices ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE public.daily_prices ADD COLUMN IF NOT EXISTS price_source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.daily_prices ADD COLUMN IF NOT EXISTS manual_override BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.daily_prices ADD COLUMN IF NOT EXISTS override_reason TEXT;
ALTER TABLE public.daily_prices ADD COLUMN IF NOT EXISTS override_expires_at TIMESTAMPTZ;
ALTER TABLE public.daily_prices ADD COLUMN IF NOT EXISTS provider_updated_at TIMESTAMPTZ;
ALTER TABLE public.daily_prices ADD COLUMN IF NOT EXISTS pricelabs_price INTEGER;
UPDATE public.daily_prices
   SET final_price = COALESCE(final_price, price),
       calculated_price = COALESCE(calculated_price, price),
       manual_override = TRUE
 WHERE final_price IS NULL;
ALTER TABLE public.daily_prices
  ADD CONSTRAINT daily_prices_source_check
  CHECK (price_source IN ('manual','pricelabs','pricelabs_override','season','weekend','base')) NOT VALID;
ALTER TABLE public.daily_prices VALIDATE CONSTRAINT daily_prices_source_check;
ALTER TABLE public.daily_prices
  ADD CONSTRAINT daily_prices_final_positive CHECK (final_price IS NULL OR final_price > 0) NOT VALID;
ALTER TABLE public.daily_prices VALIDATE CONSTRAINT daily_prices_final_positive;

-- pricing_rules: flexible adjustments
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS adjustment_type TEXT NOT NULL DEFAULT 'fixed_price';
ALTER TABLE public.pricing_rules ADD COLUMN IF NOT EXISTS adjustment_value NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.pricing_rules
  ADD CONSTRAINT pricing_rules_adjustment_type_check
  CHECK (adjustment_type IN ('fixed_price','percent','amount')) NOT VALID;
ALTER TABLE public.pricing_rules VALIDATE CONSTRAINT pricing_rules_adjustment_type_check;
UPDATE public.pricing_rules SET adjustment_value = price WHERE price IS NOT NULL AND adjustment_value = 0;
GRANT SELECT ON public.pricing_rules TO anon;
DROP POLICY IF EXISTS "Public reads pricing rules" ON public.pricing_rules;
CREATE POLICY "Public reads pricing rules" ON public.pricing_rules
  FOR SELECT TO anon, authenticated USING (active);

-- Audit trail for every admin price change
CREATE TABLE IF NOT EXISTS public.pricing_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pricing_audit_log TO authenticated;
GRANT ALL ON public.pricing_audit_log TO service_role;
ALTER TABLE public.pricing_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read pricing audit" ON public.pricing_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS pricing_audit_property_idx ON public.pricing_audit_log (property_id, created_at DESC);