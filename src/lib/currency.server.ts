/**
 * Server-only exchange-rate engine.
 *  - fetches EUR/USD/EGP rates from a public provider and stores every snapshot
 *  - falls back to the last stored rate when the provider is down (flagged stale)
 *  - never converts with a zero rate
 *  - every conversion used for money is logged immutably in currency_conversions
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  CURRENCIES,
  convertMinor,
  type Currency,
  type RateQuote,
  type RoundingRule,
} from "@/lib/currency";

type Db = SupabaseClient<Database>;
const PROVIDER = "open.er-api.com";
const RATE_TTL_HOURS = 24;
export const PAYMENT_LOCK_MINUTES = 15;

export interface CurrencySettings {
  property_id: string;
  base_currency: Currency;
  owner_statement_currency: Currency;
  payout_currency: Currency;
  rate_mode: "auto" | "manual";
  markup_percent: number;
  rounding_rule: RoundingRule;
}

export async function getCurrencySettings(db: Db, propertyId: string): Promise<CurrencySettings> {
  const { data } = await db
    .from("property_currency_settings")
    .select("*")
    .eq("property_id", propertyId)
    .maybeSingle();
  return {
    property_id: propertyId,
    base_currency: (data?.base_currency ?? "EUR") as Currency,
    owner_statement_currency: (data?.owner_statement_currency ?? "EUR") as Currency,
    payout_currency: (data?.payout_currency ?? "EUR") as Currency,
    rate_mode: (data?.rate_mode ?? "auto") as "auto" | "manual",
    markup_percent: Number(data?.markup_percent ?? 0),
    rounding_rule: (data?.rounding_rule ?? "half_up") as RoundingRule,
  };
}

/** Fetch fresh rates for all pairs and store them. Returns number of rows stored. */
export async function refreshRates(db: Db): Promise<{ ok: boolean; stored: number; error?: string }> {
  const now = new Date();
  const validUntil = new Date(now.getTime() + RATE_TTL_HOURS * 3600_000).toISOString();
  const rows: Database["public"]["Tables"]["exchange_rates"]["Insert"][] = [];
  try {
    for (const base of CURRENCIES) {
      const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
      if (json.result !== "success" || !json.rates) throw new Error("bad payload");
      for (const quote of CURRENCIES) {
        if (quote === base) continue;
        const rate = Number(json.rates[quote]);
        if (!Number.isFinite(rate) || rate <= 0) continue; // never store 0
        rows.push({
          base_currency: base,
          quote_currency: quote,
          rate,
          source: PROVIDER,
          fetched_at: now.toISOString(),
          valid_until: validUntil,
        });
      }
    }
  } catch (e) {
    console.error("[currency] provider unreachable", e);
    return { ok: false, stored: 0, error: "provider_unreachable" };
  }
  if (rows.length) await db.from("exchange_rates").insert(rows);
  return { ok: true, stored: rows.length };
}

/** Store a manually entered rate for a property (or globally when propertyId is null). */
export async function saveManualRate(
  db: Db,
  args: { from: Currency; to: Currency; rate: number; propertyId: string | null; userId: string },
) {
  if (!(args.rate > 0) || args.from === args.to) throw new Error("invalid_rate");
  const now = new Date();
  await db.from("exchange_rates").insert({
    base_currency: args.from,
    quote_currency: args.to,
    rate: args.rate,
    source: "manual",
    property_id: args.propertyId,
    fetched_at: now.toISOString(),
    valid_until: new Date(now.getTime() + 30 * 86400_000).toISOString(),
    created_by: args.userId,
  });
}

async function latestStored(
  db: Db,
  from: Currency,
  to: Currency,
  opts: { manualFor?: string | null },
): Promise<RateQuote | null> {
  let q = db
    .from("exchange_rates")
    .select("rate, source, fetched_at, valid_until")
    .eq("base_currency", from)
    .eq("quote_currency", to)
    .gt("rate", 0)
    .order("fetched_at", { ascending: false })
    .limit(1);
  q = opts.manualFor
    ? q.eq("source", "manual").eq("property_id", opts.manualFor)
    : q.neq("source", "manual");
  const { data } = await q.maybeSingle();
  if (!data) return null;
  return {
    from,
    to,
    rate: Number(data.rate),
    source: data.source,
    fetched_at: data.fetched_at,
    valid_until: data.valid_until,
    stale: Date.parse(data.valid_until) < Date.now(),
  };
}

