/**
 * Admin server functions for fees, services, booking settlements, owner
 * statements and payouts. Every handler verifies staff role server-side and
 * writes an audit entry with old and new values.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Settlement } from "@/lib/billing.server";

async function isStaff(db: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r) =>
    ["admin", "super_admin", "booking_manager"].includes(r.role as string),
  );
}

const CALC = [
  "per_booking",
  "per_stay",
  "per_night",
  "per_guest",
  "per_cleaning",
  "per_month",
  "percent_revenue",
  "percent_nightly",
  "manual",
] as const;
const BEARER = ["guest", "owner", "sunny_stays", "split"] as const;

export interface BillingOverview {
  catalog: {
    id: string;
    key: string;
    name: Record<string, string>;
    description: string | null;
    category: string;
    default_price: number;
    currency: string;
    calculation_type: string;
    tax_percent: number;
    default_cost_bearer: string;
    publicly_visible: boolean;
    active: boolean;
  }[];
  agreements: Record<string, unknown>[];
  management: Record<string, unknown>[];
  bookings: {
    id: string;
    booking_number: string | null;
    property_id: string;
    checkin: string;
    checkout: string;
    status: string;
    guest_name: string;
    currency: string;
    settlement: Settlement;
  }[];
  statements: Record<string, unknown>[];
  payouts: Record<string, unknown>[];
  owners: { user_id: string; name: string; email: string; property_id: string }[];
}

export const getBillingOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ propertyId: z.string().uuid().nullish() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<BillingOverview | { error: string }> => {
    if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { settleBooking } = await import("@/lib/billing.server");
    const pid = data.propertyId ?? null;

    const q = <T extends { eq: (c: string, v: string) => T }>(builder: T): T =>
      pid ? builder.eq("property_id", pid) : builder;

    const [catalog, agreements, management, bookings, statements, payouts, assignments] =
      await Promise.all([
        supabaseAdmin.from("service_catalog").select("*").order("sort_order"),
        q(
          supabaseAdmin
            .from("property_service_agreements")
            .select("*, service:service_catalog(key, name, category, default_price)") as never,
        ) as never as Promise<{ data: Record<string, unknown>[] | null }>,
        q(
          supabaseAdmin.from("property_management_agreements").select("*") as never,
        ) as never as Promise<{ data: Record<string, unknown>[] | null }>,
        q(
          supabaseAdmin
            .from("bookings")
            .select("*")
            .in("status", ["confirmed", "cancelled"])
            .order("checkin", { ascending: false })
            .limit(60) as never,
        ) as never as Promise<{ data: Record<string, unknown>[] | null }>,
        q(
          supabaseAdmin
            .from("owner_statements")
            .select("*")
            .order("period_start", { ascending: false })
            .limit(50) as never,
        ) as never as Promise<{ data: Record<string, unknown>[] | null }>,
        q(
          supabaseAdmin
            .from("owner_payouts")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50) as never,
        ) as never as Promise<{ data: Record<string, unknown>[] | null }>,
        q(
          supabaseAdmin
            .from("property_user_assignments")
            .select("user_id, property_id")
            .eq("active", true) as never,
        ) as never as Promise<{ data: { user_id: string; property_id: string }[] | null }>,
      ]);

    const rows = (bookings.data ?? []) as unknown as Parameters<typeof settleBooking>[1][];
    const settled = [];
    for (const b of rows) {
      const settlement = await settleBooking(supabaseAdmin, b);
      const raw = b as unknown as Record<string, string>;
      settled.push({
        id: b.id,
        booking_number: b.booking_number,
        property_id: b.property_id,
        checkin: b.checkin,
        checkout: b.checkout,
        status: b.status,
        guest_name: raw.guest_name ?? "",
        currency: b.currency,
        settlement,
      });
    }

    const ownerIds = [...new Set((assignments.data ?? []).map((a) => a.user_id))];
    const { data: profiles } = ownerIds.length
      ? await supabaseAdmin
          .from("user_profiles")
          .select("user_id, first_name, last_name, email")
          .in("user_id", ownerIds)
      : { data: [] };

    return {
      catalog: (catalog.data ?? []) as never,
      agreements: agreements.data ?? [],
      management: management.data ?? [],
      bookings: settled as never,
      statements: statements.data ?? [],
      payouts: payouts.data ?? [],
      owners: (assignments.data ?? []).map((a) => {
        const p = (profiles ?? []).find((x) => x.user_id === a.user_id);
        return {
          user_id: a.user_id,
          property_id: a.property_id,
          name: p ? `${p.first_name} ${p.last_name}`.trim() || p.email : a.user_id,
          email: p?.email ?? "",
        };
      }),
    };
  });

async function audit(
  admin: SupabaseClient<Database>,
  userId: string,
  entry: {
    propertyId?: string | null;
    action: string;
    target?: string | null;
    before?: unknown;
    after?: unknown;
    reason?: string | null;
  },
) {
  const { auditLog } = await import("@/lib/owner-access.server");
  await auditLog(admin, {
    actorId: userId,
    actorEmail: null,
    propertyId: entry.propertyId ?? null,
    action: entry.action,
    target: entry.target ?? null,
    detail: {
      before: entry.before ?? null,
      after: entry.after ?? null,
      reason: entry.reason ?? null,
    },
  });
}

/* ------------------------- catalogue ------------------------- */

