/**
 * Server-only settlement engine.
 *
 * All money is handled as integers in the smallest currency unit. Every
 * settlement is computed here (never on the client) so owners cannot influence
 * fees, and confirmed bookings keep an immutable snapshot of the fee model and
 * the agreed services that were valid at confirmation time.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type CostBearer = "guest" | "owner" | "sunny_stays" | "split";
export type CalculationType =
  | "per_booking"
  | "per_stay"
  | "per_night"
  | "per_guest"
  | "per_cleaning"
  | "per_month"
  | "percent_revenue"
  | "percent_nightly"
  | "manual";

export interface ManagementAgreement {
  id: string;
  property_id: string;
  fee_type: "fixed_per_booking" | "fixed_monthly" | "percent" | "base_plus_percent" | "custom";
  percentage_rate: number;
  fixed_fee: number;
  minimum_fee: number;
  calculation_basis: "nightly" | "nightly_plus_cleaning" | "total_revenue";
  currency: string;
  valid_from: string;
  valid_until: string | null;
  notes: string | null;
  active: boolean;
}

export interface ServiceAgreementRow {
  id: string;
  property_id: string;
  service_id: string;
  provided_by_sunny_stays: boolean;
  included_in_management_fee: boolean;
  custom_price: number | null;
  currency: string;
  calculation_type: CalculationType;
  cost_bearer: CostBearer;
  automatic_charge: boolean;
  visible_to_owner: boolean;
  visible_to_guest: boolean;
  valid_from: string | null;
  valid_until: string | null;
  active: boolean;
  service?: { key: string; name: Record<string, string>; default_price: number; category: string };
}

export interface BookingLike {
  id: string;
  property_id: string;
  checkin: string;
  checkout: string;
  guests: number;
  currency: string;
  nightly_total: number | null;
  cleaning_fee: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  amount_paid: number | null;
  refund_amount: number | null;
  source: string;
  status: string;
  booking_number: string | null;
  financial_snapshot: unknown;
}

export function nightsBetween(from: string, to: string): number {
  return Math.max(
    1,
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000),
  );
}

/** Active agreement that is valid on the given date; latest valid_from wins. */
export function pickAgreement(
  rows: ManagementAgreement[],
  onDate: string,
): ManagementAgreement | null {
  const valid = rows
    .filter((r) => r.active && r.valid_from <= onDate && (!r.valid_until || r.valid_until >= onDate))
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from));
  return valid[0] ?? rows.find((r) => r.active) ?? null;
}

export function managementFee(
  agreement: ManagementAgreement | null,
  basis: { nightly: number; cleaning: number; total: number },
): number {
  if (!agreement) return 0;
  const base =
    agreement.calculation_basis === "total_revenue"
      ? basis.total
      : agreement.calculation_basis === "nightly_plus_cleaning"
        ? basis.nightly + basis.cleaning
        : basis.nightly;

  let fee = 0;
  switch (agreement.fee_type) {
    case "fixed_per_booking":
      fee = agreement.fixed_fee;
      break;
    case "fixed_monthly":
      // Monthly retainers are billed on the statement, not per booking.
      fee = 0;
      break;
    case "percent":
      fee = Math.round((base * Number(agreement.percentage_rate)) / 100);
      break;
    case "base_plus_percent":
      fee = agreement.fixed_fee + Math.round((base * Number(agreement.percentage_rate)) / 100);
      break;
    case "custom":
      fee = agreement.fixed_fee + Math.round((base * Number(agreement.percentage_rate)) / 100);
      break;
  }
  if (agreement.fee_type !== "fixed_monthly" && agreement.minimum_fee > 0) {
    fee = Math.max(fee, agreement.minimum_fee);
  }
  return Math.max(0, fee);
}

