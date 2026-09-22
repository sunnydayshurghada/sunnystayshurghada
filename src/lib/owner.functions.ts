import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const rangeInput = z.object({
  from: dateStr,
  to: dateStr,
  propertyId: z.string().uuid().nullish(),
});

export interface OwnerProperty {
  id: string;
  name: string;
  area: string | null;
  status: string;
  currency: string;
  image: string | null;
  permissions: {
    bookings: boolean;
    guest_contact: boolean;
    financials: boolean;
    payments: boolean;
    calendar: boolean;
    blocks: boolean;
    prices: boolean;
  };
  share: number | null;
  occupiedToday: boolean;
  nextArrival: string | null;
  nextDeparture: string | null;
  bookingsInRange: number;
  nightsBooked: number;
  occupancy: number;
  revenue: number | null;
  syncError: string | null;
}

export interface OwnerOverview {
  profile: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    role: string;
    language: string;
  };
  isStaff: boolean;
  totals: {
    properties: number;
    currentGuests: number;
    newInquiries: number;
    confirmed: number;
    cancelled: number;
    nightsBooked: number;
    nightsAvailable: number;
    occupancy: number;
    revenue: number;
    paid: number;
    open: number;
    refunds: number;
    currency: string;
    financialsVisible: boolean;
  };
  arrivals: { property: string; date: string; guests: number; booking: string | null }[];
  departures: { property: string; date: string; guests: number; booking: string | null }[];
  properties: OwnerProperty[];
}

function days(from: string, to: string): number {
  return Math.max(
    0,
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000),
  );
}

function overlapNights(aFrom: string, aTo: string, bFrom: string, bTo: string): number {
  const s = aFrom > bFrom ? aFrom : bFrom;
  const e = aTo < bTo ? aTo : bTo;
  return e > s ? days(s, e) : 0;
}