/**
 * Best available rate. Manual mode uses the property's manual rate; auto mode
 * uses the newest stored rate and tries a refresh when it has expired. If the
 * provider is down the last good rate is returned with `stale: true`.
 * Returns null when no positive rate exists at all.
 */
export async function getRate(
  db: Db,
  from: Currency,
  to: Currency,
  propertyId?: string | null,
): Promise<RateQuote | null> {
  if (from === to) {
    const now = new Date().toISOString();
    return { from, to, rate: 1, source: "identity", fetched_at: now, valid_until: now, stale: false };
  }
  if (propertyId) {
    const s = await getCurrencySettings(db, propertyId);
    if (s.rate_mode === "manual") {
      const manual = await latestStored(db, from, to, { manualFor: propertyId });
      if (manual) return manual;
      const inverse = await latestStored(db, to, from, { manualFor: propertyId });
      if (inverse) return { ...inverse, from, to, rate: 1 / inverse.rate };
    }
  }
  let r = await latestStored(db, from, to, {});
  if (!r || r.stale) {
    const res = await refreshRates(db);
    if (res.ok) r = await latestStored(db, from, to, {});
  }
  return r;
}

export interface ConversionResult {
  id: string | null;
  original_amount: number;
  from: Currency;
  to: Currency;
  rate: number;
  converted_amount: number;
  source: string;
  fetched_at: string;
  valid_until: string;
  locked_until: string | null;
  stale: boolean;
}

/**
 * Convert and (optionally) persist the conversion. Applies the property's
 * markup and rounding rule. Returns null if no valid rate is available.
 */
export async function convert(
  db: Db,
  args: {
    amount: number;
    from: Currency;
    to: Currency;
    propertyId?: string | null;
    bookingId?: string | null;
    context: string;
    persist?: boolean;
    lockMinutes?: number;
  },
): Promise<ConversionResult | null> {
  const quote = await getRate(db, args.from, args.to, args.propertyId);
  if (!quote || !(quote.rate > 0)) return null;
  const settings = args.propertyId ? await getCurrencySettings(db, args.propertyId) : null;
  const markup = args.from === args.to ? 0 : (settings?.markup_percent ?? 0);
  const effective = quote.rate * (1 + markup / 100);
  const converted = convertMinor(args.amount, effective, settings?.rounding_rule ?? "half_up");
  if (converted === null) return null;
  const lockedUntil = args.lockMinutes
    ? new Date(Date.now() + args.lockMinutes * 60_000).toISOString()
    : null;

  let id: string | null = null;
  if (args.persist) {
    const { data } = await db
      .from("currency_conversions")
      .insert({
        property_id: args.propertyId ?? null,
        booking_id: args.bookingId ?? null,
        context: args.context,
        from_currency: args.from,
        to_currency: args.to,
        original_amount: args.amount,
        rate: effective,
        markup_percent: markup,
        converted_amount: converted,
        rate_source: quote.source,
        rate_fetched_at: quote.fetched_at,
        rate_valid_until: quote.valid_until,
        locked_until: lockedUntil,
      })
      .select("id")
      .single();
    id = data?.id ?? null;
  }
  return {
    id,
    original_amount: args.amount,
    from: args.from,
    to: args.to,
    rate: effective,
    converted_amount: converted,
    source: quote.source,
    fetched_at: quote.fetched_at,
    valid_until: quote.valid_until,
    locked_until: lockedUntil,
    stale: quote.stale,
  };
}

/**
 * Freeze the rate for a payment for 15 minutes. Reuses an unexpired lock for
 * the same booking so repeated clicks never pick up a new rate.
 */
export async function lockPaymentRate(
  db: Db,
  args: { bookingId: string; propertyId: string; amount: number; from: Currency; to: Currency },
): Promise<ConversionResult | null> {
  const { data: existing } = await db
    .from("currency_conversions")
    .select("*")
    .eq("booking_id", args.bookingId)
    .eq("context", "payment")
    .eq("to_currency", args.to)
    .gt("locked_until", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing && Number(existing.original_amount) === args.amount) {
    return {
      id: existing.id,
      original_amount: Number(existing.original_amount),
      from: existing.from_currency as Currency,
      to: existing.to_currency as Currency,
      rate: Number(existing.rate),
      converted_amount: Number(existing.converted_amount),
      source: existing.rate_source,
      fetched_at: existing.rate_fetched_at,
      valid_until: existing.rate_valid_until,
      locked_until: existing.locked_until,
      stale: false,
    };
  }
  return convert(db, {
    ...args,
    context: "payment",
    persist: true,
    lockMinutes: PAYMENT_LOCK_MINUTES,
  });
}
