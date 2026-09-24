import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CURRENCIES, type Currency, type RateQuote } from "@/lib/currency";

const cur = z.enum(CURRENCIES);

async function isStaff(ctx: { supabase: any; userId: string }): Promise<boolean> {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  return ((data ?? []) as { role: string }[]).some((r) =>
    ["admin", "super_admin", "booking_manager"].includes(r.role),
  );
}

async function allRates(propertyId: string | null): Promise<RateQuote[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getRate } = await import("@/lib/currency.server");
  const out: RateQuote[] = [];
  for (const from of CURRENCIES)
    for (const to of CURRENCIES) {
      if (from === to) continue;
      const r = await getRate(supabaseAdmin, from, to, propertyId);
      if (r) out.push(r);
    }
  return out;
}

export interface CurrencyAdminData {
  settings: {
    base_currency: Currency;
    owner_statement_currency: Currency;
    payout_currency: Currency;
    rate_mode: "auto" | "manual";
    markup_percent: number;
    rounding_rule: string;
  };
  rates: RateQuote[];
}

export const getCurrencyAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ propertyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<CurrencyAdminData | { error: string }> => {
    if (!(await isStaff(context))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getCurrencySettings } = await import("@/lib/currency.server");
    const s = await getCurrencySettings(supabaseAdmin, data.propertyId);
    return {
      settings: {
        base_currency: s.base_currency,
        owner_statement_currency: s.owner_statement_currency,
        payout_currency: s.payout_currency,
        rate_mode: s.rate_mode,
        markup_percent: s.markup_percent,
        rounding_rule: s.rounding_rule,
      },
      rates: await allRates(data.propertyId),
    };
  });

export const saveCurrencySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        base_currency: cur,
        owner_statement_currency: cur,
        payout_currency: cur,
        rate_mode: z.enum(["auto", "manual"]),
        markup_percent: z.number().min(0).max(20),
        rounding_rule: z.enum(["half_up", "down", "up", "whole_unit"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isStaff(context))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { propertyId, ...rest } = data;
    const { error } = await supabaseAdmin
      .from("property_currency_settings")
      .upsert({ property_id: propertyId, ...rest });
    if (error) return { error: "generic" };
    // Keep the property's pricing currency in line with its base currency.
    // Existing bookings keep their own stored currency and amounts.
    await supabaseAdmin.from("properties").update({ currency: rest.base_currency }).eq("id", propertyId);
    await supabaseAdmin
      .from("property_pricing_settings")
      .update({ currency: rest.base_currency })
      .eq("property_id", propertyId);
    await supabaseAdmin.from("security_audit_log").insert({
      actor_id: context.userId,
      property_id: propertyId,
      action: "currency_settings_updated",
      detail: rest as never,
    });
    return { ok: true };
  });

export const refreshExchangeRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; error?: string }> => {
    if (!(await isStaff(context))) return { ok: false, error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { refreshRates } = await import("@/lib/currency.server");
    const r = await refreshRates(supabaseAdmin);
    return { ok: r.ok, error: r.error };
  });

export const setManualRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ propertyId: z.string().uuid(), from: cur, to: cur, rate: z.number().positive() })
      .refine((v) => v.from !== v.to)
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isStaff(context))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { saveManualRate } = await import("@/lib/currency.server");
    await saveManualRate(supabaseAdmin, { ...data, userId: context.userId });
    return { ok: true };
  });

/** Rates for the owner's display conversion; display never changes stored amounts. */
export const getDisplayRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ preferred: Currency; rates: RateQuote[] }> => {
    const { data } = await context.supabase
      .from("user_profiles")
      .select("preferred_display_currency")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      preferred: (data?.preferred_display_currency ?? "EUR") as Currency,
      rates: await allRates(null),
    };
  });

export const setDisplayCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ currency: cur }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { error } = await context.supabase
      .from("user_profiles")
      .update({ preferred_display_currency: data.currency })
      .eq("user_id", context.userId);
    return { ok: !error };
  });