export const saveCatalogService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        key: z.string().trim().min(2).max(60),
        name: z.record(z.string(), z.string()),
        description: z.string().trim().max(500).nullish(),
        category: z.string().trim().max(40).default("other"),
        default_price: z.number().int().min(0).default(0),
        currency: z.enum(["EUR", "EGP"]).default("EUR"),
        calculation_type: z.enum(CALC),
        tax_percent: z.number().min(0).max(100).default(0),
        default_cost_bearer: z.enum(BEARER),
        publicly_visible: z.boolean().default(false),
        active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...row } = data;
    let before: unknown = null;
    if (id) {
      const { data: prev } = await supabaseAdmin
        .from("service_catalog")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      before = prev;
    }
    const { error } = id
      ? await supabaseAdmin.from("service_catalog").update(row as never).eq("id", id)
      : await supabaseAdmin.from("service_catalog").insert(row as never);
    if (error) return { error: error.message.includes("duplicate") ? "duplicate" : "generic" };
    await audit(supabaseAdmin, context.userId, {
      action: id ? "service_updated" : "service_created",
      target: data.key,
      before,
      after: row,
    });
    return { ok: true };
  });

/* ------------------------- property agreements ------------------------- */

export const saveServiceAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        property_id: z.string().uuid(),
        service_id: z.string().uuid(),
        provided_by_sunny_stays: z.boolean().default(true),
        included_in_management_fee: z.boolean().default(false),
        custom_price: z.number().int().min(0).nullish(),
        currency: z.enum(["EUR", "EGP"]).default("EUR"),
        calculation_type: z.enum(CALC),
        cost_bearer: z.enum(BEARER),
        automatic_charge: z.boolean().default(false),
        visible_to_owner: z.boolean().default(true),
        visible_to_guest: z.boolean().default(false),
        valid_from: z.string().nullish(),
        valid_until: z.string().nullish(),
        notes: z.string().trim().max(500).nullish(),
        active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...row } = data;
    const { data: before } = id
      ? await supabaseAdmin
          .from("property_service_agreements")
          .select("*")
          .eq("id", id)
          .maybeSingle()
      : { data: null };
    const { error } = id
      ? await supabaseAdmin.from("property_service_agreements").update(row as never).eq("id", id)
      : await supabaseAdmin
          .from("property_service_agreements")
          .upsert(row as never, { onConflict: "property_id,service_id" });
    if (error) return { error: "generic" };
    await audit(supabaseAdmin, context.userId, {
      propertyId: data.property_id,
      action: "service_agreement_saved",
      target: data.service_id,
      before,
      after: row,
    });
    return { ok: true };
  });

export const deleteServiceAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("property_service_agreements")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    await supabaseAdmin.from("property_service_agreements").delete().eq("id", data.id);
    await audit(supabaseAdmin, context.userId, {
      propertyId: (before as { property_id?: string } | null)?.property_id ?? null,
      action: "service_agreement_removed",
      target: data.id,
      before,
    });
    return { ok: true };
  });

export const saveManagementAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        property_id: z.string().uuid(),
        fee_type: z.enum(["fixed_per_booking", "fixed_monthly", "percent", "base_plus_percent", "custom"]),
        percentage_rate: z.number().min(0).max(100).default(0),
        fixed_fee: z.number().int().min(0).default(0),
        minimum_fee: z.number().int().min(0).default(0),
        calculation_basis: z.enum(["nightly", "nightly_plus_cleaning", "total_revenue"]),
        currency: z.enum(["EUR", "EGP"]).default("EUR"),
        valid_from: z.string(),
        valid_until: z.string().nullish(),
        notes: z.string().trim().max(1000).nullish(),
        active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...row } = data;
    const { data: before } = id
      ? await supabaseAdmin
          .from("property_management_agreements")
          .select("*")
          .eq("id", id)
          .maybeSingle()
      : { data: null };
    const { error } = id
      ? await supabaseAdmin.from("property_management_agreements").update(row as never).eq("id", id)
      : await supabaseAdmin.from("property_management_agreements").insert(row as never);
    if (error) return { error: "generic" };
    await audit(supabaseAdmin, context.userId, {
      propertyId: data.property_id,
      action: "management_agreement_saved",
      target: id ?? "new",
      before,
      after: row,
    });
    return { ok: true };
  });

