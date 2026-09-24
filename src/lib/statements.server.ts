/**
 * Monthly owner statements. Draft statements are recomputed; finalised ones
 * (approved/paid/corrected) are never silently changed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { settleBooking, type BookingLike } from "@/lib/billing.server";
import { convert, getCurrencySettings } from "@/lib/currency.server";
import { isCurrency } from "@/lib/currency";

export async function buildStatement(
  admin: SupabaseClient<Database>,
  args: {
    periodStart: string;
    periodEnd: string;
    propertyId: string | null;
    actorId: string | null;
  },
): Promise<number> {
  const { data: assignments } = await admin
    .from("property_user_assignments")
    .select("user_id, property_id")
    .eq("active", true);

  const pairs = (assignments ?? []).filter(
    (a) => !args.propertyId || a.property_id === args.propertyId,
  );
  let created = 0;

  for (const pair of pairs) {
    const { data: bookings } = await admin
      .from("bookings")
      .select("*")
      .eq("property_id", pair.property_id)
      .gte("checkout", args.periodStart)
      .lte("checkout", args.periodEnd);

    let gross = 0,
      guestFees = 0,
      platform = 0,
      payment = 0,
      mgmt = 0,
      services = 0,
      refunds = 0,
      adjustments = 0,
      net = 0,
      currency = "EUR";
    const perService: Record<string, { count: number; amount: number }> = {};

    for (const b of (bookings ?? []) as unknown as BookingLike[]) {
      if (!["confirmed", "cancelled"].includes(b.status)) continue;
      const s = await settleBooking(admin, b);
      currency = s.currency;
      gross += s.nightly_revenue;
      guestFees += s.guest_cleaning + s.guest_services;
      platform += s.platform_fees;
      payment += s.payment_fees;
      mgmt += s.management_fee;
      services += s.owner_service_costs;
      refunds += s.refunds;
      adjustments += s.adjustments;
      net += s.owner_net;
      for (const item of s.services) {
        const key = item.description_snapshot || "service";
        const entry = perService[key] ?? { count: 0, amount: 0 };
        if (item.status !== "cancelled") {
          entry.count += 1;
          entry.amount += item.actual_cost ?? item.total_price;
        }
        perService[key] = entry;
      }
    }

    const { data: existing } = await admin
      .from("owner_statements")
      .select("id, status")
      .eq("owner_user_id", pair.user_id)
      .eq("property_id", pair.property_id)
      .eq("period_start", args.periodStart)
      .eq("period_end", args.periodEnd)
      .maybeSingle();

    // Finalised statements stay as they are; history must not move.
    if (existing && existing.status !== "draft") continue;

    const row = {
      owner_user_id: pair.user_id,
      property_id: pair.property_id,
      period_start: args.periodStart,
      period_end: args.periodEnd,
      gross_booking_revenue: gross,
      guest_fees: guestFees,
      platform_fees: platform,
      payment_fees: payment,
      management_fees: mgmt,
      service_costs: services,
      refunds,
      adjustments,
      owner_net_amount: net,
      currency,
      breakdown: { services: perService } as never,
      status: "draft",
    };

    // Statement currency: convert the net once and store rate + amount with it.
    const cs = await getCurrencySettings(admin, pair.property_id);
    let conv = null as Awaited<ReturnType<typeof convert>>;
    if (isCurrency(currency)) {
      conv = await convert(admin, {
        amount: net,
        from: currency,
        to: cs.owner_statement_currency,
        propertyId: pair.property_id,
        context: "owner_statement",
        persist: currency !== cs.owner_statement_currency,
      });
    }
    const full = {
      ...row,
      statement_currency: conv ? cs.owner_statement_currency : currency,
      converted_net_amount: conv ? conv.converted_amount : net,
      conversion_id: conv?.id ?? null,
    };

    if (existing) await admin.from("owner_statements").update(full as never).eq("id", existing.id);
    else await admin.from("owner_statements").insert(full as never);
    created += 1;
  }

  return created;
}
