/**
 * Price engine — pure, server-side, per apartment.
 *
 * Priority for one night (highest wins):
 *   1. manual day/range price (daily_prices.manual_override)
 *   2. current PriceLabs price (daily_prices.pricelabs_price, mode pricelabs|hybrid)
 *   3. manual season rule
 *   4. weekend price
 *   5. property base price
 *
 * Every resolved price is clamped into [minimum_price, maximum_price] and can never
 * be 0. Amounts are integers in the smallest currency unit.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PricingSettings = Database["public"]["Tables"]["property_pricing_settings"]["Row"];
export type DailyPriceRow = Database["public"]["Tables"]["daily_prices"]["Row"];
export type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];

export type PriceSource = "manual" | "pricelabs" | "pricelabs_override" | "season" | "weekend" | "base";

export type NightPrice = {
  date: string;
  /** Price before the direct-booking adjustment. */
  calculated: number;
  /** Price the guest actually pays for this night. */
  price: number;
  source: PriceSource;
  ruleName: string | null;
  pricelabsPrice: number | null;
  minimumStay: number;
  clamped: boolean;
  overrideReason: string | null;
  providerUpdatedAt: string | null;
};

export type StayQuote = {
  currency: string;
  nights: NightPrice[];
  nightCount: number;
  nightlyTotal: number;
  cleaningFee: number;
  extraGuestFee: number;
  discountAmount: number;
  discountLabel: string | null;
  totalAmount: number;
  minimumStay: number;
};

