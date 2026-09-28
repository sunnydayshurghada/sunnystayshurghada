CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lead_user_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  phone text,
  preferred_language text NOT NULL DEFAULT 'de' CHECK (preferred_language IN ('de','en','ar')),
  staff_type text NOT NULL DEFAULT 'staff' CHECK (staff_type IN ('team_lead','staff','contractor')),
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  available boolean NOT NULL DEFAULT true,
  default_hourly_rate integer,
  default_fixed_rate integer,
  currency text NOT NULL DEFAULT 'EGP' CHECK (currency IN ('EGP','EUR','USD')),
  notes text,
  can_view_team_tasks boolean NOT NULL DEFAULT false,
  can_view_guest_contact boolean NOT NULL DEFAULT false,
  invited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_property_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);

CREATE TABLE public.task_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name jsonb NOT NULL,
  category text NOT NULL DEFAULT 'general',
  default_duration_minutes integer NOT NULL DEFAULT 60,
  requires_photos boolean NOT NULL DEFAULT false,
  requires_checklist boolean NOT NULL DEFAULT false,
  guest_contact_allowed boolean NOT NULL DEFAULT false,
  materials text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_task_type_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_type_id uuid NOT NULL REFERENCES public.task_types(id) ON DELETE CASCADE,
  UNIQUE (user_id, task_type_id)
);

CREATE TABLE public.task_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type_id uuid NOT NULL REFERENCES public.task_types(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  label jsonb NOT NULL,
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.task_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  task_type_id uuid NOT NULL REFERENCES public.task_types(id) ON DELETE CASCADE,
  anchor text NOT NULL CHECK (anchor IN ('checkin','checkout')),
  offset_minutes integer NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'normal',
  default_assignee uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, task_type_id, anchor)
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  calendar_block_id uuid,
  service_item_id uuid REFERENCES public.booking_service_items(id) ON DELETE SET NULL,
  task_type_id uuid NOT NULL REFERENCES public.task_types(id),
  automation_key text,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'unassigned' CHECK (status IN ('unassigned','assigned','accepted','declined','on_the_way','started','paused','done','approved','rework','cancelled','overdue')),
  assigned_user_id uuid,
  assigned_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  team_visible boolean NOT NULL DEFAULT false,
  scheduled_date date,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid,
  cancellation_reason text,
  internal_notes text,
  employee_notes text,
  owner_visible_notes text,
  requires_photos boolean NOT NULL DEFAULT false,
  requires_checklist boolean NOT NULL DEFAULT false,
  estimated_cost integer,
  actual_cost integer,
  currency text NOT NULL DEFAULT 'EGP' CHECK (currency IN ('EGP','EUR','USD')),
  worked_minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX tasks_booking_auto_uniq ON public.tasks (booking_id, automation_key) WHERE booking_id IS NOT NULL AND automation_key IS NOT NULL;
CREATE UNIQUE INDEX tasks_block_auto_uniq ON public.tasks (calendar_block_id, automation_key) WHERE calendar_block_id IS NOT NULL AND automation_key IS NOT NULL;
CREATE INDEX tasks_assignee_idx ON public.tasks (assigned_user_id, scheduled_start);
CREATE INDEX tasks_property_idx ON public.tasks (property_id, scheduled_start);

