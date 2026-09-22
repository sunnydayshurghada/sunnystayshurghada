import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface Assignment {
  property_id: string;
  assignment_role: string;
  ownership_share_percent: number | null;
  can_view_bookings: boolean;
  can_view_guest_contact_data: boolean;
  can_view_financials: boolean;
  can_view_payments: boolean;
  can_view_calendar: boolean;
  can_create_calendar_blocks: boolean;
  can_manage_prices: boolean;
  can_receive_notifications: boolean;
}

export interface AccessContext {
  userId: string;
  email: string | null;
  isStaff: boolean;
  active: boolean;
  role: string;
  language: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  /** property_id -> permissions. Staff get a synthetic full-permission entry per property. */
  assignments: Map<string, Assignment>;
}

const FULL: Omit<Assignment, "property_id"> = {
  assignment_role: "manager",
  ownership_share_percent: null,
  can_view_bookings: true,
  can_view_guest_contact_data: true,
  can_view_financials: true,
  can_view_payments: true,
  can_view_calendar: true,
  can_create_calendar_blocks: true,
  can_manage_prices: true,
  can_receive_notifications: true,
};

/**
 * Single source of truth for what the signed-in user may see. Every owner
 * endpoint derives its property filter from here — never from client input.
 */
export async function loadAccess(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<AccessContext> {
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const isStaff = (roles ?? []).some((r) =>
    ["admin", "super_admin", "booking_manager"].includes(r.role as string),
  );

  const { data: profile } = await admin
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const assignments = new Map<string, Assignment>();
  if (isStaff) {
    const { data: props } = await admin.from("properties").select("id");
    for (const p of props ?? []) assignments.set(p.id, { property_id: p.id, ...FULL });
  } else if (profile?.active !== false) {
    const { data: rows } = await admin
      .from("property_user_assignments")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true);
    for (const r of rows ?? []) assignments.set(r.property_id, r as unknown as Assignment);
  }

  return {
    userId,
    email: profile?.email ?? null,
    isStaff,
    active: profile?.active ?? isStaff,
    role: (profile?.role as string) ?? (isStaff ? "super_admin" : "owner"),
    language: (profile?.preferred_language as string) ?? "de",
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    phone: profile?.phone ?? null,
    assignments,
  };
}

/** Property ids the user may access at all, optionally narrowed to one id. */
export function allowedProperties(access: AccessContext, requested?: string | null): string[] {
  const all = [...access.assignments.keys()];
  if (!requested) return all;
  return all.includes(requested) ? [requested] : [];
}

export function can(
  access: AccessContext,
  propertyId: string,
  key: keyof Omit<Assignment, "property_id" | "assignment_role" | "ownership_share_percent">,
): boolean {
  const a = access.assignments.get(propertyId);
  return Boolean(a && a[key]);
}

export async function auditLog(
  admin: SupabaseClient<Database>,
  entry: {
    actorId: string | null;
    actorEmail: string | null;
    propertyId?: string | null;
    action: string;
    target?: string | null;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await admin.from("security_audit_log").insert({
    actor_id: entry.actorId,
    actor_email: entry.actorEmail,
    property_id: entry.propertyId ?? null,
    action: entry.action,
    target: entry.target ?? null,
    detail: (entry.detail ?? {}) as never,
  });
  if (error) console.error("[audit] insert failed", error.message);
}