/** Price of one agreed service for a concrete booking. */
export function servicePrice(
  agreement: ServiceAgreementRow,
  booking: { nights: number; guests: number; nightly: number; total: number },
): { quantity: number; unitPrice: number; total: number } {
  const unit = agreement.custom_price ?? agreement.service?.default_price ?? 0;
  switch (agreement.calculation_type) {
    case "per_night":
      return { quantity: booking.nights, unitPrice: unit, total: unit * booking.nights };
    case "per_guest":
      return { quantity: booking.guests, unitPrice: unit, total: unit * booking.guests };
    case "percent_revenue":
      return { quantity: 1, unitPrice: unit, total: Math.round((booking.total * unit) / 10000) };
    case "percent_nightly":
      return { quantity: 1, unitPrice: unit, total: Math.round((booking.nightly * unit) / 10000) };
    case "per_month":
    case "manual":
      // Billed on the statement or entered by hand, never auto-charged per booking.
      return { quantity: 1, unitPrice: unit, total: 0 };
    default:
      return { quantity: 1, unitPrice: unit, total: unit };
  }
}

export interface ServiceItem {
  id?: string;
  service_id: string | null;
  description_snapshot: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  actual_cost: number | null;
  currency: string;
  cost_bearer: CostBearer;
  included_in_management_fee: boolean;
  status: string;
  notes?: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  receipt_url?: string | null;
}

export interface Settlement {
  currency: string;
  nightly_revenue: number;
  guest_cleaning: number;
  guest_services: number;
  gross_revenue: number;
  platform_fees: number;
  payment_fees: number;
  management_fee: number;
  owner_service_costs: number;
  refunds: number;
  adjustments: number;
  owner_net: number;
  amount_paid: number;
  open_amount: number;
  services: ServiceItem[];
  /** True when the numbers come from the immutable confirmation snapshot. */
  from_snapshot: boolean;
}

export interface SnapshotShape {
  currency: string;
  nightly_revenue: number;
  guest_cleaning: number;
  platform_fees: number;
  payment_fee_percent: number;
  management: ManagementAgreement | null;
  services: ServiceItem[];
  frozen_at: string;
}

/** Owner-borne share of a service item. Split means 50/50 with the guest. */
export function ownerShare(item: ServiceItem): number {
  if (item.status === "cancelled") return 0;
  if (item.included_in_management_fee) return 0; // already paid for by the commission
  const amount = item.actual_cost ?? item.total_price;
  switch (item.cost_bearer) {
    case "owner":
      return amount;
    case "split":
      return Math.round(amount / 2);
    default:
      return 0;
  }
}

export function guestShare(item: ServiceItem): number {
  if (item.status === "cancelled") return 0;
  const amount = item.total_price;
  if (item.cost_bearer === "guest") return amount;
  if (item.cost_bearer === "split") return amount - Math.round(amount / 2);
  return 0;
}

export function settle(args: {
  booking: BookingLike;
  services: ServiceItem[];
  management: ManagementAgreement | null;
  platformFees: number;
  paymentFeePercent: number;
  adjustments: number;
  snapshot?: SnapshotShape | null;
}): Settlement {
  const { booking } = args;
  const snap = args.snapshot ?? null;
  const services = snap?.services?.length ? snap.services : args.services;
  const management = snap ? snap.management : args.management;
  const currency = snap?.currency ?? booking.currency;

  const nightly = snap?.nightly_revenue ?? booking.nightly_total ?? 0;
  const cleaning = snap?.guest_cleaning ?? booking.cleaning_fee ?? 0;
  const guestServices = services.reduce((s, i) => s + guestShare(i), 0);
  const gross = (booking.total_amount ?? nightly + cleaning) + guestServices;

  const platform = snap?.platform_fees ?? args.platformFees;
  const feePercent = snap?.payment_fee_percent ?? args.paymentFeePercent;
  const paymentFees = Math.round(((booking.amount_paid ?? 0) * feePercent) / 100);
  const fee = managementFee(management, { nightly, cleaning, total: gross });
  const ownerServices = services.reduce((s, i) => s + ownerShare(i), 0);
  const refunds = booking.refund_amount ?? 0;

  const net =
    gross - platform - paymentFees - fee - ownerServices - refunds + args.adjustments;

  return {
    currency,
    nightly_revenue: nightly,
    guest_cleaning: cleaning,
    guest_services: guestServices,
    gross_revenue: gross,
    platform_fees: platform,
    payment_fees: paymentFees,
    management_fee: fee,
    owner_service_costs: ownerServices,
    refunds,
    adjustments: args.adjustments,
    owner_net: net,
    amount_paid: booking.amount_paid ?? 0,
    open_amount: Math.max(0, gross - (booking.amount_paid ?? 0)),
    services,
    from_snapshot: Boolean(snap),
  };
}

