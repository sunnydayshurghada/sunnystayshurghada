import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export const createBookingRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bookingSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: newId, error } = await supabaseAdmin.rpc("create_booking_request", {
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
