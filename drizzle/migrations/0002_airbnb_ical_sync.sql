-- Additive columns for externally synced (Airbnb) calendar entries
ALTER TABLE public.calendar_blocks
  ADD COLUMN IF NOT EXISTS external_uid TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS calendar_blocks_external_uid_key
  ON public.calendar_blocks (external_uid) WHERE external_uid IS NOT NULL;

-- Externally imported ranges are the source of truth and may overlap
CREATE OR REPLACE FUNCTION public.calendar_blocks_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.external_uid IS NOT NULL THEN
    RETURN NEW;
  END IF;
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
END; $function$;

-- Server-only settings for the iCal sync (no RLS policies: service role only)
CREATE TABLE IF NOT EXISTS public.ical_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  airbnb_ical_url TEXT,
  export_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  cron_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  last_sync_imported INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.ical_settings TO service_role;
ALTER TABLE public.ical_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ical_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL,
  imported INTEGER NOT NULL DEFAULT 0,
  removed INTEGER NOT NULL DEFAULT 0,
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  message TEXT
);

CREATE INDEX IF NOT EXISTS ical_sync_log_ran_at_idx ON public.ical_sync_log (ran_at DESC);
GRANT ALL ON public.ical_sync_log TO service_role;
ALTER TABLE public.ical_sync_log ENABLE ROW LEVEL SECURITY;

INSERT INTO public.ical_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;