-- ===================== permissions =====================
ALTER TABLE public.property_user_assignments ADD COLUMN IF NOT EXISTS can_view_service_agreement BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.property_user_assignments ADD COLUMN IF NOT EXISTS can_view_service_costs BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.property_user_assignments ADD COLUMN IF NOT EXISTS can_view_owner_statements BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.property_user_assignments ADD COLUMN IF NOT EXISTS can_view_receipts BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.property_user_assignments ADD COLUMN IF NOT EXISTS can_download_statements BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.property_user_assignments ADD COLUMN IF NOT EXISTS can_submit_financial_question BOOLEAN NOT NULL DEFAULT TRUE;

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
    WHEN 'service_agreement' THEN a.can_view_service_agreement
    WHEN 'service_costs' THEN a.can_view_service_costs
    WHEN 'statements' THEN a.can_view_owner_statements
    WHEN 'receipts' THEN a.can_view_receipts
    WHEN 'download_statements' THEN a.can_download_statements
    WHEN 'financial_question' THEN a.can_submit_financial_question
    ELSE FALSE END;
END; $$;

-- ===================== service catalogue =====================
CREATE TABLE IF NOT EXISTS public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  default_price INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  calculation_type TEXT NOT NULL DEFAULT 'per_booking'
    CHECK (calculation_type IN ('per_booking','per_stay','per_night','per_guest','per_cleaning','per_month','percent_revenue','percent_nightly','manual')),
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  default_cost_bearer TEXT NOT NULL DEFAULT 'owner'
    CHECK (default_cost_bearer IN ('guest','owner','sunny_stays','split')),
  publicly_visible BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_catalog TO authenticated;
GRANT ALL ON public.service_catalog TO service_role;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog readable" ON public.service_catalog FOR SELECT TO authenticated USING (TRUE);
CREATE TRIGGER service_catalog_updated_at BEFORE UPDATE ON public.service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===================== per-property agreed services =====================
CREATE TABLE IF NOT EXISTS public.property_service_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.service_catalog(id) ON DELETE CASCADE,
  provided_by_sunny_stays BOOLEAN NOT NULL DEFAULT TRUE,
  included_in_management_fee BOOLEAN NOT NULL DEFAULT FALSE,
  custom_price INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  calculation_type TEXT NOT NULL DEFAULT 'per_booking'
    CHECK (calculation_type IN ('per_booking','per_stay','per_night','per_guest','per_cleaning','per_month','percent_revenue','percent_nightly','manual')),
  cost_bearer TEXT NOT NULL DEFAULT 'owner' CHECK (cost_bearer IN ('guest','owner','sunny_stays','split')),
  automatic_charge BOOLEAN NOT NULL DEFAULT FALSE,
  visible_to_owner BOOLEAN NOT NULL DEFAULT TRUE,
  visible_to_guest BOOLEAN NOT NULL DEFAULT FALSE,
  valid_from DATE,
  valid_until DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, service_id)
);
GRANT SELECT ON public.property_service_agreements TO authenticated;
GRANT ALL ON public.property_service_agreements TO service_role;
ALTER TABLE public.property_service_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service agreements readable" ON public.property_service_agreements
  FOR SELECT TO authenticated
  USING (public.has_property_permission(auth.uid(), property_id, 'service_agreement'));
CREATE TRIGGER property_service_agreements_updated_at BEFORE UPDATE ON public.property_service_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===================== per-property management fee =====================
CREATE TABLE IF NOT EXISTS public.property_management_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL DEFAULT 'percent'
    CHECK (fee_type IN ('fixed_per_booking','fixed_monthly','percent','base_plus_percent','custom')),
  percentage_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  fixed_fee INTEGER NOT NULL DEFAULT 0,
  minimum_fee INTEGER NOT NULL DEFAULT 0,
  calculation_basis TEXT NOT NULL DEFAULT 'nightly'
    CHECK (calculation_basis IN ('nightly','nightly_plus_cleaning','total_revenue')),
  currency TEXT NOT NULL DEFAULT 'EUR',
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.property_management_agreements TO authenticated;
GRANT ALL ON public.property_management_agreements TO service_role;
ALTER TABLE public.property_management_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "management agreements readable" ON public.property_management_agreements
  FOR SELECT TO authenticated
  USING (public.has_property_permission(auth.uid(), property_id, 'service_agreement'));
CREATE TRIGGER property_management_agreements_updated_at BEFORE UPDATE ON public.property_management_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS pma_property_idx ON public.property_management_agreements (property_id, valid_from DESC);

INSERT INTO public.property_management_agreements (property_id, fee_type, percentage_rate, fixed_fee, calculation_basis, currency, notes)
SELECT p.id, 'percent', COALESCE(f.commission_percent, 0), COALESCE(f.commission_fixed, 0), 'nightly', p.currency,
       'Automatisch aus den bisherigen Finanzeinstellungen uebernommen'
  FROM public.properties p
  LEFT JOIN public.property_financial_settings f ON f.property_id = p.id
 WHERE NOT EXISTS (SELECT 1 FROM public.property_management_agreements m WHERE m.property_id = p.id);

