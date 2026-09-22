/**
 * Admin-facing server functions for the (not yet active) payment configuration.
 * No guest-facing payment endpoints exist yet by design.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type BookingSettingsView = {
  isAdmin: boolean;
  autoConfirmDirectBookings: boolean;
  paymentsEnabled: boolean;
  currency: string;
  paymentMode: "full" | "deposit_percent" | "deposit_fixed" | "on_arrival";
  depositPercent: number;
  depositFixedAmount: number;
  holdMinutes: number;
  nightlyRate: number;
  cleaningFee: number;
  providers: { paymob: boolean; paypal: boolean };
};

async function assertAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !error && data !== null;
}

const emptyView: BookingSettingsView = {
  isAdmin: false,
  autoConfirmDirectBookings: false,
  paymentsEnabled: false,
  currency: "EUR",
  paymentMode: "full",
  depositPercent: 0,
  depositFixedAmount: 0,
  holdMinutes: 15,
  nightlyRate: 0,
  cleaningFee: 0,
  providers: { paymob: false, paypal: false },
};

export const getBookingSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BookingSettingsView> => {
    const { supabase, userId } = context as unknown as {
      supabase: SupabaseClient<Database>;
      userId: string;
    };
    if (!(await assertAdmin(supabase, userId))) return emptyView;

    const { getBookingSettings: read, paymobGateway, paypalGateway } = await import(
      "./payments.server"
    );
    const s = await read();
    return {
      isAdmin: true,
      autoConfirmDirectBookings: s.auto_confirm_direct_bookings,
      paymentsEnabled: s.payments_enabled,
      currency: s.currency,
      paymentMode: s.payment_mode as BookingSettingsView["paymentMode"],
      depositPercent: s.deposit_percent,
      depositFixedAmount: s.deposit_fixed_amount,
      holdMinutes: s.hold_minutes,
      nightlyRate: s.nightly_rate,
      cleaningFee: s.cleaning_fee,
      providers: {
        paymob: paymobGateway.isConfigured(),
        paypal: paypalGateway.isConfigured(),
      },
    };
  });

const settingsSchema = z.object({
  autoConfirmDirectBookings: z.boolean().optional(),
  paymentsEnabled: z.boolean().optional(),
  currency: z.string().min(3).max(3).optional(),
  paymentMode: z.enum(["full", "deposit_percent", "deposit_fixed", "on_arrival"]).optional(),
  depositPercent: z.number().int().min(0).max(100).optional(),
  depositFixedAmount: z.number().int().min(0).optional(),
  holdMinutes: z.number().int().min(1).max(120).optional(),
  nightlyRate: z.number().int().min(0).optional(),
  cleaningFee: z.number().int().min(0).optional(),
});

export const updateBookingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { supabase, userId } = context as unknown as {
      supabase: SupabaseClient<Database>;
      userId: string;
    };
    if (!(await assertAdmin(supabase, userId))) return { ok: false, error: "forbidden" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as SupabaseClient<Database>;
    const patch: Database["public"]["Tables"]["booking_settings"]["Update"] = {};
    if (data.autoConfirmDirectBookings !== undefined)
      patch.auto_confirm_direct_bookings = data.autoConfirmDirectBookings;
    if (data.paymentsEnabled !== undefined) patch.payments_enabled = data.paymentsEnabled;
    if (data.currency !== undefined) patch.currency = data.currency;
    if (data.paymentMode !== undefined) patch.payment_mode = data.paymentMode;
    if (data.depositPercent !== undefined) patch.deposit_percent = data.depositPercent;
    if (data.depositFixedAmount !== undefined)
      patch.deposit_fixed_amount = data.depositFixedAmount;
    if (data.holdMinutes !== undefined) patch.hold_minutes = data.holdMinutes;
    if (data.nightlyRate !== undefined) patch.nightly_rate = data.nightlyRate;
    if (data.cleaningFee !== undefined) patch.cleaning_fee = data.cleaningFee;

    const { error } = await db.from("booking_settings").update(patch).eq("id", true);
    if (error) return { ok: false, error: "generic" };
    return { ok: true };
  });