/* ------------------------- booking services ------------------------- */

export const getBookingBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<
      | { settlement: Settlement; items: Record<string, unknown>[]; ledger: Record<string, unknown>[] }
      | { error: string }
    > => {
      if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { settleBooking, ensureBookingServices } = await import("@/lib/billing.server");
      const { data: booking } = await supabaseAdmin
        .from("bookings")
        .select("*")
        .eq("id", data.bookingId)
        .maybeSingle();
      if (!booking) return { error: "not_found" };
      await ensureBookingServices(supabaseAdmin, booking as never);
      const settlement = await settleBooking(supabaseAdmin, booking as never);
      const [{ data: items }, { data: ledger }] = await Promise.all([
        supabaseAdmin
          .from("booking_service_items")
          .select("*")
          .eq("booking_id", data.bookingId)
          .order("created_at"),
        supabaseAdmin
          .from("booking_financial_items")
          .select("*")
          .eq("booking_id", data.bookingId)
          .order("created_at"),
      ]);
      return { settlement, items: (items ?? []) as never, ledger: (ledger ?? []) as never };
    },
  );

export const saveBookingServiceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        booking_id: z.string().uuid(),
        property_id: z.string().uuid(),
        service_id: z.string().uuid().nullish(),
        description_snapshot: z.string().trim().min(1).max(200),
        quantity: z.number().min(0).max(1000).default(1),
        unit_price: z.number().int().min(0).default(0),
        actual_cost: z.number().int().min(0).nullish(),
        currency: z.enum(["EUR", "EGP"]).default("EUR"),
        cost_bearer: z.enum(BEARER),
        included_in_management_fee: z.boolean().default(false),
        status: z.enum(["planned", "done", "cancelled"]).default("planned"),
        completed_by: z.string().trim().max(120).nullish(),
        notes: z.string().trim().max(500).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...row } = data;
    const total = Math.round(row.quantity * row.unit_price);
    const payload = {
      ...row,
      total_price: total,
      completed_at: row.status === "done" ? new Date().toISOString() : null,
    };
    const { data: before } = id
      ? await supabaseAdmin.from("booking_service_items").select("*").eq("id", id).maybeSingle()
      : { data: null };
    const { error } = id
      ? await supabaseAdmin.from("booking_service_items").update(payload as never).eq("id", id)
      : await supabaseAdmin.from("booking_service_items").insert(payload as never);
    if (error) return { error: "generic" };
    await audit(supabaseAdmin, context.userId, {
      propertyId: data.property_id,
      action: id ? "booking_service_changed" : "booking_service_added",
      target: data.booking_id,
      before,
      after: payload,
    });
    return { ok: true };
  });

export const deleteBookingServiceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("booking_service_items")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    await supabaseAdmin.from("booking_service_items").delete().eq("id", data.id);
    await audit(supabaseAdmin, context.userId, {
      propertyId: (before as { property_id?: string } | null)?.property_id ?? null,
      action: "booking_service_removed",
      target: data.id,
      before,
    });
    return { ok: true };
  });

/** Manual correction; always a separate, reasoned line, never a silent edit. */
export const addFinancialAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        booking_id: z.string().uuid().nullish(),
        property_id: z.string().uuid(),
        item_type: z.enum(["adjustment", "platform_fee"]).default("adjustment"),
        description: z.string().trim().min(2).max(200),
        amount: z.number().int(),
        currency: z.enum(["EUR", "EGP"]).default("EUR"),
        direction: z.enum(["credit", "debit"]),
        charged_to: z.enum(BEARER).default("owner"),
        reason: z.string().trim().min(2).max(500),
        source_currency: z.enum(["EUR", "EGP"]).nullish(),
        source_amount: z.number().int().nullish(),
        exchange_rate: z.number().positive().nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("booking_financial_items").insert({
      ...data,
      booking_id: data.booking_id ?? null,
      amount: Math.abs(data.amount),
      exchange_rate_at: data.exchange_rate ? new Date().toISOString() : null,
      source: "manual",
      created_by: context.userId,
    } as never);
    if (error) return { error: "generic" };
    await audit(supabaseAdmin, context.userId, {
      propertyId: data.property_id,
      action: "financial_adjustment",
      target: data.booking_id ?? data.property_id,
      after: data,
      reason: data.reason,
    });
    return { ok: true };
  });

/* ------------------------- statements & payouts ------------------------- */

export const generateStatements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        period_start: z.string(),
        period_end: z.string(),
        propertyId: z.string().uuid().nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; created: number } | { error: string }> => {
    if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildStatement } = await import("@/lib/statements.server");
    const created = await buildStatement(supabaseAdmin, {
      periodStart: data.period_start,
      periodEnd: data.period_end,
      propertyId: data.propertyId ?? null,
      actorId: context.userId,
    });
    return { ok: true, created };
  });