-- ===================== booking service items =====================
CREATE TABLE IF NOT EXISTS public.booking_service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  description_snapshot TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  total_price INTEGER NOT NULL DEFAULT 0,
  actual_cost INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  cost_bearer TEXT NOT NULL DEFAULT 'owner' CHECK (cost_bearer IN ('guest','owner','sunny_stays','split')),
  included_in_management_fee BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','cancelled')),
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.booking_service_items TO authenticated;
GRANT ALL ON public.booking_service_items TO service_role;
ALTER TABLE public.booking_service_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booking services readable" ON public.booking_service_items
  FOR SELECT TO authenticated
  USING (public.has_property_permission(auth.uid(), property_id, 'service_costs'));
CREATE TRIGGER booking_service_items_updated_at BEFORE UPDATE ON public.booking_service_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS bsi_booking_idx ON public.booking_service_items (booking_id);
CREATE INDEX IF NOT EXISTS bsi_property_idx ON public.booking_service_items (property_id, created_at DESC);

-- ===================== booking financial items (ledger) =====================
CREATE TABLE IF NOT EXISTS public.booking_financial_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  source_currency TEXT,
  source_amount INTEGER,
  exchange_rate NUMERIC(14,6),
  exchange_rate_at TIMESTAMPTZ,
  direction TEXT NOT NULL DEFAULT 'debit' CHECK (direction IN ('credit','debit')),
  charged_to TEXT NOT NULL DEFAULT 'owner' CHECK (charged_to IN ('guest','owner','sunny_stays','split')),
  source TEXT NOT NULL DEFAULT 'system',
  reason TEXT,
  immutable_snapshot BOOLEAN NOT NULL DEFAULT FALSE,
  statement_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.booking_financial_items TO authenticated;
GRANT ALL ON public.booking_financial_items TO service_role;
ALTER TABLE public.booking_financial_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financial items readable" ON public.booking_financial_items
  FOR SELECT TO authenticated
  USING (public.has_property_permission(auth.uid(), property_id, 'financials'));
CREATE INDEX IF NOT EXISTS bfi_property_idx ON public.booking_financial_items (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bfi_booking_idx ON public.booking_financial_items (booking_id);

-- ===================== owner statements =====================
CREATE TABLE IF NOT EXISTS public.owner_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_booking_revenue INTEGER NOT NULL DEFAULT 0,
  guest_fees INTEGER NOT NULL DEFAULT 0,
  platform_fees INTEGER NOT NULL DEFAULT 0,
  payment_fees INTEGER NOT NULL DEFAULT 0,
  management_fees INTEGER NOT NULL DEFAULT 0,
  service_costs INTEGER NOT NULL DEFAULT 0,
  refunds INTEGER NOT NULL DEFAULT 0,
  adjustments INTEGER NOT NULL DEFAULT 0,
  owner_net_amount INTEGER NOT NULL DEFAULT 0,
  paid_out_amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_review','approved','paid','corrected')),
  finalized_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.owner_statements TO authenticated;
GRANT ALL ON public.owner_statements TO service_role;
ALTER TABLE public.owner_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "statements readable" ON public.owner_statements
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR (owner_user_id = auth.uid()
        AND property_id IS NOT NULL
        AND public.has_property_permission(auth.uid(), property_id, 'statements'))
  );
CREATE TRIGGER owner_statements_updated_at BEFORE UPDATE ON public.owner_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE UNIQUE INDEX IF NOT EXISTS owner_statements_period_idx
  ON public.owner_statements (owner_user_id, property_id, period_start, period_end);

-- ===================== payouts =====================
CREATE TABLE IF NOT EXISTS public.owner_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID REFERENCES public.owner_statements(id) ON DELETE SET NULL,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  period_start DATE,
  period_end DATE,
  amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  method TEXT,
  transaction_reference TEXT,
  paid_on DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed','cancelled')),
  internal_note TEXT,
  receipt_url TEXT,
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.owner_payouts TO authenticated;
GRANT ALL ON public.owner_payouts TO service_role;
ALTER TABLE public.owner_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts readable" ON public.owner_payouts
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR (owner_user_id = auth.uid()
        AND property_id IS NOT NULL
        AND public.has_property_permission(auth.uid(), property_id, 'statements'))
  );
