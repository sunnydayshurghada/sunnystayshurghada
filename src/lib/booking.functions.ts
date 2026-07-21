import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const bookingSchema = z.object({
  guest_name: z.string().trim().min(2).max(120),
  guest_email: z.string().trim().email().max(255),
  guest_phone: z.string().trim().max(40).default(""),
  checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(6),
  message: z.string().trim().max(1000).default(""),
});

export type BookingInput = z.infer<typeof bookingSchema>;

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

export const createBookingRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bookingSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

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

    const { data: newId, error } = await supabase.rpc("create_booking_request", {
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
        /(checkin_in_past|invalid_range|range_too_long|invalid_guests|invalid_name|invalid_email|dates_unavailable)/
      );
      return { ok: false, error: m ? m[1] : "generic" };
    }
    return { ok: true, id: newId as string };
  });
