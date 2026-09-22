-- Per-property notification recipients (owners / responsible people)
CREATE TABLE public.property_notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_role TEXT NOT NULL DEFAULT 'owner',
  receive_new_inquiries BOOLEAN NOT NULL DEFAULT TRUE,
  receive_confirmed_bookings BOOLEAN NOT NULL DEFAULT TRUE,
  receive_payments BOOLEAN NOT NULL DEFAULT FALSE,
  receive_cancellations BOOLEAN NOT NULL DEFAULT TRUE,
  receive_booking_changes BOOLEAN NOT NULL DEFAULT TRUE,
  receive_calendar_errors BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, recipient_email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_notification_recipients TO authenticated;
GRANT ALL ON public.property_notification_recipients TO service_role;
ALTER TABLE public.property_notification_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage notification recipients"
  ON public.property_notification_recipients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER property_notification_recipients_updated_at
  BEFORE UPDATE ON public.property_notification_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Editable guest email templates. property_id NULL = central Sunny Stays default.
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'de',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_templates_property_key_lang_idx
  ON public.email_templates (COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid), template_key, language);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email templates"
  ON public.email_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-property email personalisation used by the templates
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS email_from_name TEXT,
  ADD COLUMN IF NOT EXISTS arrival_instructions TEXT,
  ADD COLUMN IF NOT EXISTS departure_instructions TEXT,
  ADD COLUMN IF NOT EXISTS house_rules TEXT,
  ADD COLUMN IF NOT EXISTS host_contact TEXT,
  ADD COLUMN IF NOT EXISTS email_signature TEXT;

-- Language the guest used on the website, stored with the booking
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_language TEXT NOT NULL DEFAULT 'de';

-- Delivery log details
ALTER TABLE public.email_notifications
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'guest',
  ADD COLUMN IF NOT EXISTS message_id TEXT,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subject TEXT;

CREATE INDEX IF NOT EXISTS email_notifications_property_idx
  ON public.email_notifications (property_id, created_at DESC);