export const getOwnerOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rangeInput.parse(input))
  .handler(async ({ data, context }): Promise<OwnerOverview | { error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAccess, allowedProperties } = await import("@/lib/owner-access.server");
    const access = await loadAccess(supabaseAdmin, context.userId);
    if (!access.active) return { error: "account_disabled" };
    const ids = allowedProperties(access, data.propertyId);
    if (ids.length === 0) return { error: "no_properties" };

    const today = new Date().toISOString().slice(0, 10);

    const [{ data: props }, { data: bookings }, { data: images }, { data: integrations }] =
      await Promise.all([
        supabaseAdmin.from("properties").select("*").in("id", ids).order("sort_order"),
        supabaseAdmin
          .from("bookings")
          .select("*")
          .in("property_id", ids)
          .order("checkin"),
        supabaseAdmin
          .from("property_images")
          .select("property_id, url, is_cover, sort_order")
          .in("property_id", ids)
          .order("sort_order"),
        supabaseAdmin
          .from("calendar_integrations")
          .select("property_id, last_sync_status, last_sync_error")
          .in("property_id", ids),
      ]);

    const rangeNights = days(data.from, data.to);
    const overview: OwnerOverview = {
      profile: {
        firstName: access.firstName,
        lastName: access.lastName,
        email: access.email,
        phone: access.phone,
        role: access.role,
        language: access.language,
      },
      isStaff: access.isStaff,
      totals: {
        properties: ids.length,
        currentGuests: 0,
        newInquiries: 0,
        confirmed: 0,
        cancelled: 0,
        nightsBooked: 0,
        nightsAvailable: 0,
        occupancy: 0,
        revenue: 0,
        paid: 0,
        open: 0,
        refunds: 0,
        currency: props?.[0]?.currency ?? "EUR",
        financialsVisible: false,
      },
      arrivals: [],
      departures: [],
      properties: [],
    };

    for (const p of props ?? []) {
      const a = access.assignments.get(p.id)!;
      const perms = {
        bookings: a.can_view_bookings,
        guest_contact: a.can_view_guest_contact_data,
        financials: a.can_view_financials,
        payments: a.can_view_payments,
        calendar: a.can_view_calendar,
        blocks: a.can_create_calendar_blocks,
        prices: a.can_manage_prices,
      };
      if (perms.financials) overview.totals.financialsVisible = true;

      const mine = (bookings ?? []).filter((b) => b.property_id === p.id);
      const confirmed = mine.filter((b) => b.status === "confirmed");
      const inRange = confirmed.filter(
        (b) => overlapNights(b.checkin, b.checkout, data.from, data.to) > 0,
      );
      const nights = inRange.reduce(
        (n, b) => n + overlapNights(b.checkin, b.checkout, data.from, data.to),
        0,
      );
      const revenue = inRange.reduce((s, b) => s + (b.total_amount ?? 0), 0);
      const paid = inRange.reduce((s, b) => s + (b.amount_paid ?? 0), 0);
      const refunds = mine
        .filter((b) => b.cancelled_at && b.cancelled_at.slice(0, 10) >= data.from)
        .reduce((s, b) => s + (b.refund_amount ?? 0), 0);

      overview.totals.currentGuests += confirmed.filter(
        (b) => b.checkin <= today && b.checkout > today,
      ).length;
      overview.totals.newInquiries += mine.filter(
        (b) =>
          b.status === "pending" && b.created_at.slice(0, 10) >= data.from &&
          b.created_at.slice(0, 10) < data.to,
      ).length;
      overview.totals.confirmed += inRange.length;
      overview.totals.cancelled += mine.filter(
        (b) =>
          ["cancelled", "rejected"].includes(b.status) &&
          (b.cancelled_at ?? b.updated_at).slice(0, 10) >= data.from &&
          (b.cancelled_at ?? b.updated_at).slice(0, 10) < data.to,
      ).length;
      overview.totals.nightsBooked += nights;
      if (perms.financials) {
        overview.totals.revenue += revenue;
        overview.totals.paid += paid;
        overview.totals.open += Math.max(0, revenue - paid);
        overview.totals.refunds += refunds;
      }

      const upcoming = confirmed.filter((b) => b.checkin >= today).slice(0, 3);
      for (const b of upcoming) {
        overview.arrivals.push({
          property: p.public_name,
          date: b.checkin,
          guests: b.guests,
          booking: b.booking_number,
        });
      }
      for (const b of confirmed.filter((b) => b.checkout >= today).slice(0, 3)) {
        overview.departures.push({
          property: p.public_name,
          date: b.checkout,
          guests: b.guests,
          booking: b.booking_number,
        });
      }

      const cover =
        (images ?? []).find((i) => i.property_id === p.id && i.is_cover) ??
        (images ?? []).find((i) => i.property_id === p.id);
      const integ = (integrations ?? []).find((i) => i.property_id === p.id);

      overview.properties.push({
        id: p.id,
        name: p.public_name,
        area: p.area,
        status: p.status,
        currency: p.currency,
        image: cover?.url ?? null,
        permissions: perms,
        share: a.ownership_share_percent,
        occupiedToday: confirmed.some((b) => b.checkin <= today && b.checkout > today),
        nextArrival: confirmed.find((b) => b.checkin >= today)?.checkin ?? null,
        nextDeparture: confirmed.find((b) => b.checkout >= today)?.checkout ?? null,
        bookingsInRange: inRange.length,
        nightsBooked: nights,
        occupancy: rangeNights ? Math.round((nights / rangeNights) * 100) : 0,
        revenue: perms.financials ? revenue : null,
        syncError: integ?.last_sync_status === "error" ? (integ.last_sync_error ?? "error") : null,
      });
    }

    overview.arrivals.sort((a, b) => a.date.localeCompare(b.date));
    overview.departures.sort((a, b) => a.date.localeCompare(b.date));
    overview.arrivals = overview.arrivals.slice(0, 6);
    overview.departures = overview.departures.slice(0, 6);
    overview.totals.nightsAvailable = Math.max(
      0,
      rangeNights * ids.length - overview.totals.nightsBooked,
    );
    overview.totals.occupancy = rangeNights
      ? Math.round((overview.totals.nightsBooked / (rangeNights * ids.length)) * 100)
      : 0;
    return overview;
  });

export interface OwnerBooking {
  id: string;
  booking_number: string | null;
  property: string;
  property_id: string;
  checkin: string;
  checkout: string;
  nights: number;
  guests: number;
  source: string;
  status: string;
  payment_status: string;
  currency: string;
  total_amount: number | null;
  cleaning_fee: number | null;
  discount_amount: number | null;
  amount_paid: number | null;
  refund_amount: number | null;
  refund_status: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  financials: {
    gross: number;
    cleaning: number;
    discount: number;
    payment_fee: number;
    commission: number;
    refunds: number;
    net: number;
  } | null;
}

const bookingFilter = rangeInput.extend({
  status: z.string().nullish(),
  paymentStatus: z.string().nullish(),
  source: z.string().nullish(),
  onlyCancelled: z.boolean().nullish(),
});

