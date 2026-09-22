import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AdminBooking = {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  checkin: string;
  checkout: string;
  guests: number;
  message: string | null;
  status: string;
  created_at: string;
};

export type CalendarEntry = {
  id: string;
  start_date: string;
  end_date: string;
  entry_type: string;
  source: string;
  guest_name: string | null;
  guests: number | null;
  guest_phone: string | null;
  note: string | null;
  created_at: string;
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

export const listAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ bookings: AdminBooking[]; entries: CalendarEntry[]; isAdmin: boolean }> => {
      const { supabase } = context;
      const isAdmin = await currentUserIsAdmin(supabase, context.userId);
      if (!isAdmin) return { bookings: [], entries: [], isAdmin: false };

      const [bookings, entries] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, guest_name, guest_email, guest_phone, checkin, checkout, guests, message, status, created_at",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("calendar_blocks")
          .select(
            "id, start_date, end_date, entry_type, source, guest_name, guests, guest_phone, note, created_at",
          )
          .order("start_date", { ascending: true }),
      ]);

      return {
        isAdmin: true,
        bookings: (bookings.data ?? []) as AdminBooking[],
        entries: (entries.data ?? []) as CalendarEntry[],
      };
    },
  );

export const confirmBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const { error } = await context.supabase.rpc("admin_confirm_booking", { _id: data.id });
    if (error) return { ok: false, error: errorCode(error.message) };
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
    return { ok: true };
  });

const entrySchema = z.object({
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
    const { error } = await context.supabase.from("calendar_blocks").insert({
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
    const { error } = await context.supabase.from("calendar_blocks").delete().eq("id", data.id);
    if (error) return { ok: false, error: errorCode(error.message) };
    return { ok: true };
  });
