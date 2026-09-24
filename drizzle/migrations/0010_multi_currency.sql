CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL CHECK (base_currency IN ('EGP','EUR','USD')),
  quote_currency text NOT NULL CHECK (quote_currency IN ('EGP','EUR','USD')),
  rate numeric(20,8) NOT NULL CHECK (rate > 0),
  source text NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exchange_rates_pair_idx ON public.exchange_rates (base_currency, quote_currency, fetched_at DESC);
GRANT SELECT ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read rates" ON public.exchange_rates FOR SELECT TO authenticated USING (true);

CREATE TABLE public.currency_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  context text NOT NULL,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  original_amount bigint NOT NULL,
  rate numeric(20,8) NOT NULL CHECK (rate > 0),
  markup_percent numeric(6,3) NOT NULL DEFAULT 0,
  converted_amount bigint NOT NULL,
  rate_source text NOT NULL,
  rate_fetched_at timestamptz NOT NULL,
  rate_valid_until timestamptz NOT NULL,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.currency_conversions TO authenticated;
GRANT ALL ON public.currency_conversions TO service_role;
ALTER TABLE public.currency_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read conversions" ON public.currency_conversions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.property_currency_settings (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  base_currency text NOT NULL DEFAULT 'EUR' CHECK (base_currency IN ('EGP','EUR','USD')),
  owner_statement_currency text NOT NULL DEFAULT 'EUR' CHECK (owner_statement_currency IN ('EGP','EUR','USD')),
  payout_currency text NOT NULL DEFAULT 'EUR' CHECK (payout_currency IN ('EGP','EUR','USD')),
  rate_mode text NOT NULL DEFAULT 'auto' CHECK (rate_mode IN ('auto','manual')),
  markup_percent numeric(6,3) NOT NULL DEFAULT 0 CHECK (markup_percent >= 0 AND markup_percent <= 20),
  rounding_rule text NOT NULL DEFAULT 'half_up' CHECK (rounding_rule IN ('half_up','down','up','whole_unit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.property_currency_settings TO authenticated;
GRANT ALL ON public.property_currency_settings TO service_role;
ALTER TABLE public.property_currency_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read currency settings" ON public.property_currency_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE TRIGGER property_currency_settings_updated BEFORE UPDATE ON public.property_currency_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.property_currency_settings (property_id, base_currency, owner_statement_currency, payout_currency)
SELECT id, CASE WHEN currency IN ('EGP','EUR','USD') THEN currency ELSE 'EUR' END,
       CASE WHEN currency IN ('EGP','EUR','USD') THEN currency ELSE 'EUR' END,
       CASE WHEN currency IN ('EGP','EUR','USD') THEN currency ELSE 'EUR' END
FROM public.properties ON CONFLICT DO NOTHING;

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS preferred_display_currency text NOT NULL DEFAULT 'EUR' CHECK (preferred_display_currency IN ('EGP','EUR','USD'));

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_currency text,
  ADD COLUMN IF NOT EXISTS payment_amount_converted bigint,
  ADD COLUMN IF NOT EXISTS payment_conversion_id uuid REFERENCES public.currency_conversions(id) ON DELETE SET NULL;
ALTER TABLE public.owner_statements ADD COLUMN IF NOT EXISTS statement_currency text,
  ADD COLUMN IF NOT EXISTS converted_net_amount bigint,
  ADD COLUMN IF NOT EXISTS conversion_id uuid REFERENCES public.currency_conversions(id) ON DELETE SET NULL;
ALTER TABLE public.owner_payouts ADD COLUMN IF NOT EXISTS source_currency text,
  ADD COLUMN IF NOT EXISTS source_amount bigint,
  ADD COLUMN IF NOT EXISTS conversion_id uuid REFERENCES public.currency_conversions(id) ON DELETE SET NULL;