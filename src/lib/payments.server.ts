/**
 * Server-only payment groundwork.
 *
 * Nothing here charges money yet — it defines the money model, the timed hold
 * (reservation) lifecycle and the provider interfaces so that Paymob/PayPal can be
 * plugged in later without touching the existing inquiry flow.
 *
 * Rules baked in here:
 *  - all amounts are integers in the smallest currency unit (cents/piastres)
 *  - availability is re-checked server-side before a hold and before confirmation
 *  - a booking only counts as paid after a server-side verified webhook
 *  - provider secrets are read from process.env inside functions, never shipped to the client
 *
 * Never import this file from client code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PaymentProvider = "paymob" | "paypal" | "manual";
export type PaymentMethod = "card" | "vodafone_cash" | "mobile_wallet" | "paypal";
export type BookingType = "inquiry" | "manual" | "instant";
export type BookingStatus =
  | "pending"
  | "payment_pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "expired";
export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "partially_refunded"
  | "refunded";

/** One night of the stay with the price that was actually quoted. */
export type PriceSnapshotNight = { date: string; amount: number };

export type Quote = {
  currency: string;
  nights: PriceSnapshotNight[];
  nightlyTotal: number;
  cleaningFee: number;
  discountAmount: number;
  totalAmount: number;
  /** Amount due now (full price, percentage deposit, fixed deposit, or 0 on arrival). */
  depositAmount: number;
};

export type BookingSettings = Database["public"]["Tables"]["booking_settings"]["Row"];

async function admin(): Promise<SupabaseClient<Database>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient<Database>;
}

export async function getBookingSettings(): Promise<BookingSettings> {
  const db = await admin();
  const { data } = await db.from("booking_settings").select("*").eq("id", true).maybeSingle();
  if (data) return data;
  const { data: created } = await db
    .from("booking_settings")
    .insert({ id: true })
    .select("*")
    .single();
  return created!;
}