async function ownerBookingList(
  userId: string,
  data: z.infer<typeof bookingFilter>,
): Promise<OwnerBooking[] | { error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { loadAccess, allowedProperties } = await import("@/lib/owner-access.server");
  const access = await loadAccess(supabaseAdmin, userId);
  if (!access.active) return { error: "account_disabled" };
  const ids = allowedProperties(access, data.propertyId).filter(
    (id) => access.assignments.get(id)?.can_view_bookings,
  );
  if (ids.length === 0) return { error: "no_properties" };

  const [{ data: rows }, { data: props }, { data: fin }] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("*")
      .in("property_id", ids)
      .lt("checkin", data.to)
      .gte("checkout", data.from)
      .order("checkin", { ascending: false }),
    supabaseAdmin.from("properties").select("id, public_name").in("id", ids),
    supabaseAdmin.from("property_financial_settings").select("*").in("property_id", ids),
  ]);

  const nameOf = new Map((props ?? []).map((p) => [p.id, p.public_name]));
  const out: OwnerBooking[] = [];

  for (const b of rows ?? []) {
    if (data.onlyCancelled && !["cancelled", "rejected"].includes(b.status)) continue;
    if (data.status && b.status !== data.status) continue;
    if (data.paymentStatus && b.payment_status !== data.paymentStatus) continue;
    if (data.source && b.source !== data.source) continue;

    const a = access.assignments.get(b.property_id)!;
    const showGuest = a.can_view_guest_contact_data;
    const showMoney = a.can_view_financials;
    const settings = (fin ?? []).find((f) => f.property_id === b.property_id);

    // Immutable financial snapshot wins; it is written when the booking is
    // confirmed so later commission changes never rewrite history.
    const snap = (b.financial_snapshot as Record<string, number> | null) ?? null;
    const gross = b.total_amount ?? 0;
    const commission = snap
      ? snap.commission
      : Math.round((gross * Number(settings?.commission_percent ?? 0)) / 100) +
        Number(settings?.commission_fixed ?? 0);
    const fee = snap
      ? snap.payment_fee
      : Math.round((b.amount_paid ?? 0) * Number(settings?.payment_fee_percent ?? 0)) / 100;

    out.push({
      id: b.id,
      booking_number: b.booking_number,
      property: nameOf.get(b.property_id) ?? "",
      property_id: b.property_id,
      checkin: b.checkin,
      checkout: b.checkout,
      nights: days(b.checkin, b.checkout),
      guests: b.guests,
      source: b.source,
      status: b.status,
      payment_status: b.payment_status,
      currency: b.currency,
      total_amount: showMoney ? gross : null,
      cleaning_fee: showMoney ? b.cleaning_fee : null,
      discount_amount: showMoney ? b.discount_amount : null,
      amount_paid: showMoney ? b.amount_paid : null,
      refund_amount: showMoney ? b.refund_amount : null,
      refund_status: b.refund_status,
      cancelled_at: b.cancelled_at,
      cancellation_reason: b.cancellation_reason,
      cancelled_by: b.cancelled_by,
      guest_name: showGuest ? b.guest_name : null,
      guest_email: showGuest ? b.guest_email : null,
      guest_phone: showGuest ? b.guest_phone : null,
      financials: showMoney
        ? {
            gross,
            cleaning: b.cleaning_fee ?? 0,
            discount: b.discount_amount ?? 0,
            payment_fee: Math.round(fee),
            commission: Math.round(commission),
            refunds: b.refund_amount ?? 0,
            net: Math.round(gross - commission - fee - (b.refund_amount ?? 0)),
          }
        : null,
    });
  }
  return out;
}

export const getOwnerBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bookingFilter.parse(input))
  .handler(async ({ data, context }) => ownerBookingList(context.userId, data));

export interface OwnerCalendarEntry {
  property_id: string;
  property: string;
  start: string;
  end: string;
  kind: "confirmed" | "inquiry" | "airbnb" | "manual" | "block" | "cancelled";
  label: string | null;
}