export interface BillingContext {
  management: ManagementAgreement | null;
  agreements: ServiceAgreementRow[];
  paymentFeePercent: number;
}

export async function loadBillingContext(
  admin: SupabaseClient<Database>,
  propertyId: string,
  onDate: string,
): Promise<BillingContext> {
  const [{ data: mgmt }, { data: agree }, { data: fin }] = await Promise.all([
    admin.from("property_management_agreements").select("*").eq("property_id", propertyId),
    admin
      .from("property_service_agreements")
      .select("*, service:service_catalog(key, name, default_price, category)")
      .eq("property_id", propertyId)
      .eq("active", true),
    admin
      .from("property_financial_settings")
      .select("payment_fee_percent")
      .eq("property_id", propertyId)
      .maybeSingle(),
  ]);

  const agreements = ((agree ?? []) as unknown as ServiceAgreementRow[]).filter(
    (a) =>
      (!a.valid_from || a.valid_from <= onDate) && (!a.valid_until || a.valid_until >= onDate),
  );

  return {
    management: pickAgreement((mgmt ?? []) as unknown as ManagementAgreement[], onDate),
    agreements,
    paymentFeePercent: Number(fin?.payment_fee_percent ?? 0),
  };
}

function localName(name: Record<string, string> | null | undefined, key: string): string {
  return name?.de ?? name?.en ?? key;
}

/**
 * Materialise the automatic services of a booking. Idempotent: services that
 * already exist for the booking are left untouched.
 */
export async function ensureBookingServices(
  admin: SupabaseClient<Database>,
  booking: BookingLike,
): Promise<ServiceItem[]> {
  const ctx = await loadBillingContext(admin, booking.property_id, booking.checkin);
  const { data: existing } = await admin
    .from("booking_service_items")
    .select("*")
    .eq("booking_id", booking.id);

  const have = new Set((existing ?? []).map((r) => r.service_id));
  const nights = nightsBetween(booking.checkin, booking.checkout);
  const basis = {
    nights,
    guests: booking.guests,
    nightly: booking.nightly_total ?? 0,
    total: booking.total_amount ?? 0,
  };

  const inserts = ctx.agreements
    .filter((a) => a.automatic_charge && a.provided_by_sunny_stays && !have.has(a.service_id))
    .map((a) => {
      const p = servicePrice(a, basis);
      return {
        booking_id: booking.id,
        property_id: booking.property_id,
        service_id: a.service_id,
        description_snapshot: localName(a.service?.name, a.service?.key ?? "service"),
        quantity: p.quantity,
        unit_price: p.unitPrice,
        total_price: p.total,
        currency: a.currency,
        cost_bearer: a.cost_bearer,
        included_in_management_fee: a.included_in_management_fee,
        status: "planned",
      };
    });

  if (inserts.length) await admin.from("booking_service_items").insert(inserts);

  const { data: all } = await admin
    .from("booking_service_items")
    .select("*")
    .eq("booking_id", booking.id)
    .order("created_at");
  return (all ?? []) as unknown as ServiceItem[];
}

/** Sum of manual corrections booked against a booking. */
export async function adjustmentsFor(
  admin: SupabaseClient<Database>,
  bookingId: string,
): Promise<number> {
  const { data } = await admin
    .from("booking_financial_items")
    .select("amount, direction, item_type")
    .eq("booking_id", bookingId)
    .eq("item_type", "adjustment");
  return (data ?? []).reduce(
    (s, r) => s + (r.direction === "debit" ? -r.amount : r.amount),
    0,
  );
}

