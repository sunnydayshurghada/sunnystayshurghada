import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { HOST_EMAIL } from "@/lib/airbnb";
import {
  TEMPLATE_KEYS,
  TEMPLATE_LANGUAGES,
  type TemplateKey,
} from "@/lib/email-defaults";

async function isAdmin(db: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !error && data !== null;
}

const templateKey = z.enum(TEMPLATE_KEYS as unknown as [TemplateKey, ...TemplateKey[]]);
const language = z.enum(TEMPLATE_LANGUAGES as unknown as ["de", "en", "ar"]);

export interface RecipientRow {
  id: string;
  property_id: string;
  recipient_name: string;
  recipient_email: string;
  recipient_role: string;
  receive_new_inquiries: boolean;
  receive_confirmed_bookings: boolean;
  receive_payments: boolean;
  receive_cancellations: boolean;
  receive_booking_changes: boolean;
  receive_calendar_errors: boolean;
  active: boolean;
}

export interface EmailLogRow {
  id: string;
  created_at: string;
  template: string;
  recipient: string;
  recipient_type: string | null;
  language: string | null;
  status: string;
  error: string | null;
  attempts: number | null;
  sent_at: string | null;
}

/** Recipients + delivery log for one property. Admins only. */
export const getNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string }) =>
    z.object({ propertyId: z.string().uuid() }).parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<
      { recipients: RecipientRow[]; log: EmailLogRow[]; centralEmail: string } | { error: string }
    > => {
      if (!(await isAdmin(context.supabase, context.userId))) return { error: "forbidden" };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: recipients } = await supabaseAdmin
        .from("property_notification_recipients")
        .select("*")
        .eq("property_id", data.propertyId)
        .order("created_at");
      const { data: log } = await supabaseAdmin
        .from("email_notifications")
        .select("id, created_at, template, recipient, recipient_type, language, status, error, attempts, sent_at")
        .eq("property_id", data.propertyId)
        .order("created_at", { ascending: false })
        .limit(50);
      return {
        recipients: (recipients ?? []) as RecipientRow[],
        log: (log ?? []) as EmailLogRow[],
        centralEmail: HOST_EMAIL,
      };
    },
  );

const recipientInput = z.object({
  id: z.string().uuid().nullish(),
  property_id: z.string().uuid(),
  recipient_name: z.string().trim().min(2).max(120),
  recipient_email: z.string().trim().email().max(255),
  recipient_role: z.string().trim().max(60).default("owner"),
  receive_new_inquiries: z.boolean(),
  receive_confirmed_bookings: z.boolean(),
  receive_payments: z.boolean(),
  receive_cancellations: z.boolean(),
  receive_booking_changes: z.boolean(),
  receive_calendar_errors: z.boolean(),
  active: z.boolean(),
});

export const saveRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => recipientInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isAdmin(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...row } = data;
    const payload = { ...row, recipient_email: row.recipient_email.toLowerCase() };
    const { error } = id
      ? await supabaseAdmin.from("property_notification_recipients").update(payload).eq("id", id)
      : await supabaseAdmin.from("property_notification_recipients").insert(payload);
    if (error) return { error: error.message.includes("duplicate") ? "duplicate" : "generic" };
    return { ok: true };
  });

export const deleteRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isAdmin(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("property_notification_recipients")
      .delete()
      .eq("id", data.id);
    return error ? { error: "generic" } : { ok: true };
  });

/** One template (property override or central default) plus a rendered preview. */
export const getEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        key: templateKey,
        language,
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<
      | { subject: string; body: string; source: string; preview: { subject: string; body: string } }
      | { error: string }
    > => {
      if (!(await isAdmin(context.supabase, context.userId))) return { error: "forbidden" };
      const { resolveTemplate, renderPlaceholders } = await import("@/lib/notifications.server");
      const { sampleVars } = await import("@/lib/notifications.preview");
      const tpl = await resolveTemplate(data.propertyId, data.key, data.language);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: property } = await supabaseAdmin
        .from("properties")
        .select("*")
        .eq("id", data.propertyId)
        .maybeSingle();
      const vars = sampleVars(property, data.language);
      return {
        subject: tpl.subject,
        body: tpl.body,
        source: tpl.source,
        preview: {
          subject: renderPlaceholders(tpl.subject, vars),
          body: renderPlaceholders(tpl.body, vars),
        },
      };
    },
  );

export const saveEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        key: templateKey,
        language,
        subject: z.string().trim().min(3).max(200),
        body: z.string().trim().min(10).max(8000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isAdmin(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("email_templates")
      .select("id")
      .eq("property_id", data.propertyId)
      .eq("template_key", data.key)
      .eq("language", data.language)
      .maybeSingle();
    const payload = {
      property_id: data.propertyId,
      template_key: data.key,
      language: data.language,
      subject: data.subject,
      body: data.body,
      active: true,
    };
    const { error } = existing
      ? await supabaseAdmin.from("email_templates").update(payload).eq("id", existing.id)
      : await supabaseAdmin.from("email_templates").insert(payload);
    return error ? { error: "generic" } : { ok: true };
  });

/** Drops the property override so the central Sunny Stays default applies again. */
export const resetEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ propertyId: z.string().uuid(), key: templateKey, language }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isAdmin(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("email_templates")
      .delete()
      .eq("property_id", data.propertyId)
      .eq("template_key", data.key)
      .eq("language", data.language);
    return error ? { error: "generic" } : { ok: true };
  });

/** Sends the selected template with sample data to an address of the admin's choice. */
export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        key: templateKey,
        language,
        to: z.string().trim().email().max(255),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    if (!(await isAdmin(context.supabase, context.userId))) return { error: "forbidden" };
    const { resolveTemplate, renderPlaceholders } = await import("@/lib/notifications.server");
    const { sampleVars } = await import("@/lib/notifications.preview");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: property } = await supabaseAdmin
      .from("properties")
      .select("*")
      .eq("id", data.propertyId)
      .maybeSingle();
    const tpl = await resolveTemplate(data.propertyId, data.key, data.language);
    const vars = sampleVars(property, data.language);
    const subject = `[Test] ${renderPlaceholders(tpl.subject, vars)}`;
    const body = renderPlaceholders(tpl.body, vars);

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      await sendTemplateEmail("property-guest-notice", data.to, {
        templateData: {
          subject,
          heading: subject,
          bodyText: body,
          propertyName: property?.public_name ?? "Sunny Stays",
          language: data.language,
        },
        idempotencyKey: `test-${data.key}-${data.language}-${Date.now()}`,
        replyTo: HOST_EMAIL,
      });
    } catch (e) {
      console.error("[notify] test email failed", e);
      return { error: "send_failed" };
    }
    await supabaseAdmin.from("email_notifications").insert({
      property_id: data.propertyId,
      template: `test_${data.key}`,
      recipient: data.to,
      recipient_type: "central",
      language: data.language,
      subject,
      status: "sent",
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
    });
    return { ok: true };
  });

/** Retries every failed delivery of a property. */
export const retryFailedEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string }) =>
    z.object({ propertyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; retried: number } | { error: string }> => {
    if (!(await isAdmin(context.supabase, context.userId))) return { error: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { retryFailedForProperty } = await import("@/lib/notifications.server.retry");
    const retried = await retryFailedForProperty(supabaseAdmin, data.propertyId);
    return { ok: true, retried };
  });
