import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createPublicSupabase } from "@/lib/availability.functions";
import {
  eachDate,
  loadPricingContext,
  priceCalendar,
  quoteStay,
  type NightPrice,
  type PricingSettings,
  type PricingRule,
  type StayQuote,
} from "@/lib/pricing.server";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function isAdmin(db: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !error && data !== null;
}

async function resolvePropertyId(
  db: SupabaseClient<Database>,
  propertyId: string | null | undefined,
): Promise<string | null> {
  if (propertyId) return propertyId;
  const { data } = await db
    .from("properties")
    .select("id")
    .eq("status", "active")
    .order("sort_order")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function logChange(
  db: SupabaseClient<Database>,
  propertyId: string,
  actorId: string,
  actorEmail: string | null,
  action: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await db.from("pricing_audit_log").insert({
    property_id: propertyId,
    actor_id: actorId,
    actor_email: actorEmail,
    action,
    detail: detail as never,
  });
}

/* ---------------------------------- public --------------------------------- */

/** Nightly prices for a window — read-only, used by the public calendar. */
export const getPriceCalendar = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({ propertyId: z.string().uuid().nullish(), from: dateStr, to: dateStr })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ currency: string; nights: NightPrice[] }> => {
    const db = createPublicSupabase();
    const propertyId = await resolvePropertyId(db, data.propertyId);
    if (!propertyId) return { currency: "EUR", nights: [] };
    const ctx = await loadPricingContext(db, propertyId, data.from, data.to);
    if (!ctx) return { currency: "EUR", nights: [] };
    return { currency: ctx.settings.currency, nights: priceCalendar(ctx, data.from, data.to) };
  });

/** Transparent breakdown for a chosen stay. Recomputed server-side before booking. */
export const getStayQuote = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        propertyId: z.string().uuid().nullish(),
        checkin: dateStr,
        checkout: dateStr,
        guests: z.number().int().min(1).max(20).default(2),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<StayQuote | null> => {
    const db = createPublicSupabase();
    const propertyId = await resolvePropertyId(db, data.propertyId);
    if (!propertyId || data.checkout <= data.checkin) return null;
    const ctx = await loadPricingContext(db, propertyId, data.checkin, data.checkout);
    if (!ctx) return null;
    return quoteStay(ctx, data.checkin, data.checkout, data.guests);
  });

/* ---------------------------------- admin ---------------------------------- */

export type AdminPricing = {
  settings: PricingSettings;
  rules: PricingRule[];
  nights: NightPrice[];
  pricelabs: {
    configured: boolean;
    enabled: boolean;
    lastSyncAt: string | null;
    syncStatus: string | null;
    syncError: string | null;
  };
};

export const getAdminPricing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ propertyId: z.string().uuid().nullish(), from: dateStr, to: dateStr }).parse(input),
  )
  .handler(async ({ data, context }): Promise<AdminPricing | { error: string }> => {
    const db = context.supabase as unknown as SupabaseClient<Database>;
    if (!(await isAdmin(db, context.userId))) return { error: "forbidden" };
    const propertyId = await resolvePropertyId(db, data.propertyId);
    if (!propertyId) return { error: "not_found" };
    const ctx = await loadPricingContext(db, propertyId, data.from, data.to);
    if (!ctx) return { error: "not_found" };
    const { pricelabsConfigured } = await import("@/lib/pricelabs.server");
    return {
      settings: ctx.settings,
      rules: ctx.rules,
      nights: priceCalendar(ctx, data.from, data.to),
      pricelabs: {
        configured: pricelabsConfigured(),
        enabled: ctx.settings.pricelabs_enabled,
        lastSyncAt: ctx.settings.pricelabs_last_sync_at,
        syncStatus: ctx.settings.pricelabs_sync_status,
        syncError: ctx.settings.pricelabs_sync_error,
      },
    };
  });

const settingsSchema = z.object({
  propertyId: z.string().uuid(),
  pricing_mode: z.enum(["manual", "pricelabs", "hybrid"]),
  currency: z.string().trim().min(3).max(3),
  base_price: z.number().int().min(1),
  minimum_price: z.number().int().min(1),
  maximum_price: z.number().int().min(1),
  weekend_price: z.number().int().min(1).nullable(),
  cleaning_fee: z.number().int().min(0),
  minimum_stay: z.number().int().min(1).max(60),
  direct_booking_adjustment_percent: z.number().min(-90).max(90),
  direct_booking_adjustment_fixed: z.number().int().min(-100000).max(100000),
  extra_guest_fee: z.number().int().min(0),
  extra_guest_after: z.number().int().min(1),
  weekly_discount_percent: z.number().min(0).max(90),
  monthly_discount_percent: z.number().min(0).max(90),
  length_of_stay_nights: z.number().int().min(1).max(365).nullable(),
  length_of_stay_discount_percent: z.number().min(0).max(90),
  last_minute_days: z.number().int().min(1).max(365).nullable(),
  last_minute_discount_percent: z.number().min(0).max(90),
  pricelabs_enabled: z.boolean(),
  pricelabs_listing_id: z.string().trim().max(120).nullable(),
});

