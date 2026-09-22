import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AdminBooking = {
  id: string;
  property_id: string;
  booking_number: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  checkin: string;
  checkout: string;
  guests: number;
  message: string | null;
  status: string;
  source: string;
  currency: string;
  total_amount: number;
  cleaning_fee: number;
  payment_status: string;
  created_at: string;
};

export type CalendarEntry = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  entry_type: string;
  source: string;
  guest_name: string | null;
  guests: number | null;
  guest_phone: string | null;
  note: string | null;
  created_at: string;
  external_uid: string | null;
};

export type AdminPropertyOption = {
  id: string;
  internal_name: string;
  public_name: string;
  slug: string;
  status: string;
};

function errorCode(message: string): string {
  const m = message.match(/(forbidden|not_found|not_pending|dates_unavailable|invalid_status)/);
  return m ? m[1] : "generic";
}

async function currentUserIsAdmin(
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

/** Signs the current user in as host when their email is on the allowlist. */
export const getAdminSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean; email: string | null }> => {
    const { supabase, claims } = context;
    const isAdmin = await currentUserIsAdmin(supabase, context.userId);
    return { isAdmin, email: (claims["email"] as string) ?? null };
  });

/**
 * All host data. Without a property id every apartment is returned so the host
 * can see a combined overview; with one the data is filtered to that apartment.
 */
export const listAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ propertyId: z.string().uuid().nullish() }).parse(input ?? {}),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      bookings: AdminBooking[];
      entries: CalendarEntry[];
      properties: AdminPropertyOption[];
      isAdmin: boolean;
    }> => {
      const { supabase } = context;
      const isAdmin = await currentUserIsAdmin(supabase, context.userId);
      if (!isAdmin) return { bookings: [], entries: [], properties: [], isAdmin: false };

      let bookingQuery = supabase
        .from("bookings")
        .select(
          "id, property_id, booking_number, guest_name, guest_email, guest_phone, checkin, checkout, guests, message, status, source, currency, total_amount, cleaning_fee, payment_status, created_at",
        )
        .order("created_at", { ascending: false });
      let entryQuery = supabase
        .from("calendar_blocks")
        .select(
          "id, property_id, start_date, end_date, entry_type, source, guest_name, guests, guest_phone, note, created_at, external_uid",
        )
        .order("start_date", { ascending: true });

      if (data.propertyId) {
        bookingQuery = bookingQuery.eq("property_id", data.propertyId);
        entryQuery = entryQuery.eq("property_id", data.propertyId);
      }

      const [bookings, entries, properties] = await Promise.all([
        bookingQuery,
        entryQuery,
        supabase
          .from("properties")
          .select("id, internal_name, public_name, slug, status")
          .order("sort_order")
          .order("created_at"),
      ]);

      return {
        isAdmin: true,
        bookings: (bookings.data ?? []) as AdminBooking[],
        entries: (entries.data ?? []) as CalendarEntry[],
        properties: (properties.data ?? []) as AdminPropertyOption[],
      };
    },
  );