export async function platformFeesFor(
  admin: SupabaseClient<Database>,
  bookingId: string,
): Promise<number> {
  const { data } = await admin
    .from("booking_financial_items")
    .select("amount")
    .eq("booking_id", bookingId)
    .eq("item_type", "platform_fee");
  return (data ?? []).reduce((s, r) => s + r.amount, 0);
}

/** Full server-side settlement of one booking. */
export async function settleBooking(
  admin: SupabaseClient<Database>,
  booking: BookingLike,
): Promise<Settlement> {
  const snap = (booking.financial_snapshot as unknown as SnapshotShape | null) ?? null;
  const usableSnap = snap && Array.isArray(snap.services) ? snap : null;
  const [{ data: services }, ctx, adjustments, platform] = await Promise.all([
    admin.from("booking_service_items").select("*").eq("booking_id", booking.id).order("created_at"),
    loadBillingContext(admin, booking.property_id, booking.checkin),
    adjustmentsFor(admin, booking.id),
    platformFeesFor(admin, booking.id),
  ]);

  const live = (services ?? []) as unknown as ServiceItem[];
  const base = settle({
    booking,
    services: live,
    management: ctx.management,
    platformFees: platform,
    paymentFeePercent: ctx.paymentFeePercent,
    adjustments,
    snapshot: usableSnap,
  });
  // Items added after confirmation (e.g. a repair) still count; the snapshot
  // only freezes the fee model and the services agreed at confirmation.
  if (usableSnap) {
    const frozenIds = new Set(usableSnap.services.map((s) => s.id));
    const extra = live.filter((s) => !frozenIds.has(s.id));
    if (extra.length) {
      const extraOwner = extra.reduce((s, i) => s + ownerShare(i), 0);
      const extraGuest = extra.reduce((s, i) => s + guestShare(i), 0);
      base.owner_service_costs += extraOwner;
      base.guest_services += extraGuest;
      base.gross_revenue += extraGuest;
      base.owner_net += extraGuest - extraOwner;
      base.services = [...usableSnap.services, ...extra];
    }
  }
  return base;
}

/**
 * Freeze fee model and agreed services on the booking. Called once when a
 * booking is confirmed; later price or commission changes never rewrite it.
 */
export async function freezeBookingSnapshot(
  admin: SupabaseClient<Database>,
  bookingId: string,
): Promise<void> {
  const { data: booking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return;
  const existing = booking.financial_snapshot as unknown as SnapshotShape | null;
  if (existing && Array.isArray(existing.services)) return; // never overwrite

  const b = booking as unknown as BookingLike;
  const services = await ensureBookingServices(admin, b);
  const ctx = await loadBillingContext(admin, b.property_id, b.checkin);
  const platform = await platformFeesFor(admin, bookingId);

  const snapshot: SnapshotShape = {
    currency: b.currency,
    nightly_revenue: b.nightly_total ?? 0,
    guest_cleaning: b.cleaning_fee ?? 0,
    platform_fees: platform,
    payment_fee_percent: ctx.paymentFeePercent,
    management: ctx.management,
    services,
    frozen_at: new Date().toISOString(),
  };

  await admin
    .from("bookings")
    .update({ financial_snapshot: snapshot as never })
    .eq("id", bookingId);

  const s = settle({
    booking: b,
    services,
    management: ctx.management,
    platformFees: platform,
    paymentFeePercent: ctx.paymentFeePercent,
    adjustments: 0,
    snapshot,
  });

  await admin.from("booking_financial_items").insert([
    {
      booking_id: bookingId,
      property_id: b.property_id,
      item_type: "nightly_revenue",
      description: "Übernachtungsumsatz",
      amount: s.nightly_revenue,
      currency: s.currency,
      direction: "credit",
      charged_to: "guest",
      source: "system",
      immutable_snapshot: true,
    },
    {
      booking_id: bookingId,
      property_id: b.property_id,
      item_type: "management_fee",
      description: "Sunny-Stays-Vermietungsprovision",
      amount: s.management_fee,
      currency: s.currency,
      direction: "debit",
      charged_to: "owner",
      source: "system",
      immutable_snapshot: true,
    },
  ]);
}