export const savePricingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const db = context.supabase as unknown as SupabaseClient<Database>;
    if (!(await isAdmin(db, context.userId))) return { ok: false, error: "forbidden" };
    if (data.minimum_price > data.maximum_price) return { ok: false, error: "min_above_max" };
    const { propertyId, ...fields } = data;
    const { error } = await db
      .from("property_pricing_settings")
      .upsert({ property_id: propertyId, ...fields }, { onConflict: "property_id" });
    if (error) return { ok: false, error: "generic" };
    await logChange(db, propertyId, context.userId, (context.claims["email"] as string) ?? null, "settings", fields);
    return { ok: true };
  });

/** Applies one price to every night in the selected range (single day, span, month). */
export const applyDayPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        from: dateStr,
        to: dateStr,
        price: z.number().int().min(1),
        minimum_nights: z.number().int().min(1).max(60).nullable().default(null),
        reason: z.string().trim().max(200).default(""),
        expires_at: z.string().nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; days?: number; error?: string }> => {
    const db = context.supabase as unknown as SupabaseClient<Database>;
    if (!(await isAdmin(db, context.userId))) return { ok: false, error: "forbidden" };
    const { data: settings } = await db
      .from("property_pricing_settings")
      .select("currency, minimum_price, maximum_price")
      .eq("property_id", data.propertyId)
      .maybeSingle();
    if (!settings) return { ok: false, error: "not_found" };
    if (data.price < settings.minimum_price || data.price > settings.maximum_price) {
      return { ok: false, error: "out_of_bounds" };
    }
    const dates = eachDate(data.from, data.to);
    if (dates.length === 0 || dates.length > 400) return { ok: false, error: "invalid_range" };

    const rows = dates.map((date) => ({
      property_id: data.propertyId,
      date,
      price: data.price,
      final_price: data.price,
      calculated_price: data.price,
      currency: settings.currency,
      price_source: "manual" as const,
      manual_override: true,
      override_reason: data.reason || null,
      override_expires_at: data.expires_at,
      minimum_nights: data.minimum_nights,
    }));
    const { error } = await db.from("daily_prices").upsert(rows, { onConflict: "property_id,date" });
    if (error) return { ok: false, error: "generic" };
    await logChange(db, data.propertyId, context.userId, (context.claims["email"] as string) ?? null, "apply_prices", {
      from: data.from,
      to: data.to,
      price: data.price,
      days: dates.length,
    });
    return { ok: true, days: dates.length };
  });

/** Removes manual overrides so the range falls back to PriceLabs/rules/base price. */
export const clearDayPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ propertyId: z.string().uuid(), from: dateStr, to: dateStr }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const db = context.supabase as unknown as SupabaseClient<Database>;
    if (!(await isAdmin(db, context.userId))) return { ok: false, error: "forbidden" };
    const dates = eachDate(data.from, data.to);
    if (dates.length === 0) return { ok: false, error: "invalid_range" };
    const { error } = await db
      .from("daily_prices")
      .delete()
      .eq("property_id", data.propertyId)
      .gte("date", dates[0]!)
      .lte("date", dates[dates.length - 1]!)
      .eq("manual_override", true);
    if (error) return { ok: false, error: "generic" };
    await logChange(db, data.propertyId, context.userId, (context.claims["email"] as string) ?? null, "clear_prices", {
      from: data.from,
      to: data.to,
    });
    return { ok: true };
  });

export const savePricingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        propertyId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        rule_type: z.enum(["season", "weekend", "length_of_stay", "last_minute", "early_bird"]),
        start_date: dateStr.nullable(),
        end_date: dateStr.nullable(),
        adjustment_type: z.enum(["fixed_price", "percent", "amount"]),
        adjustment_value: z.number(),
        minimum_nights: z.number().int().min(1).max(60).nullable(),
        priority: z.number().int().min(0).max(100),
        active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const db = context.supabase as unknown as SupabaseClient<Database>;
    if (!(await isAdmin(db, context.userId))) return { ok: false, error: "forbidden" };
    const { id, propertyId, ...fields } = data;
    const row = {
      property_id: propertyId,
      ...fields,
      price: fields.adjustment_type === "fixed_price" ? Math.round(fields.adjustment_value) : null,
    };
    const { error } = id
      ? await db.from("pricing_rules").update(row).eq("id", id)
      : await db.from("pricing_rules").insert(row);
    if (error) return { ok: false, error: "generic" };
    await logChange(db, propertyId, context.userId, (context.claims["email"] as string) ?? null, id ? "rule_update" : "rule_create", fields);
    return { ok: true };
  });

export const deletePricingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const db = context.supabase as unknown as SupabaseClient<Database>;
    if (!(await isAdmin(db, context.userId))) return { ok: false, error: "forbidden" };
    const { data: rule } = await db.from("pricing_rules").select("property_id").eq("id", data.id).maybeSingle();
    const { error } = await db.from("pricing_rules").delete().eq("id", data.id);
    if (error) return { ok: false, error: "generic" };
    if (rule?.property_id) {
      await logChange(db, rule.property_id, context.userId, (context.claims["email"] as string) ?? null, "rule_delete", { id: data.id });
    }
    return { ok: true };
  });

/** Manual PriceLabs pull. Reports plainly when API access is not available yet. */
export const syncPricelabsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ propertyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; imported?: number; error?: string }> => {
    const db = context.supabase as unknown as SupabaseClient<Database>;
    if (!(await isAdmin(db, context.userId))) return { ok: false, error: "forbidden" };
    const { syncPricelabs } = await import("@/lib/pricelabs.server");
    const res = await syncPricelabs(db, data.propertyId);
    return res.ok ? { ok: true, imported: res.imported } : { ok: false, error: res.error };
  });