function nightsBetween(checkin: string, checkout: string): string[] {
  const out: string[] = [];
  const end = new Date(`${checkout}T00:00:00Z`);
  for (let d = new Date(`${checkin}T00:00:00Z`); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Builds the money breakdown for a stay from the current settings.
 * Integer arithmetic only — never floats.
 */
export async function buildQuote(
  checkin: string,
  checkout: string,
  opts: { discountAmount?: number } = {},
): Promise<Quote> {
  const s = await getBookingSettings();
  const nights = nightsBetween(checkin, checkout).map((date) => ({
    date,
    amount: s.nightly_rate,
  }));
  const nightlyTotal = nights.reduce((sum, n) => sum + n.amount, 0);
  const discountAmount = Math.max(0, Math.trunc(opts.discountAmount ?? 0));
  const totalAmount = Math.max(0, nightlyTotal + s.cleaning_fee - discountAmount);

  let depositAmount = totalAmount;
  if (s.payment_mode === "deposit_percent") {
    depositAmount = Math.round((totalAmount * s.deposit_percent) / 100);
  } else if (s.payment_mode === "deposit_fixed") {
    depositAmount = Math.min(totalAmount, s.deposit_fixed_amount);
  } else if (s.payment_mode === "on_arrival") {
    depositAmount = 0;
  }

  return {
    currency: s.currency,
    nights,
    nightlyTotal,
    cleaningFee: s.cleaning_fee,
    discountAmount,
    totalAmount,
    depositAmount,
  };
}

/** Server-side availability re-check. Lapsed holds are released first. */
export async function isRangeAvailable(checkin: string, checkout: string): Promise<boolean> {
  const db = await admin();
  await db.rpc("release_expired_holds");
  const { data, error } = await db.rpc("check_availability", {
    _checkin: checkin,
    _checkout: checkout,
  });
  if (error) return false;
  return data === true;
}

export type HoldResult =
  | { ok: true; bookingId: string; expiresAt: string; quote: Quote }
  | { ok: false; error: "dates_unavailable" | "not_found" | "invalid_state" };

/**
 * Reserves an existing booking row for the duration of a payment attempt.
 * The hold blocks the calendar until `payment_expires_at`; after that it frees itself
 * (availability is evaluated against the timestamp, and `release_expired_holds` marks it).
 */
export async function startPaymentHold(bookingId: string): Promise<HoldResult> {
  const db = await admin();
  const settings = await getBookingSettings();
  const { data: booking } = await db
    .from("bookings")
    .select("id, checkin, checkout, booking_status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "not_found" };
  if (!["pending", "expired"].includes(booking.booking_status)) {
    return { ok: false, error: "invalid_state" };
  }
  if (!(await isRangeAvailable(booking.checkin, booking.checkout))) {
    return { ok: false, error: "dates_unavailable" };
  }

  const quote = await buildQuote(booking.checkin, booking.checkout);
  const expiresAt = new Date(Date.now() + settings.hold_minutes * 60_000).toISOString();
  await db
    .from("bookings")
    .update({
      booking_status: "payment_pending",
      payment_status: "pending",
      payment_expires_at: expiresAt,
      currency: quote.currency,
      nightly_total: quote.nightlyTotal,
      cleaning_fee: quote.cleaningFee,
      discount_amount: quote.discountAmount,
      total_amount: quote.totalAmount,
      deposit_amount: quote.depositAmount,
      price_snapshot: quote.nights,
    })
    .eq("id", bookingId);

  return { ok: true, bookingId, expiresAt, quote };
}

export async function releaseHold(bookingId: string): Promise<void> {
  const db = await admin();
  await db
    .from("bookings")
    .update({
      booking_status: "pending",
      payment_status: "unpaid",
      payment_expires_at: null,
    })
    .eq("id", bookingId)
    .eq("booking_status", "payment_pending");
}

export type VerifiedPayment = {
  bookingId: string;
  provider: PaymentProvider;
  method: PaymentMethod | null;
  providerTransactionId: string;
  amount: number;
  currency: string;
  /** Raw provider payload, stored for the audit trail. */
  payload: unknown;
};

/**
 * Applies a payment that a provider webhook has already verified server-side.
 * Browser redirects must never call this — only verified webhook handlers may.
 * Idempotent: the same provider transaction id is only applied once.
 */
export async function applyVerifiedPayment(
  p: VerifiedPayment,
): Promise<{ ok: boolean; confirmed: boolean; error?: string }> {
  const db = await admin();
  const settings = await getBookingSettings();

  const { data: existing } = await db
    .from("payment_transactions")
    .select("id, status")
    .eq("provider", p.provider)
    .eq("provider_transaction_id", p.providerTransactionId)
    .maybeSingle();
  if (existing && existing.status === "paid") return { ok: true, confirmed: true };

  const { data: booking } = await db
    .from("bookings")
    .select("id, checkin, checkout, total_amount, amount_paid")
    .eq("id", p.bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, confirmed: false, error: "not_found" };

  await db.from("payment_transactions").upsert(
    {
      booking_id: p.bookingId,
      provider: p.provider,
      method: p.method,
      provider_transaction_id: p.providerTransactionId,
      status: "paid",
      amount: p.amount,
      currency: p.currency,
      raw_payload: p.payload as never,
      verified_at: new Date().toISOString(),
    },
    { onConflict: "provider,provider_transaction_id" },
  );

  // Final availability gate before the booking becomes binding.
  const stillFree = await isRangeAvailable(booking.checkin, booking.checkout);
  const amountPaid = booking.amount_paid + p.amount;
  const autoConfirm = settings.auto_confirm_direct_bookings && stillFree;

  await db
    .from("bookings")
    .update({
      amount_paid: amountPaid,
      payment_status: "paid",
      payment_provider: p.provider,
      payment_method: p.method,
      payment_transaction_id: p.providerTransactionId,
      payment_expires_at: null,
      booking_status: autoConfirm ? "confirmed" : "pending",
      status: autoConfirm ? "confirmed" : "pending",
      confirmed_at: autoConfirm ? new Date().toISOString() : null,
    })
    .eq("id", p.bookingId);

  // Payment receipt to the guest, plus central desk and owner notifications.
  try {
    const { notifyGuest, notifyInternal, safeNotify } = await import(
      "@/lib/notifications.server"
    );
    await safeNotify(() => notifyGuest(p.bookingId, "payment_confirmed"), "guest payment");
    await safeNotify(() => notifyInternal("payment_success", p.bookingId), "internal payment");
    if (autoConfirm) {
      await safeNotify(() => notifyGuest(p.bookingId, "booking_confirmed"), "guest confirmation");
      await safeNotify(
        () => notifyInternal("confirmed_booking", p.bookingId),
        "internal confirmation",
      );
    }
  } catch (e) {
    console.error("[payments] notification failed", e);
  }

  return { ok: true, confirmed: autoConfirm };
}

/* ------------------------------------------------------------------ */
/* Provider adapters — interfaces only, no live payment implementation. */
/* ------------------------------------------------------------------ */

export type CheckoutSession = { redirectUrl: string; providerReference: string };

export interface PaymentGateway {
  readonly provider: PaymentProvider;
  /** True once the required secrets are configured for this environment. */
  isConfigured(): boolean;
  /** Creates a hosted checkout for an already-held booking. */
  createCheckout(input: {
    bookingId: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
    returnUrl: string;
  }): Promise<CheckoutSession>;
  /** Verifies a webhook request signature and maps it to a VerifiedPayment. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedPayment | null>;
}

const notImplemented = (provider: string) => {
  throw new Error(`${provider}_not_implemented`);
};

/** Paymob: Visa, Mastercard, Vodafone Cash and other Egyptian mobile wallets. */
export const paymobGateway: PaymentGateway = {
  provider: "paymob",
  isConfigured: () => Boolean(process.env["PAYMOB_API_KEY"] && process.env["PAYMOB_HMAC_SECRET"]),
  createCheckout: async () => notImplemented("paymob"),
  verifyWebhook: async () => notImplemented("paymob"),
};

/** PayPal for international guests. */
export const paypalGateway: PaymentGateway = {
  provider: "paypal",
  isConfigured: () =>
    Boolean(process.env["PAYPAL_CLIENT_ID"] && process.env["PAYPAL_WEBHOOK_ID"]),
  createCheckout: async () => notImplemented("paypal"),
  verifyWebhook: async () => notImplemented("paypal"),
};

export function gatewayFor(provider: PaymentProvider): PaymentGateway | null {
  if (provider === "paymob") return paymobGateway;
  if (provider === "paypal") return paypalGateway;
  return null;
}