export function eachDate(from: string, toExclusive: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${toExclusive}T00:00:00Z`);
  while (d < end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 5 || day === 6; // Friday + Saturday nights
}

function clamp(value: number, settings: PricingSettings): { value: number; clamped: boolean } {
  const min = Math.max(1, settings.minimum_price);
  const max = Math.max(min, settings.maximum_price);
  if (value < min) return { value: min, clamped: true };
  if (value > max) return { value: max, clamped: true };
  return { value, clamped: false };
}

function applyRule(base: number, rule: PricingRule): number {
  const value = Number(rule.adjustment_value ?? 0);
  if (rule.adjustment_type === "percent") return Math.round(base * (1 + value / 100));
  if (rule.adjustment_type === "amount") return Math.round(base + value);
  return Math.round(value > 0 ? value : (rule.price ?? base));
}

function seasonRuleFor(date: string, rules: PricingRule[]): PricingRule | null {
  const matching = rules
    .filter(
      (r) =>
        r.active &&
        r.rule_type === "season" &&
        (!r.start_date || r.start_date <= date) &&
        (!r.end_date || r.end_date >= date),
    )
    .sort((a, b) => b.priority - a.priority);
  return matching[0] ?? null;
}

function overrideActive(row: DailyPriceRow, now: Date): boolean {
  if (!row.manual_override) return false;
  if (row.override_expires_at && new Date(row.override_expires_at) <= now) return false;
  return true;
}

/** Resolves the nightly price for one date, before the direct-booking adjustment. */
export function resolveNight(
  date: string,
  settings: PricingSettings,
  day: DailyPriceRow | undefined,
  rules: PricingRule[],
  now: Date = new Date(),
): NightPrice {
  const mode = settings.pricing_mode;
  const usesPricelabs = mode === "pricelabs" || mode === "hybrid";
  const pricelabsPrice = usesPricelabs ? (day?.pricelabs_price ?? null) : null;

  let raw = settings.base_price;
  let source: PriceSource = "base";
  let ruleName: string | null = null;

  const season = seasonRuleFor(date, rules);
  if (settings.weekend_price && isWeekend(date)) {
    raw = settings.weekend_price;
    source = "weekend";
  }
  if (season) {
    raw = applyRule(settings.base_price, season);
    source = "season";
    ruleName = season.name;
  }
  if (pricelabsPrice && pricelabsPrice > 0) {
    raw = pricelabsPrice;
    source = "pricelabs";
  }
  // Manual day/range price always wins — including over PriceLabs in hybrid mode.
  if (day && overrideActive(day, now) && day.final_price && day.final_price > 0) {
    raw = day.final_price;
    source = pricelabsPrice ? "pricelabs_override" : "manual";
  } else if (!usesPricelabs && day && day.final_price && day.final_price > 0) {
    raw = day.final_price;
    source = "manual";
  }

  const clamped = clamp(Math.max(1, Math.round(raw)), settings);

  return {
    date,
    calculated: clamped.value,
    price: clamped.value,
    source,
    ruleName,
    pricelabsPrice,
    minimumStay: day?.minimum_nights ?? settings.minimum_stay,
    clamped: clamped.clamped,
    overrideReason: day?.override_reason ?? null,
    providerUpdatedAt: day?.provider_updated_at ?? null,
  };
}

/** Direct-booking surcharge/discount — applied only after the nightly price exists. */
export function applyDirectAdjustment(amount: number, settings: PricingSettings): number {
  const percent = Number(settings.direct_booking_adjustment_percent ?? 0);
  const fixed = settings.direct_booking_adjustment_fixed ?? 0;
  const adjusted = Math.round(amount * (1 + percent / 100)) + fixed;
  return Math.max(1, adjusted);
}

export type PricingContext = {
  settings: PricingSettings;
  days: Map<string, DailyPriceRow>;
  rules: PricingRule[];
};

export async function loadPricingContext(
  db: SupabaseClient<Database>,
  propertyId: string,
  from: string,
  to: string,
): Promise<PricingContext | null> {
  const [settingsRes, daysRes, rulesRes] = await Promise.all([
    db.from("property_pricing_settings").select("*").eq("property_id", propertyId).maybeSingle(),
    db.from("daily_prices").select("*").eq("property_id", propertyId).gte("date", from).lte("date", to),
    db.from("pricing_rules").select("*").eq("property_id", propertyId).eq("active", true),
  ]);
  const settings = settingsRes.data as PricingSettings | null;
  if (!settings) return null;
  const days = new Map<string, DailyPriceRow>();
  for (const row of (daysRes.data ?? []) as DailyPriceRow[]) days.set(row.date, row);
  return { settings, days, rules: (rulesRes.data ?? []) as PricingRule[] };
}

/** Nightly prices for a date window, as shown in the calendar. */
export function priceCalendar(ctx: PricingContext, from: string, toExclusive: string): NightPrice[] {
  return eachDate(from, toExclusive).map((date) => {
    const night = resolveNight(date, ctx.settings, ctx.days.get(date), ctx.rules);
    return { ...night, price: applyDirectAdjustment(night.calculated, ctx.settings) };
  });
}

/** Full transparent quote for a stay. Stored as the immutable booking snapshot. */
export function quoteStay(
  ctx: PricingContext,
  checkin: string,
  checkout: string,
  guests: number,
): StayQuote {
  const s = ctx.settings;
  const nights = priceCalendar(ctx, checkin, checkout);
  const nightCount = nights.length;
  const nightlyTotal = nights.reduce((sum, n) => sum + n.price, 0);

  const extraGuests = Math.max(0, guests - s.extra_guest_after);
  const extraGuestFee = extraGuests * (s.extra_guest_fee ?? 0) * nightCount;

  let discountPercent = 0;
  let discountLabel: string | null = null;
  const los = s.length_of_stay_nights;
  if (los && nightCount >= los && Number(s.length_of_stay_discount_percent) > 0) {
    discountPercent = Number(s.length_of_stay_discount_percent);
    discountLabel = "length_of_stay";
  }
  if (nightCount >= 7 && Number(s.weekly_discount_percent) > discountPercent) {
    discountPercent = Number(s.weekly_discount_percent);
    discountLabel = "weekly";
  }
  if (nightCount >= 28 && Number(s.monthly_discount_percent) > discountPercent) {
    discountPercent = Number(s.monthly_discount_percent);
    discountLabel = "monthly";
  }
  const lastMinuteDays = s.last_minute_days;
  if (lastMinuteDays && Number(s.last_minute_discount_percent) > 0) {
    const daysAhead = Math.round(
      (new Date(`${checkin}T00:00:00Z`).getTime() - Date.now()) / 86_400_000,
    );
    if (daysAhead <= lastMinuteDays && Number(s.last_minute_discount_percent) > discountPercent) {
      discountPercent = Number(s.last_minute_discount_percent);
      discountLabel = "last_minute";
    }
  }

  const discountAmount = Math.round(nightlyTotal * (discountPercent / 100));
  const cleaningFee = s.cleaning_fee ?? 0;
  const totalAmount = Math.max(
    0,
    nightlyTotal + extraGuestFee + cleaningFee - discountAmount,
  );

  const minimumStay = nights.reduce((max, n) => Math.max(max, n.minimumStay), s.minimum_stay);

  return {
    currency: s.currency,
    nights,
    nightCount,
    nightlyTotal,
    cleaningFee,
    extraGuestFee,
    discountAmount,
    discountLabel,
    totalAmount,
    minimumStay,
  };
}
