CREATE OR REPLACE FUNCTION public.is_active_property(_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.properties WHERE id = _property_id AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.is_portal_user(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(_uid)
    OR EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id = _uid AND active)
    OR EXISTS (SELECT 1 FROM public.property_user_assignments WHERE user_id = _uid AND active);
$$;

DROP POLICY "Public reads amenities" ON public.amenities;
CREATE POLICY "Public reads amenities of active properties" ON public.amenities
  FOR SELECT TO anon, authenticated USING (public.is_active_property(property_id));

DROP POLICY "Public reads daily prices" ON public.daily_prices;
CREATE POLICY "Public reads daily prices of active properties" ON public.daily_prices
  FOR SELECT TO anon, authenticated USING (public.is_active_property(property_id));

DROP POLICY "Public reads pricing settings" ON public.property_pricing_settings;
CREATE POLICY "Public reads pricing settings of active properties" ON public.property_pricing_settings
  FOR SELECT TO anon, authenticated USING (public.is_active_property(property_id));

DROP POLICY "Public reads property images" ON public.property_images;
CREATE POLICY "Public reads images of active properties" ON public.property_images
  FOR SELECT TO anon, authenticated USING (public.is_active_property(property_id));

DROP POLICY "catalog readable" ON public.service_catalog;
CREATE POLICY "Portal users read service catalog" ON public.service_catalog
  FOR SELECT TO authenticated USING (public.is_portal_user(auth.uid()));

DROP POLICY "Signed-in users read rates" ON public.exchange_rates;
CREATE POLICY "Portal users read rates" ON public.exchange_rates
  FOR SELECT TO authenticated USING (public.is_portal_user(auth.uid()));

DROP POLICY "Signed-in read task types" ON public.task_types;
CREATE POLICY "Staff read task types" ON public.task_types
  FOR SELECT TO authenticated USING (
    public.is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff_profiles WHERE user_id = auth.uid() AND active)
  );