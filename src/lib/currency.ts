/** Client-safe currency helpers. Amounts are integers in the smallest unit. */
export const CURRENCIES = ["EGP", "EUR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type RoundingRule = "half_up" | "down" | "up" | "whole_unit";

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

/** Round a fractional minor-unit amount according to the rule. */
export function roundMinor(value: number, rule: RoundingRule = "half_up"): number {
  switch (rule) {
    case "down":
      return Math.floor(value);
    case "up":
      return Math.ceil(value);
    case "whole_unit":
      return Math.round(value / 100) * 100;
    default:
      return Math.round(value);
  }
}

/** Converts minor units; returns null instead of ever using a zero/invalid rate. */
export function convertMinor(
  amount: number,
  rate: number,
  rule: RoundingRule = "half_up",
): number | null {
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return roundMinor(amount * rate, rule);
}

export function formatMoney(minor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 100);
}

export interface RateQuote {
  from: Currency;
  to: Currency;
  rate: number;
  source: string;
  fetched_at: string;
  valid_until: string;
  stale: boolean;
}