CREATE TRIGGER owner_payouts_updated_at BEFORE UPDATE ON public.owner_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===================== receipts =====================
CREATE TABLE IF NOT EXISTS public.cost_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  service_item_id UUID REFERENCES public.booking_service_items(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES public.owner_statements(id) ON DELETE SET NULL,
  receipt_type TEXT NOT NULL DEFAULT 'other'
    CHECK (receipt_type IN ('cleaning','laundry','repair','material','transfer','other')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  amount INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  note TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cost_receipts TO authenticated;
GRANT ALL ON public.cost_receipts TO service_role;
ALTER TABLE public.cost_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipts readable" ON public.cost_receipts
  FOR SELECT TO authenticated
  USING (public.has_property_permission(auth.uid(), property_id, 'receipts'));

-- ===================== owner questions =====================
CREATE TABLE IF NOT EXISTS public.owner_financial_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES public.owner_statements(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  answer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.owner_financial_questions TO authenticated;
GRANT ALL ON public.owner_financial_questions TO service_role;
ALTER TABLE public.owner_financial_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions readable" ON public.owner_financial_questions
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR owner_user_id = auth.uid());
CREATE TRIGGER owner_financial_questions_updated_at BEFORE UPDATE ON public.owner_financial_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===================== seed catalogue =====================
INSERT INTO public.service_catalog (key, name, category, calculation_type, default_cost_bearer, sort_order) VALUES
  ('listing_creation','{"de":"Inseratserstellung","en":"Listing creation","ar":"إنشاء الإعلان"}','listing','manual','owner',10),
  ('listing_maintenance','{"de":"Inseratspflege","en":"Listing maintenance","ar":"صيانة الإعلان"}','listing','per_month','owner',20),
  ('price_management','{"de":"Preisverwaltung","en":"Price management","ar":"إدارة الأسعار"}','management','per_month','owner',30),
  ('dynamic_pricing','{"de":"Dynamic Pricing","en":"Dynamic pricing","ar":"التسعير الديناميكي"}','management','per_month','owner',40),
  ('inquiry_handling','{"de":"Bearbeitung von Buchungsanfragen","en":"Booking inquiry handling","ar":"معالجة طلبات الحجز"}','management','per_booking','owner',50),
  ('guest_communication','{"de":"Gästekommunikation","en":"Guest communication","ar":"التواصل مع الضيوف"}','management','per_booking','owner',60),
  ('reservation_management','{"de":"Reservierungsverwaltung","en":"Reservation management","ar":"إدارة الحجوزات"}','management','per_booking','owner',70),
  ('payment_processing','{"de":"Zahlungsabwicklung","en":"Payment processing","ar":"معالجة الدفع"}','management','percent_revenue','owner',80),
  ('personal_checkin','{"de":"Persönlicher Empfang / Check-in","en":"Personal welcome / check-in","ar":"استقبال شخصي"}','guest_service','per_booking','owner',90),
  ('late_checkin','{"de":"Später Check-in","en":"Late check-in","ar":"تسجيل وصول متأخر"}','guest_service','per_booking','guest',100),
  ('checkout','{"de":"Check-out","en":"Check-out","ar":"تسجيل المغادرة"}','guest_service','per_booking','owner',110),
  ('key_handover','{"de":"Schlüsselübergabe","en":"Key handover","ar":"تسليم المفاتيح"}','guest_service','per_booking','owner',120),
  ('final_cleaning','{"de":"Endreinigung","en":"Final cleaning","ar":"التنظيف النهائي"}','cleaning','per_cleaning','guest',130),
  ('interim_cleaning','{"de":"Zwischenreinigung","en":"Interim cleaning","ar":"تنظيف بيني"}','cleaning','per_cleaning','owner',140),
  ('laundry_change','{"de":"Wäschewechsel","en":"Laundry change","ar":"تغيير المفروشات"}','cleaning','per_booking','owner',150),
  ('towel_service','{"de":"Handtuchservice","en":"Towel service","ar":"خدمة المناشف"}','cleaning','per_booking','owner',160),
  ('bed_linen','{"de":"Bettwäsche","en":"Bed linen","ar":"مفارش السرير"}','cleaning','per_booking','owner',170),
  ('consumables','{"de":"Verbrauchsmaterialien","en":"Consumables","ar":"المستهلكات"}','supplies','per_booking','owner',180),
  ('welcome_package','{"de":"Willkommenspaket","en":"Welcome package","ar":"حزمة ترحيب"}','guest_service','per_booking','owner',190),
  ('damage_check','{"de":"Schadenskontrolle","en":"Damage check","ar":"فحص الأضرار"}','maintenance','per_booking','owner',200),
  ('repair_organisation','{"de":"Organisation von Reparaturen","en":"Repair organisation","ar":"تنظيم الإصلاحات"}','maintenance','manual','owner',210),
  ('contractor_coordination','{"de":"Handwerkerkoordination","en":"Contractor coordination","ar":"تنسيق الحرفيين"}','maintenance','manual','owner',220),
  ('emergency_support','{"de":"Notfallbetreuung","en":"Emergency support","ar":"دعم الطوارئ"}','guest_service','per_month','owner',230),
  ('airport_transfer','{"de":"Flughafentransfer","en":"Airport transfer","ar":"النقل من المطار"}','guest_service','per_booking','guest',240),
  ('official_registration','{"de":"Behördliche Meldungen","en":"Official registrations","ar":"التسجيلات الرسمية"}','admin','per_booking','owner',250),
  ('custom_service','{"de":"Sonstige individuelle Leistung","en":"Other individual service","ar":"خدمة أخرى"}','other','manual','owner',260)
ON CONFLICT (key) DO NOTHING;