export const getOwnerCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rangeInput.parse(input))
  .handler(async ({ data, context }): Promise<OwnerCalendarEntry[] | { error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAccess, allowedProperties } = await import("@/lib/owner-access.server");
    const access = await loadAccess(supabaseAdmin, context.userId);
    if (!access.active) return { error: "account_disabled" };
    const ids = allowedProperties(access, data.propertyId).filter(
      (id) => access.assignments.get(id)?.can_view_calendar,
    );
    if (ids.length === 0) return { error: "no_properties" };

    const [{ data: props }, { data: bookings }, { data: blocks }] = await Promise.all([
      supabaseAdmin.from("properties").select("id, public_name").in("id", ids),
      supabaseAdmin
        .from("bookings")
        .select("property_id, checkin, checkout, status, source, booking_number")
        .in("property_id", ids)
        .lt("checkin", data.to)
        .gte("checkout", data.from),
      supabaseAdmin
        .from("calendar_blocks")
        .select("property_id, start_date, end_date, entry_type, source, note, external_uid")
        .in("property_id", ids)
        .lt("start_date", data.to)
        .gte("end_date", data.from),
    ]);
    const nameOf = new Map((props ?? []).map((p) => [p.id, p.public_name]));
    const entries: OwnerCalendarEntry[] = [];

    for (const b of bookings ?? []) {
      const kind =
        b.status === "confirmed"
          ? "confirmed"
          : ["cancelled", "rejected"].includes(b.status)
            ? "cancelled"
            : "inquiry";
      entries.push({
        property_id: b.property_id,
        property: nameOf.get(b.property_id) ?? "",
        start: b.checkin,
        end: b.checkout,
        kind,
        label: b.booking_number,
      });
    }
    for (const c of blocks ?? []) {
      const kind = c.external_uid
        ? "airbnb"
        : c.entry_type === "booking"
          ? "manual"
          : "block";
      entries.push({
        property_id: c.property_id,
        property: nameOf.get(c.property_id) ?? "",
        start: c.start_date,
        end: c.end_date,
        kind,
        label: c.note || null,
      });
    }
    return entries.sort((a, b) => a.start.localeCompare(b.start));
  });

export const createOwnerBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        start_date: dateStr,
        end_date: dateStr,
        note: z.string().trim().max(500).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAccess, auditLog } = await import("@/lib/owner-access.server");
    const access = await loadAccess(supabaseAdmin, context.userId);
    const a = access.assignments.get(data.propertyId);
    if (!access.active || !a?.can_create_calendar_blocks) return { error: "forbidden" };
    if (data.end_date <= data.start_date) return { error: "invalid_range" };

    const { error } = await supabaseAdmin.from("calendar_blocks").insert({
      property_id: data.propertyId,
      start_date: data.start_date,
      end_date: data.end_date,
      entry_type: "block",
      source: "other",
      note: data.note || "Eigentümer-Sperrzeit",
      created_by: context.userId,
    });
    if (error) {
      return { error: error.message.includes("dates_unavailable") ? "dates_unavailable" : "generic" };
    }
    await auditLog(supabaseAdmin, {
      actorId: context.userId,
      actorEmail: access.email,
      propertyId: data.propertyId,
      action: "calendar_block_created",
      detail: { start: data.start_date, end: data.end_date, note: data.note },
    });
    // The central booking desk must see owner-created blocks.
    try {
      const { notifyOperational } = await import("@/lib/notifications.server");
      await notifyOperational(
        "calendar_conflict",
        data.propertyId,
        `Eigentümer-Sperrzeit eingetragen: ${data.start_date} – ${data.end_date} (${access.email ?? context.userId})`,
      );
    } catch (e) {
      console.error("[owner] block notice failed", e);
    }
    return { ok: true };
  });

export const updateOwnProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        first_name: z.string().trim().max(80),
        last_name: z.string().trim().max(80),
        phone: z.string().trim().max(40).nullish(),
        preferred_language: z.enum(["de", "en", "ar"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { error } = await context.supabase
      .from("user_profiles")
      .update({ ...data, phone: data.phone ?? null })
      .eq("user_id", context.userId);
    return error ? { error: "generic" } : { ok: true };
  });

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV export, restricted to the caller's own properties and permissions. */
export const exportOwnerCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    bookingFilter.extend({ kind: z.enum(["bookings", "cancellations"]) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ csv: string } | { error: string }> => {
    const rows = await ownerBookingList(context.userId, {
      ...data,
      onlyCancelled: data.kind === "cancellations",
    });
    if ("error" in rows) return rows;

    const header = [
      "booking_number",
      "property",
      "checkin",
      "checkout",
      "nights",
      "guests",
      "source",
      "status",
      "payment_status",
      "currency",
      "total_amount",
      "cleaning_fee",
      "discount_amount",
      "amount_paid",
      "refund_amount",
      "refund_status",
      "cancelled_at",
      "cancellation_reason",
      "guest_name",
      "guest_email",
      "guest_phone",
    ];
    const body = rows.map((r) =>
      header.map((h) => csvCell((r as unknown as Record<string, unknown>)[h])).join(";"),
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAccess, auditLog } = await import("@/lib/owner-access.server");
    const access = await loadAccess(supabaseAdmin, context.userId);
    await auditLog(supabaseAdmin, {
      actorId: context.userId,
      actorEmail: access.email,
      action: "data_export",
      target: data.kind,
      detail: { from: data.from, to: data.to, rows: rows.length },
    });

    return { csv: [header.join(";"), ...body].join("\n") };
  });