export const setStatementStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "in_review", "approved", "paid", "corrected"]),
        reason: z.string().trim().max(500).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("owner_statements")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!before) return { error: "not_found" };
    const patch: Record<string, unknown> = { status: data.status };
    if (["approved", "paid", "corrected"].includes(data.status)) {
      patch.finalized_at = before.finalized_at ?? new Date().toISOString();
    }
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("owner_statements")
      .update(patch as never)
      .eq("id", data.id);
    if (error) return { error: "generic" };
    await audit(supabaseAdmin, context.userId, {
      propertyId: before.property_id,
      action: "statement_status_changed",
      target: data.id,
      before: { status: before.status },
      after: { status: data.status },
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

export const savePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        statement_id: z.string().uuid().nullish(),
        owner_user_id: z.string().uuid().nullish(),
        property_id: z.string().uuid().nullish(),
        period_start: z.string().nullish(),
        period_end: z.string().nullish(),
        amount: z.number().int().min(0),
        currency: z.enum(["EUR", "EGP"]).default("EUR"),
        method: z.string().trim().max(60).nullish(),
        transaction_reference: z.string().trim().max(120).nullish(),
        paid_on: z.string().nullish(),
        status: z.enum(["pending", "confirmed", "failed", "cancelled"]).default("pending"),
        internal_note: z.string().trim().max(500).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...row } = data;
    const payload = {
      ...row,
      confirmed_by: row.status === "confirmed" ? context.userId : null,
      confirmed_at: row.status === "confirmed" ? new Date().toISOString() : null,
    };
    const { data: before } = id
      ? await supabaseAdmin.from("owner_payouts").select("*").eq("id", id).maybeSingle()
      : { data: null };
    const { error } = id
      ? await supabaseAdmin.from("owner_payouts").update(payload as never).eq("id", id)
      : await supabaseAdmin.from("owner_payouts").insert(payload as never);
    if (error) return { error: "generic" };

    // A payout only counts once an administrator confirms it.
    if (row.status === "confirmed" && row.statement_id) {
      const { data: st } = await supabaseAdmin
        .from("owner_statements")
        .select("paid_out_amount")
        .eq("id", row.statement_id)
        .maybeSingle();
      await supabaseAdmin
        .from("owner_statements")
        .update({
          paid_out_amount: (st?.paid_out_amount ?? 0) + row.amount,
          status: "paid",
          paid_at: new Date().toISOString(),
        } as never)
        .eq("id", row.statement_id);
    }

    await audit(supabaseAdmin, context.userId, {
      propertyId: row.property_id ?? null,
      action: row.status === "confirmed" ? "payout_confirmed" : "payout_saved",
      target: id ?? "new",
      before,
      after: payload,
    });
    return { ok: true };
  });

/* ------------------------- receipts ------------------------- */

export const uploadReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        property_id: z.string().uuid(),
        booking_id: z.string().uuid().nullish(),
        service_item_id: z.string().uuid().nullish(),
        receipt_type: z.enum(["cleaning", "laundry", "repair", "material", "transfer", "other"]),
        file_name: z.string().trim().min(1).max(160),
        content_type: z.string().trim().max(100).default("application/octet-stream"),
        /** base64 payload, max ~4 MB */
        content_base64: z.string().max(6_000_000),
        amount: z.number().int().min(0).nullish(),
        currency: z.enum(["EUR", "EGP"]).default("EUR"),
        note: z.string().trim().max(300).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Buffer.from(data.content_base64, "base64");
    const path = `${data.property_id}/${Date.now()}-${data.file_name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("receipts")
      .upload(path, bytes, { contentType: data.content_type, upsert: false });
    if (upErr) return { error: "upload_failed" };

    const { error } = await supabaseAdmin.from("cost_receipts").insert({
      property_id: data.property_id,
      booking_id: data.booking_id ?? null,
      service_item_id: data.service_item_id ?? null,
      receipt_type: data.receipt_type,
      file_path: path,
      file_name: data.file_name,
      amount: data.amount ?? null,
      currency: data.currency,
      note: data.note ?? null,
      uploaded_by: context.userId,
    } as never);
    if (error) return { error: "generic" };
    await audit(supabaseAdmin, context.userId, {
      propertyId: data.property_id,
      action: "receipt_uploaded",
      target: data.file_name,
      after: { path, type: data.receipt_type },
    });
    return { ok: true };
  });

export const deleteReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("cost_receipts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (before) await supabaseAdmin.storage.from("receipts").remove([before.file_path]);
    await supabaseAdmin.from("cost_receipts").delete().eq("id", data.id);
    await audit(supabaseAdmin, context.userId, {
      propertyId: before?.property_id ?? null,
      action: "receipt_removed",
      target: data.id,
      before,
    });
    return { ok: true };
  });
