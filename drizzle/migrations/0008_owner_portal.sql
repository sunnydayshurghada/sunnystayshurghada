-- ============ profiles ============
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('super_admin','booking_manager','owner')),
  preferred_language TEXT NOT NULL DEFAULT 'de' CHECK (preferred_language IN ('de','en','ar')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  invitation_expires_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ============ assignments ============
CREATE TABLE IF NOT EXISTS public.property_user_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_role TEXT NOT NULL DEFAULT 'owner' CHECK (assignment_role IN ('owner','co_owner','manager')),
  ownership_share_percent NUMERIC(5,2),
  can_view_bookings BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_guest_contact_data BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_financials BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_payments BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_calendar BOOLEAN NOT NULL DEFAULT TRUE,
  can_create_calendar_blocks BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_prices BOOLEAN NOT NULL DEFAULT FALSE,
  can_receive_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, user_id)
);
GRANT SELECT ON public.property_user_assignments TO authenticated;
GRANT ALL ON public.property_user_assignments TO service_role;
ALTER TABLE public.property_user_assignments ENABLE ROW LEVEL SECURITY;

-- ============ audit log ============
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_email TEXT,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.security_audit_log TO authenticated;
GRANT ALL ON public.security_audit_log TO service_role;
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS security_audit_log_created_idx ON public.security_audit_log (created_at DESC);

-- ============ per-property financial settings ============
CREATE TABLE IF NOT EXISTS public.property_financial_settings (
  property_id UUID PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_fixed INTEGER NOT NULL DEFAULT 0,
  payment_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  cleaning_belongs_to_owner BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.property_financial_settings TO authenticated;
GRANT ALL ON public.property_financial_settings TO service_role;
ALTER TABLE public.property_financial_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.property_financial_settings (property_id)
  SELECT id FROM public.properties ON CONFLICT DO NOTHING;

-- ============ cancellation / refund bookkeeping on bookings ============
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS refund_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS financial_snapshot JSONB;

-- ============ helper functions (security definer, no RLS recursion) ============
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id
       AND role IN ('admin','super_admin','booking_manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_property_permission(_user_id UUID, _property_id UUID, _permission TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.property_user_assignments%ROWTYPE;
BEGIN
  IF _user_id IS NULL OR _property_id IS NULL THEN RETURN FALSE; END IF;
  IF public.is_staff(_user_id) THEN RETURN TRUE; END IF;
  SELECT * INTO a FROM public.property_user_assignments
    WHERE user_id = _user_id AND property_id = _property_id AND active;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = _user_id AND p.active) THEN
    RETURN FALSE;
  END IF;
  RETURN CASE _permission
    WHEN 'view' THEN TRUE
    WHEN 'bookings' THEN a.can_view_bookings
    WHEN 'guest_contact' THEN a.can_view_guest_contact_data
    WHEN 'financials' THEN a.can_view_financials
    WHEN 'payments' THEN a.can_view_payments
    WHEN 'calendar' THEN a.can_view_calendar
    WHEN 'blocks' THEN a.can_create_calendar_blocks
    WHEN 'prices' THEN a.can_manage_prices
    ELSE FALSE END;
END; $$;

GRANT EXECUTE ON FUNCTION public.is_staff(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_property_permission(UUID, UUID, TEXT) TO authenticated, anon, service_role;

-- ============ policies ============
CREATE POLICY "own profile readable" ON public.user_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "own profile updatable" ON public.user_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "assignments readable" ON public.property_user_assignments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "audit readable by staff" ON public.security_audit_log
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "financial settings readable" ON public.property_financial_settings
  FOR SELECT TO authenticated
  USING (public.has_property_permission(auth.uid(), property_id, 'financials'));

CREATE POLICY "assigned properties readable" ON public.properties
  FOR SELECT TO authenticated
  USING (public.has_property_permission(auth.uid(), id, 'view'));

CREATE POLICY "assigned bookings readable" ON public.bookings
  FOR SELECT TO authenticated
  USING (public.has_property_permission(auth.uid(), property_id, 'bookings'));

CREATE POLICY "assigned calendar readable" ON public.calendar_blocks
  FOR SELECT TO authenticated
  USING (public.has_property_permission(auth.uid(), property_id, 'calendar'));

CREATE POLICY "assigned calendar blocks insertable" ON public.calendar_blocks
  FOR INSERT TO authenticated
  WITH CHECK (public.has_property_permission(auth.uid(), property_id, 'blocks'));

CREATE POLICY "assigned payments readable" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (property_id IS NOT NULL AND public.has_property_permission(auth.uid(), property_id, 'payments'));

-- ============ triggers ============
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER property_user_assignments_updated_at BEFORE UPDATE ON public.property_user_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER property_financial_settings_updated_at BEFORE UPDATE ON public.property_financial_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS pua_user_idx ON public.property_user_assignments (user_id) WHERE active;
CREATE INDEX IF NOT EXISTS pua_property_idx ON public.property_user_assignments (property_id) WHERE active;