export const confirmBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    // Pull the latest Airbnb state of THIS apartment first so we never confirm
    // over an external booking.
    const { data: row } = await context.supabase
      .from("bookings")
      .select("property_id")
      .eq("id", data.id)
      .maybeSingle();
    try {
      const { syncAirbnb } = await import("@/lib/ical.server");
      await syncAirbnb("confirm", row?.property_id ?? null);
    } catch {
      /* sync problems must not block the confirmation check itself */
    }
    const { error } = await context.supabase.rpc("admin_confirm_booking", { _id: data.id });
    if (error) {
      const code = errorCode(error.message);
      if (code === "dates_unavailable") {
        const { notifyOperational, safeNotify } = await import("@/lib/notifications.server");
        await safeNotify(
          () =>
            notifyOperational(
              "calendar_conflict",
              row?.property_id ?? null,
              `Die Direktbuchung ${data.id} konnte nicht bestätigt werden: Der Zeitraum ist inzwischen belegt.`,
            ),
          "conflict alert",
        );
      }
      return { ok: false, error: code };
    }
    // Freeze the financial figures at confirmation time so later commission or
    // price changes never rewrite historic owner statements.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: b } = await supabaseAdmin
        .from("bookings")
        .select("property_id, total_amount, amount_paid, cleaning_fee, discount_amount, currency, financial_snapshot")
        .eq("id", data.id)
        .maybeSingle();
      if (b && !b.financial_snapshot) {
        const { data: fin } = await supabaseAdmin
          .from("property_financial_settings")
          .select("*")
          .eq("property_id", b.property_id)
          .maybeSingle();
        const gross = b.total_amount ?? 0;
        const commission =
          Math.round((gross * Number(fin?.commission_percent ?? 0)) / 100) +
          Number(fin?.commission_fixed ?? 0);
        const paymentFee = Math.round(
          ((b.amount_paid ?? 0) * Number(fin?.payment_fee_percent ?? 0)) / 100,
        );
        await supabaseAdmin
          .from("bookings")
          .update({
            financial_snapshot: {
              gross,
              cleaning: b.cleaning_fee ?? 0,
              discount: b.discount_amount ?? 0,
              commission,
              payment_fee: paymentFee,
              currency: b.currency,
              frozen_at: new Date().toISOString(),
            } as never,
          })
          .eq("id", data.id);
      }
    } catch (e) {
      console.error("[admin] financial snapshot failed", e);
    }
    {
      const { notifyGuest, notifyInternal, safeNotify } = await import(
        "@/lib/notifications.server"
      );
      await safeNotify(() => notifyGuest(data.id, "booking_confirmed"), "guest confirmation");
      await safeNotify(() => notifyInternal("confirmed_booking", data.id), "internal confirmation");
    }

    return { ok: true };
  });

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["rejected", "cancelled", "pending"]) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await context.supabase.rpc("admin_set_booking_status", {
      _id: data.id,
      _status: data.status,
    });
    if (error) return { ok: false, error: errorCode(error.message) };
    {
      const { notifyGuest, notifyInternal, safeNotify } = await import(
        "@/lib/notifications.server"
      );
      if (data.status === "rejected") {
        await safeNotify(() => notifyGuest(data.id, "inquiry_declined"), "guest decline");
        await safeNotify(() => notifyInternal("booking_change", data.id), "internal decline");
      } else if (data.status === "cancelled") {
        await safeNotify(
          () => notifyGuest(data.id, "cancellation_confirmed"),
          "guest cancellation",
        );
        await safeNotify(() => notifyInternal("cancellation", data.id), "internal cancellation");
      }
    }
    return { ok: true };
  });

const entrySchema = z.object({
  property_id: z.string().uuid().nullish(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entry_type: z.enum(["booking", "block"]),
  source: z.enum(["direct", "airbnb", "booking_com", "other"]).default("direct"),
  guest_name: z.string().trim().max(120).optional().default(""),
  guests: z.number().int().min(1).max(12).nullable().optional(),
  guest_phone: z.string().trim().max(40).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""),
});

export const createCalendarEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entrySchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    if (data.end_date <= data.start_date) return { ok: false, error: "invalid_range" };

    let propertyId = data.property_id ?? null;
    if (!propertyId) {
      const { data: prop } = await context.supabase
        .from("properties")
        .select("id")
        .eq("status", "active")
        .order("sort_order")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      propertyId = prop?.id ?? null;
    }
    if (!propertyId) return { ok: false, error: "no_property" };

    const { error } = await context.supabase.from("calendar_blocks").insert({
      property_id: propertyId,
      start_date: data.start_date,
      end_date: data.end_date,
      entry_type: data.entry_type,
      source: data.source,
      guest_name: data.guest_name || null,
      guests: data.guests ?? null,
      guest_phone: data.guest_phone || null,
      note: data.note || null,
      created_by: context.userId,
    });
    if (error) return { ok: false, error: errorCode(error.message) };
    return { ok: true };
  });

export const deleteCalendarEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { data: row } = await context.supabase
      .from("calendar_blocks")
      .select("external_uid")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.external_uid) return { ok: false, error: "external_readonly" };
    const { error } = await context.supabase.from("calendar_blocks").delete().eq("id", data.id);
    if (error) return { ok: false, error: errorCode(error.message) };
    return { ok: true };
  });
