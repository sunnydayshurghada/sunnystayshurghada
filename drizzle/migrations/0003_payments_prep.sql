-- Additive preparation for future online booking + payments. No behaviour change for the
-- existing inquiry flow: public.bookings.status stays the source of truth for it.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_type TEXT NOT NULL DEFAULT 'inquiry',
  ADD COLUMN IF NOT EXISTS booking_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS nightly_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleaning_fee INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_snapshot JSONB;

COMMENT ON COLUMN public.bookings.nightly_total IS 'Minor currency units (integer cents/piastres). Never floats.';
COMMENT ON COLUMN public.bookings.price_snapshot IS 'JSON array of actually booked nightly prices, e.g. [{"date":"2027-01-01","amount":4000}].';

-- Backfill the new status mirror from the existing inquiry status.
UPDATE public.bookings
   SET booking_status = CASE status
         WHEN 'confirmed' THEN 'confirmed'
         WHEN 'rejected'  THEN 'declined'
         WHEN 'cancelled' THEN 'cancelled'
         ELSE 'pending' END,
       confirmed_at = CASE WHEN status = 'confirmed' THEN updated_at ELSE confirmed_at END,
       cancelled_at = CASE WHEN status = 'cancelled' THEN updated_at ELSE cancelled_at END;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_booking_type_chk CHECK (booking_type IN ('inquiry','manual','instant')) NOT VALID,
  ADD CONSTRAINT bookings_booking_status_chk CHECK (booking_status IN ('pending','payment_pending','confirmed','declined','cancelled','expired')) NOT VALID,
  ADD CONSTRAINT bookings_payment_status_chk CHECK (payment_status IN ('unpaid','pending','paid','failed','partially_refunded','refunded')) NOT VALID,
  ADD CONSTRAINT bookings_payment_provider_chk CHECK (payment_provider IS NULL OR payment_provider IN ('paymob','paypal','manual')) NOT VALID,
  ADD CONSTRAINT bookings_payment_method_chk CHECK (payment_method IS NULL OR payment_method IN ('card','vodafone_cash','mobile_wallet','paypal')) NOT VALID,
  ADD CONSTRAINT bookings_amounts_nonneg_chk CHECK (
    nightly_total >= 0 AND cleaning_fee >= 0 AND discount_amount >= 0
    AND total_amount >= 0 AND deposit_amount >= 0 AND amount_paid >= 0) NOT VALID;

ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_booking_type_chk;
ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_booking_status_chk;
ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_payment_status_chk;
ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_payment_provider_chk;
ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_payment_method_chk;
ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_amounts_nonneg_chk;

CREATE INDEX IF NOT EXISTS bookings_hold_idx ON public.bookings (payment_expires_at)
  WHERE booking_status = 'payment_pending';
CREATE UNIQUE INDEX IF NOT EXISTS bookings_payment_txn_idx ON public.bookings (payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;

-- Booking/payment configuration, server-side only (no secrets here; keys live in the secret store).
CREATE TABLE IF NOT EXISTS public.booking_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  auto_confirm_direct_bookings BOOLEAN NOT NULL DEFAULT FALSE,
  payments_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_mode TEXT NOT NULL DEFAULT 'full' CHECK (payment_mode IN ('full','deposit_percent','deposit_fixed','on_arrival')),
  deposit_percent INTEGER NOT NULL DEFAULT 0 CHECK (deposit_percent BETWEEN 0 AND 100),
  deposit_fixed_amount INTEGER NOT NULL DEFAULT 0 CHECK (deposit_fixed_amount >= 0),
  hold_minutes INTEGER NOT NULL DEFAULT 15 CHECK (hold_minutes BETWEEN 1 AND 120),
  nightly_rate INTEGER NOT NULL DEFAULT 0 CHECK (nightly_rate >= 0),
  cleaning_fee INTEGER NOT NULL DEFAULT 0 CHECK (cleaning_fee >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.booking_settings TO service_role;
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read booking settings" ON public.booking_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.booking_settings TO authenticated;

INSERT INTO public.booking_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- Payment attempts / webhook audit trail (server-side only).
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('paymob','paypal','manual')),
  method TEXT CHECK (method IS NULL OR method IN ('card','vodafone_cash','mobile_wallet','paypal')),
  provider_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded','partially_refunded')),
  amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  raw_payload JSONB,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read payment transactions" ON public.payment_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.payment_transactions TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_txn_idx
  ON public.payment_transactions (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_transactions_booking_idx ON public.payment_transactions (booking_id);

CREATE TRIGGER booking_settings_updated_at BEFORE UPDATE ON public.booking_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER payment_transactions_updated_at BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Availability now also respects live payment holds (expired holds free themselves: the
-- predicate is time-based, so no sweeper job is needed).
CREATE OR REPLACE FUNCTION public.check_availability(_checkin date, _checkout date)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE status = 'confirmed'
      AND daterange(checkin, checkout, '[)') && daterange(_checkin, _checkout, '[)')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE booking_status = 'payment_pending'
      AND payment_expires_at IS NOT NULL AND payment_expires_at > now()
      AND daterange(checkin, checkout, '[)') && daterange(_checkin, _checkout, '[)')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.calendar_blocks
    WHERE daterange(start_date, end_date, '[)') && daterange(_checkin, _checkout, '[)')
  );
$$;

CREATE OR REPLACE FUNCTION public.public_blocked_ranges()
RETURNS TABLE(start_date date, end_date date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT b.checkin, b.checkout FROM public.bookings b
    WHERE b.status = 'confirmed' AND b.checkout >= CURRENT_DATE
  UNION ALL
  SELECT b.checkin, b.checkout FROM public.bookings b
    WHERE b.booking_status = 'payment_pending'
      AND b.payment_expires_at IS NOT NULL AND b.payment_expires_at > now()
      AND b.checkout >= CURRENT_DATE
  UNION ALL
  SELECT c.start_date, c.end_date FROM public.calendar_blocks c
    WHERE c.end_date >= CURRENT_DATE;
$$;

-- Marks lapsed holds as expired. Called lazily before payment/confirmation, not on a timer.
CREATE OR REPLACE FUNCTION public.release_expired_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE public.bookings
     SET booking_status = 'expired',
         payment_status = CASE WHEN payment_status = 'pending' THEN 'failed' ELSE payment_status END,
         status = CASE WHEN status = 'pending' THEN 'cancelled' ELSE status END,
         cancelled_at = COALESCE(cancelled_at, now())
   WHERE booking_status = 'payment_pending'
     AND payment_expires_at IS NOT NULL
     AND payment_expires_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

REVOKE ALL ON FUNCTION public.release_expired_holds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_expired_holds() TO service_role;