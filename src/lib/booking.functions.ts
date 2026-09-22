import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { HOST_EMAIL } from "@/lib/airbnb";

const bookingSchema = z.object({
  property_id: z.string().uuid().nullish(),
  guest_name: z.string().trim().min(2).max(120),
  guest_email: z.string().trim().email().max(255),
  guest_phone: z.string().trim().max(40).default(""),
  checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(6),
  message: z.string().trim().max(1000).default(""),
  language: z.string().trim().max(10).default("de"),
});

export type BookingInput = z.infer<typeof bookingSchema>;

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

export const createBookingRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bookingSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
    // Runtime env first, build-time VITE_* values as fallback so the form keeps
    // working even if server env vars are missing in the deployed worker.
    const SUPABASE_URL = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY =
      process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
      ];
      console.error(`[booking] Missing Supabase env vars: ${missing.join(", ")}`);
      return { ok: false, error: "generic" };
    }

    const key = SUPABASE_PUBLISHABLE_KEY;
    const supabase = createClient<Database>(SUPABASE_URL, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    // Always property-scoped; without an explicit id the first active apartment is used.
    const { data: newId, error } = data.property_id
      ? await supabase.rpc("create_property_booking_request", {
          _property_id: data.property_id,
          _guest_name: data.guest_name,
          _guest_email: data.guest_email,
          _guest_phone: data.guest_phone,
          _checkin: data.checkin,
          _checkout: data.checkout,
          _guests: data.guests,
          _message: data.message,
        })
      : await supabase.rpc("create_booking_request", {
          _guest_name: data.guest_name,
          _guest_email: data.guest_email,
          _guest_phone: data.guest_phone,
          _checkin: data.checkin,
          _checkout: data.checkout,
          _guests: data.guests,
          _message: data.message,
        });
    if (error) {
      const m = error.message.match(
        /(checkin_in_past|invalid_range|range_too_long|below_minimum_nights|property_not_bookable|property_not_found|invalid_guests|invalid_name|invalid_email|dates_unavailable)/
      );
      return { ok: false, error: m ? m[1] : "generic" };
    }
    const bookingId = newId as string;

    // Immutable price snapshot: the price shown at request time is frozen on the
    // booking, so later price changes never alter an existing booking.
    try {
      const { loadPricingContext, quoteStay } = await import("@/lib/pricing.server");
      const { data: row } = await supabase
        .from("bookings")
        .select("property_id")
        .eq("id", bookingId)
        .maybeSingle();
      const propertyId = row?.property_id ?? data.property_id ?? null;
      if (propertyId) {
        const ctx = await loadPricingContext(supabase, propertyId, data.checkin, data.checkout);
        if (ctx) {
          const quote = quoteStay(ctx, data.checkin, data.checkout, data.guests);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("bookings")
            .update({
              currency: quote.currency,
              nightly_total: quote.nightlyTotal,
              cleaning_fee: quote.cleaningFee,
              discount_amount: quote.discountAmount,
              total_amount: quote.totalAmount,
              price_snapshot: quote as never,
            })
            .eq("id", bookingId);
        }
      }
    } catch (e) {
      console.error("[booking] price snapshot failed", e);
    }


    // Guest language drives the language of every guest email for this booking.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { normalizeLanguage } = await import("@/lib/notifications.server");
      await supabaseAdmin
        .from("bookings")
        .update({ guest_language: normalizeLanguage(data.language) })
        .eq("id", bookingId);
    } catch (e) {
      console.error("[booking] language store failed", e);
    }

    // Acknowledge to the guest, alert the central desk and the assigned owners.
    // Email problems must never fail the booking request itself.
    try {
      const { notifyGuest, notifyInternal, safeNotify, loadBookingContext } = await import(
        "@/lib/notifications.server"
      );
      const ctx = await loadBookingContext(bookingId);
      if (ctx) {
        await safeNotify(() => notifyGuest(bookingId, "inquiry_received", ctx), "guest inquiry ack");
        await safeNotify(() => notifyInternal("new_inquiry", bookingId, ctx), "internal inquiry");
      }
    } catch (e) {
      console.error("[booking] notification failed", e);
    }

    return { ok: true, id: bookingId };
  });
