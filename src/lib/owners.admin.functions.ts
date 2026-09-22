import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SITE_URL = "https://sunnystayshurghada.lovable.app";
const INVITE_HOURS = 48;

async function requireStaff(
  db: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (data ?? []).some((r) =>
    ["admin", "super_admin", "booking_manager"].includes(r.role as string),
  );
}

export interface OwnerAccount {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: string;
  preferred_language: string;
  active: boolean;
  last_login_at: string | null;
  invited_at: string | null;
  invitation_expires_at: string | null;
  invitation_accepted_at: string | null;
  assignments: {
    id: string;
    property_id: string;
    property_name: string;
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
    active: boolean;
  }[];
}

export const listOwners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<
      | {
          owners: OwnerAccount[];
          properties: { id: string; name: string }[];
          audit: {
            id: string;
            created_at: string;
            actor_email: string | null;
            action: string;
            target: string | null;
          }[];
        }
      | { error: string }
    > => {
      if (!(await requireStaff(context.supabase, context.userId))) return { error: "forbidden" };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: profiles }, { data: assignments }, { data: props }, { data: audit }] =
        await Promise.all([
          supabaseAdmin.from("user_profiles").select("*").order("created_at"),
          supabaseAdmin.from("property_user_assignments").select("*"),
          supabaseAdmin.from("properties").select("id, public_name").order("sort_order"),
          supabaseAdmin
            .from("security_audit_log")
            .select("id, created_at, actor_email, action, target")
            .order("created_at", { ascending: false })
            .limit(40),
        ]);
      const nameOf = new Map((props ?? []).map((p) => [p.id, p.public_name]));
      const owners = (profiles ?? []).map((p) => ({
        ...p,
        assignments: (assignments ?? [])
          .filter((a) => a.user_id === p.user_id)
          .map((a) => ({ ...a, property_name: nameOf.get(a.property_id) ?? "" })),
      })) as unknown as OwnerAccount[];
      return {
        owners,
        properties: (props ?? []).map((p) => ({ id: p.id, name: p.public_name })),
        audit: (audit ?? []) as never,
      };
    },
  );

async function sendInviteLink(email: string, link: string, name: string): Promise<void> {
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  await sendTemplateEmail("internal-notice", email, {
    templateData: {
      subject: "Ihr Zugang zum Sunny Stays Eigentümerportal",
      heading: "Willkommen im Eigentümerportal",
      intro: `Hallo ${name || ""}, bitte legen Sie Ihr Passwort fest. Der Link ist ${INVITE_HOURS} Stunden gültig.`,
      rows: [],
      adminUrl: link,
      adminLabel: "Passwort festlegen",
    },
    idempotencyKey: `owner-invite-${email}-${Date.now()}`,
  });
}

/** Creates (or re-invites) an owner account and emails a time-limited invitation. */
export const inviteOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        first_name: z.string().trim().max(80).default(""),
        last_name: z.string().trim().max(80).default(""),
        phone: z.string().trim().max(40).default(""),
        preferred_language: z.enum(["de", "en", "ar"]).default("de"),
        role: z.enum(["owner", "booking_manager"]).default("owner"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await requireStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditLog } = await import("@/lib/owner-access.server");
    const email = data.email.toLowerCase();

    // Reuse the account when it already exists, otherwise create it.
    const { data: existingProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    let userId = existingProfile?.user_id ?? null;
    if (!userId) {
      const created = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: false,
      });
      if (created.error && !created.error.message.includes("already")) {
        console.error("[owners] create user failed", created.error.message);
        return { error: "create_failed" };
      }
      userId = created.data?.user?.id ?? null;
      if (!userId) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
      }
      if (!userId) return { error: "create_failed" };
    }

    const expires = new Date(Date.now() + INVITE_HOURS * 3600_000).toISOString();
    await supabaseAdmin.from("user_profiles").upsert(
      {
        user_id: userId,
        email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || null,
        role: data.role,
        preferred_language: data.preferred_language,
        active: true,
        invited_at: new Date().toISOString(),
        invitation_expires_at: expires,
      },
      { onConflict: "user_id" },
    );
    if (data.role === "booking_manager") {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "booking_manager" })
        .select();
    }

    const link = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${SITE_URL}/auth` },
    });
    if (link.error || !link.data?.properties?.action_link) {
      console.error("[owners] invite link failed", link.error?.message);
      return { error: "invite_failed" };
    }
    try {
      await sendInviteLink(email, link.data.properties.action_link, data.first_name);
    } catch (e) {
      console.error("[owners] invite mail failed", e);
      return { error: "invite_failed" };
    }

    await auditLog(supabaseAdmin, {
      actorId: context.userId,
      actorEmail: null,
      action: "owner_invited",
      target: email,
      detail: { role: data.role, expires },
    });
    return { ok: true };
  });

export const setOwnerActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await requireStaff(context.supabase, context.userId))) return { error: "forbidden" };
    if (data.userId === context.userId) return { error: "self_lock" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditLog } = await import("@/lib/owner-access.server");
    await supabaseAdmin
      .from("user_profiles")
      .update({ active: data.active })
      .eq("user_id", data.userId);
    // Hard lockout at the auth layer too, so an existing session cannot linger.
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "87600h",
    });
    await auditLog(supabaseAdmin, {
      actorId: context.userId,
      actorEmail: null,
      action: data.active ? "owner_activated" : "owner_deactivated",
      target: data.userId,
    });
    return { ok: true };
  });

const assignmentInput = z.object({
  id: z.string().uuid().nullish(),
  user_id: z.string().uuid(),
  property_id: z.string().uuid(),
  assignment_role: z.enum(["owner", "co_owner", "manager"]).default("owner"),
  ownership_share_percent: z.number().min(0).max(100).nullish(),
  can_view_bookings: z.boolean(),
  can_view_guest_contact_data: z.boolean(),
  can_view_financials: z.boolean(),
  can_view_payments: z.boolean(),
  can_view_calendar: z.boolean(),
  can_create_calendar_blocks: z.boolean(),
  can_manage_prices: z.boolean(),
  can_receive_notifications: z.boolean(),
  active: z.boolean().default(true),
});

export const saveAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => assignmentInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await requireStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditLog } = await import("@/lib/owner-access.server");
    const { id, ...row } = data;
    const payload = { ...row, ownership_share_percent: row.ownership_share_percent ?? null };
    const { error } = id
      ? await supabaseAdmin.from("property_user_assignments").update(payload).eq("id", id)
      : await supabaseAdmin
          .from("property_user_assignments")
          .upsert(payload, { onConflict: "property_id,user_id" });
    if (error) return { error: "generic" };
    await auditLog(supabaseAdmin, {
      actorId: context.userId,
      actorEmail: null,
      propertyId: data.property_id,
      action: id ? "permissions_changed" : "property_assigned",
      target: data.user_id,
      detail: payload as never,
    });
    return { ok: true };
  });

export const removeAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await requireStaff(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditLog } = await import("@/lib/owner-access.server");
    const { error } = await supabaseAdmin
      .from("property_user_assignments")
      .delete()
      .eq("id", data.id);
    if (error) return { error: "generic" };
    await auditLog(supabaseAdmin, {
      actorId: context.userId,
      actorEmail: null,
      action: "assignment_removed",
      target: data.id,
    });
    return { ok: true };
  });

/** Records a successful sign-in; called by the portal after authentication. */
export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditLog } = await import("@/lib/owner-access.server");
    await supabaseAdmin
      .from("user_profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    await auditLog(supabaseAdmin, {
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
      action: "login",
    });
    return { ok: true };
  });