CREATE TABLE public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  done boolean NOT NULL DEFAULT false,
  done_by uuid,
  done_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.task_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.task_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'work' CHECK (kind IN ('work','pause')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  corrected_minutes integer,
  correction_reason text,
  corrected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by uuid,
  file_path text NOT NULL,
  file_type text,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('before','after','damage','receipt','invoice','other')),
  description text,
  visibility text NOT NULL DEFAULT 'staff' CHECK (visibility IN ('admin','staff','owner')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.task_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- helper functions
CREATE OR REPLACE FUNCTION public.is_task_manager(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(_uid) OR EXISTS (
    SELECT 1 FROM public.staff_profiles WHERE user_id = _uid AND active AND staff_type = 'team_lead');
$$;

CREATE OR REPLACE FUNCTION public.can_view_task(_uid uuid, _task_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(_uid) OR EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.staff_profiles s ON s.user_id = _uid AND s.active
    WHERE t.id = _task_id AND (
      t.assigned_user_id = _uid
      OR (s.staff_type = 'team_lead' AND t.assigned_team_id IS NOT NULL AND t.assigned_team_id = s.team_id)
      OR (s.staff_type = 'staff' AND s.can_view_team_tasks AND t.team_visible AND t.assigned_team_id = s.team_id)
    ));
$$;

-- grants
GRANT SELECT ON public.teams, public.staff_profiles, public.staff_property_assignments, public.task_types,
  public.staff_task_type_assignments, public.task_checklist_templates, public.task_automation_rules,
  public.tasks, public.task_checklist_items, public.task_status_history, public.task_time_entries,
  public.task_attachments, public.task_audit_log TO authenticated;
GRANT ALL ON public.teams, public.staff_profiles, public.staff_property_assignments, public.task_types,
  public.staff_task_type_assignments, public.task_checklist_templates, public.task_automation_rules,
  public.tasks, public.task_checklist_items, public.task_status_history, public.task_time_entries,
  public.task_attachments, public.task_audit_log TO service_role;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_property_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_task_type_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_audit_log ENABLE ROW LEVEL SECURITY;

-- read policies; all writes go through verified server functions
CREATE POLICY "Managers read teams" ON public.teams FOR SELECT TO authenticated
  USING (public.is_task_manager(auth.uid()) OR id IN (SELECT team_id FROM public.staff_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Self or managers read staff" ON public.staff_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_task_manager(auth.uid()));
CREATE POLICY "Self or admins read property assignments" ON public.staff_property_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_task_manager(auth.uid()));
CREATE POLICY "Signed-in read task types" ON public.task_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Self or admins read type assignments" ON public.staff_task_type_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_task_manager(auth.uid()));
CREATE POLICY "Managers read checklist templates" ON public.task_checklist_templates FOR SELECT TO authenticated
  USING (public.is_task_manager(auth.uid()));
CREATE POLICY "Admins read automation" ON public.task_automation_rules FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Visible tasks" ON public.tasks FOR SELECT TO authenticated
  USING (public.can_view_task(auth.uid(), id));
CREATE POLICY "Visible checklist" ON public.task_checklist_items FOR SELECT TO authenticated
  USING (public.can_view_task(auth.uid(), task_id));
CREATE POLICY "Visible history" ON public.task_status_history FOR SELECT TO authenticated
  USING (public.can_view_task(auth.uid(), task_id));
CREATE POLICY "Visible time" ON public.task_time_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_task_manager(auth.uid()));
CREATE POLICY "Visible attachments" ON public.task_attachments FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR (visibility IN ('staff','owner') AND public.can_view_task(auth.uid(), task_id)));
CREATE POLICY "Admins read task audit" ON public.task_audit_log FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER staff_profiles_updated BEFORE UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER task_types_updated BEFORE UPDATE ON public.task_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER task_automation_updated BEFORE UPDATE ON public.task_automation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- standard catalogue
INSERT INTO public.task_types (key, name, category, default_duration_minutes, requires_photos, requires_checklist, guest_contact_allowed, sort_order) VALUES
('checkin_prep','{"de":"Check-in vorbereiten","en":"Prepare check-in","ar":"تجهيز تسجيل الوصول"}','arrival',60,false,false,false,1),
('reception','{"de":"Persönlicher Empfang","en":"Personal welcome","ar":"استقبال شخصي"}','arrival',45,false,false,true,2),
('key_handover','{"de":"Schlüsselübergabe","en":"Key handover","ar":"تسليم المفاتيح"}','arrival',20,false,false,true,3),
('late_checkin','{"de":"Später Check-in","en":"Late check-in","ar":"تسجيل وصول متأخر"}','arrival',45,false,false,true,4),
('checkout','{"de":"Check-out","en":"Check-out","ar":"تسجيل المغادرة"}','departure',30,false,false,true,5),
('final_cleaning','{"de":"Endreinigung","en":"Final cleaning","ar":"التنظيف النهائي"}','cleaning',180,true,true,false,6),
('interim_cleaning','{"de":"Zwischenreinigung","en":"Interim cleaning","ar":"تنظيف أثناء الإقامة"}','cleaning',90,false,false,false,7),
('linen_change','{"de":"Bettwäsche wechseln","en":"Change bed linen","ar":"تغيير أغطية السرير"}','cleaning',30,false,false,false,8),
('towel_change','{"de":"Handtücher wechseln","en":"Change towels","ar":"تغيير المناشف"}','cleaning',15,false,false,false,9),
('restock','{"de":"Verbrauchsmaterialien auffüllen","en":"Restock supplies","ar":"تزويد المستلزمات"}','cleaning',20,false,false,false,10),
('welcome_pack','{"de":"Willkommenspaket bereitstellen","en":"Provide welcome pack","ar":"تجهيز هدية الترحيب"}','arrival',15,false,false,false,11),
('pre_arrival_check','{"de":"Kontrolle vor Anreise","en":"Pre-arrival inspection","ar":"فحص قبل الوصول"}','inspection',30,true,true,false,12),
('post_departure_check','{"de":"Kontrolle nach Abreise","en":"Post-departure inspection","ar":"فحص بعد المغادرة"}','inspection',30,true,true,false,13),
('damage_check','{"de":"Schadenskontrolle","en":"Damage inspection","ar":"فحص الأضرار"}','inspection',30,true,false,false,14),
('repair','{"de":"Reparatur","en":"Repair","ar":"إصلاح"}','maintenance',120,true,false,false,15),
('tradesman','{"de":"Handwerkertermin","en":"Tradesman appointment","ar":"موعد فني"}','maintenance',120,false,false,false,16),
('ac_service','{"de":"Klimaanlagenwartung","en":"Air-conditioning service","ar":"صيانة التكييف"}','maintenance',90,true,false,false,17),
('meter_reading','{"de":"Zählerstand erfassen","en":"Record meter reading","ar":"تسجيل قراءة العداد"}','maintenance',10,true,false,false,18),
('onsite_payment','{"de":"Zahlung vor Ort","en":"On-site payment","ar":"الدفع في الموقع"}','guest',15,false,false,true,19),
('airport_transfer','{"de":"Flughafentransfer","en":"Airport transfer","ar":"نقل من/إلى المطار"}','guest',90,false,false,true,20),
('guest_request','{"de":"Gästemeldung bearbeiten","en":"Handle guest request","ar":"معالجة طلب ضيف"}','guest',30,false,false,true,21),
('emergency','{"de":"Notfall","en":"Emergency","ar":"طوارئ"}','maintenance',60,true,false,true,22),
('other','{"de":"Sonstige Aufgabe","en":"Other task","ar":"مهمة أخرى"}','general',60,false,false,false,23);

INSERT INTO public.task_checklist_templates (task_type_id, label, required, sort_order)
SELECT t.id, x.label::jsonb, x.req, x.ord FROM public.task_types t,
(VALUES
 ('{"de":"Bettwäsche gewechselt","en":"Bed linen changed","ar":"تم تغيير أغطية السرير"}',true,1),
 ('{"de":"Handtücher gewechselt","en":"Towels changed","ar":"تم تغيير المناشف"}',true,2),
 ('{"de":"Badezimmer gereinigt","en":"Bathroom cleaned","ar":"تم تنظيف الحمام"}',true,3),
 ('{"de":"Küche gereinigt","en":"Kitchen cleaned","ar":"تم تنظيف المطبخ"}',true,4),
 ('{"de":"Kühlschrank kontrolliert","en":"Fridge checked","ar":"تم فحص الثلاجة"}',false,5),
 ('{"de":"Böden gereinigt","en":"Floors cleaned","ar":"تم تنظيف الأرضيات"}',true,6),
 ('{"de":"Balkone kontrolliert","en":"Balconies checked","ar":"تم فحص الشرفات"}',false,7),
 ('{"de":"Müll entsorgt","en":"Rubbish removed","ar":"تم التخلص من القمامة"}',true,8),
 ('{"de":"Verbrauchsmaterialien aufgefüllt","en":"Supplies restocked","ar":"تم تزويد المستلزمات"}',false,9),
 ('{"de":"Klimaanlagen kontrolliert","en":"Air-conditioners checked","ar":"تم فحص المكيفات"}',false,10),
 ('{"de":"Wasser kontrolliert","en":"Water checked","ar":"تم فحص المياه"}',false,11),
 ('{"de":"Stromguthaben kontrolliert","en":"Electricity credit checked","ar":"تم فحص رصيد الكهرباء"}',false,12),
 ('{"de":"Schäden dokumentiert","en":"Damage documented","ar":"تم توثيق الأضرار"}',false,13),
 ('{"de":"Abschlussfotos hochgeladen","en":"Final photos uploaded","ar":"تم رفع الصور النهائية"}',true,14),
 ('{"de":"Wohnung verschlossen","en":"Apartment locked","ar":"تم إغلاق الشقة"}',true,15)
) AS x(label, req, ord) WHERE t.key = 'final_cleaning';

INSERT INTO public.task_checklist_templates (task_type_id, label, required, sort_order)
SELECT t.id, x.label::jsonb, x.req, x.ord FROM public.task_types t,
(VALUES
 ('{"de":"Wohnung sauber und vollständig","en":"Apartment clean and complete","ar":"الشقة نظيفة ومكتملة"}',true,1),
 ('{"de":"Klimaanlagen funktionieren","en":"Air-conditioners working","ar":"المكيفات تعمل"}',true,2),
 ('{"de":"Stromguthaben ausreichend","en":"Electricity credit sufficient","ar":"رصيد الكهرباء كافٍ"}',true,3),
 ('{"de":"WLAN funktioniert","en":"Wi-Fi working","ar":"الواي فاي يعمل"}',false,4),
 ('{"de":"Schlüssel bereit","en":"Keys ready","ar":"المفاتيح جاهزة"}',true,5)
) AS x(label, req, ord) WHERE t.key IN ('pre_arrival_check','checkin_prep');

INSERT INTO public.task_checklist_templates (task_type_id, label, required, sort_order)
SELECT t.id, x.label::jsonb, x.req, x.ord FROM public.task_types t,
(VALUES
 ('{"de":"Schlüssel zurückerhalten","en":"Keys returned","ar":"تم استلام المفاتيح"}',true,1),
 ('{"de":"Schäden geprüft","en":"Damage checked","ar":"تم فحص الأضرار"}',true,2),
 ('{"de":"Zählerstand notiert","en":"Meter reading noted","ar":"تم تسجيل العداد"}',false,3)
) AS x(label, req, ord) WHERE t.key IN ('checkout','post_departure_check');

-- default automation for every property (configurable per property)
INSERT INTO public.task_automation_rules (property_id, task_type_id, anchor, offset_minutes, priority)
SELECT p.id, t.id, r.anchor, r.off, r.prio FROM public.properties p
CROSS JOIN (VALUES
  ('checkin_prep','checkin',-1440,'normal'),
  ('reception','checkin',0,'high'),
  ('checkout','checkout',0,'normal'),
  ('final_cleaning','checkout',30,'high'),
  ('post_departure_check','checkout',240,'normal')
) AS r(key, anchor, off, prio)
JOIN public.task_types t ON t.key = r.key
ON CONFLICT DO NOTHING;