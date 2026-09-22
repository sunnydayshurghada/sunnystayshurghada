/**
 * Server-only notification engine.
 *
 * Rules enforced here:
 *  - The central booking desk (HOST_EMAIL) always receives every booking event
 *    of every property, regardless of per-property recipient settings.
 *  - Property owners receive only events of the properties they are assigned to,
 *    and only the event types enabled on their record.
 *  - Every recipient gets a separate email; no CC, so addresses never leak.
 *  - Guest emails use the language the guest browsed the site in.
 *  - Every send is logged in email_notifications and retried on failure; a failed
 *    owner notification never breaks the guest email or the booking itself.
 */
import { HOST_EMAIL } from "@/lib/airbnb";
import {
  defaultTemplate,
  type TemplateKey,
  TEMPLATE_LANGUAGES,
  type TemplateLanguage,
} from "@/lib/email-defaults";

const ADMIN_URL = "https://sunnystayshurghada.lovable.app/admin";
const MAX_ATTEMPTS = 3;

export type NotificationEvent =
  | "new_inquiry"
  | "confirmed_booking"
  | "payment_success"
  | "payment_failed"
  | "cancellation"
  | "booking_change"
  | "calendar_conflict"
  | "sync_failed";

const OWNER_FLAG: Record<NotificationEvent, string> = {
  new_inquiry: "receive_new_inquiries",
  confirmed_booking: "receive_confirmed_bookings",
  payment_success: "receive_payments",
  payment_failed: "receive_payments",
  cancellation: "receive_cancellations",
  booking_change: "receive_booking_changes",
  calendar_conflict: "receive_calendar_errors",
  sync_failed: "receive_calendar_errors",
};

const EVENT_TITLE: Record<NotificationEvent, string> = {
  new_inquiry: "Neue Buchungsanfrage",
  confirmed_booking: "Buchung bestätigt",
  payment_success: "Zahlung eingegangen",
  payment_failed: "Zahlung fehlgeschlagen",
  cancellation: "Buchung storniert",
  booking_change: "Buchung geändert",
  calendar_conflict: "Kalenderkonflikt",
  sync_failed: "Airbnb-Synchronisation fehlgeschlagen",
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function normalizeLanguage(raw: string | null | undefined): TemplateLanguage {
  const base = (raw ?? "de").toLowerCase().split("-")[0];
  return (TEMPLATE_LANGUAGES as readonly string[]).includes(base)
    ? (base as TemplateLanguage)
    : "de";
}

export function money(cents: number | null | undefined, currency = "EUR", lang = "de"): string {
  const value = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : lang, {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** Replaces {{key}} placeholders. Values are inserted as plain text only. */
export function renderPlaceholders(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => vars[key] ?? "");
}

export interface BookingContext {
  booking: Record<string, any>;
  property: Record<string, any>;
  vars: Record<string, string>;
  language: TemplateLanguage;
}

export async function loadBookingContext(bookingId: string): Promise<BookingContext | null> {
  const db = await admin();
  const { data: booking } = await db
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return null;
  const { data: property } = await db
    .from("properties")
    .select("*")
    .eq("id", booking.property_id)
    .maybeSingle();
  if (!property) return null;

  const language = normalizeLanguage(booking.guest_language);
  const currency = booking.currency ?? property.currency ?? "EUR";
  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.checkout).getTime() - new Date(booking.checkin).getTime()) / 86400000,
    ),
  );
  const due = Math.max(0, (booking.total_amount ?? 0) - (booking.amount_paid ?? 0));

  const vars: Record<string, string> = {
    property_name: property.public_name ?? "",
    booking_number: booking.booking_number ?? booking.id.slice(0, 8),
    guest_name: booking.guest_name ?? "",
    checkin: booking.checkin ?? "",
    checkout: booking.checkout ?? "",
    checkin_time: (property.check_in_time ?? "14:00:00").slice(0, 5),
    checkout_time: (property.check_out_time ?? "11:00:00").slice(0, 5),
    guests: String(booking.guests ?? ""),
    nights: String(nights),
    nightly_total: money(booking.nightly_total, currency, language),
    cleaning_fee: money(booking.cleaning_fee, currency, language),
    discount: money(booking.discount_amount, currency, language),
    total_amount: money(booking.total_amount, currency, language),
    amount_paid: money(booking.amount_paid, currency, language),
    amount_due: money(due, currency, language),
    payment_method: booking.payment_method ?? "—",
    booking_status: booking.booking_status ?? booking.status ?? "",
    address: property.address ?? "",
    arrival_instructions: property.arrival_instructions ?? "",
    house_rules: property.house_rules ?? "",
    host_contact: property.host_contact ?? HOST_EMAIL,
    signature: property.email_signature ?? "Wafaa & Alex\nSunny Stays Hurghada",
  };

  return { booking, property, vars, language };
}

export async function resolveTemplate(
  propertyId: string | null,
  key: TemplateKey,
  language: string,
): Promise<{ subject: string; body: string; source: "property" | "default" }> {
  const lang = normalizeLanguage(language);
  const db = await admin();
  if (propertyId) {
    const { data } = await db
      .from("email_templates")
      .select("subject, body, active")
      .eq("property_id", propertyId)
      .eq("template_key", key)
      .eq("language", lang)
      .maybeSingle();
    if (data?.active) return { subject: data.subject, body: data.body, source: "property" };
  }
  const { data: central } = await db
    .from("email_templates")
    .select("subject, body, active")
    .is("property_id", null)
    .eq("template_key", key)
    .eq("language", lang)
    .maybeSingle();
  if (central?.active) return { subject: central.subject, body: central.body, source: "default" };
  const fallback = defaultTemplate(key, lang);
  return { ...fallback, source: "default" };
}

interface LoggedSend {
  propertyId: string | null;
  bookingId: string | null;
  recipient: string;
  recipientType: "guest" | "central" | "owner";
  templateKey: string;
  language: string;
  subject: string;
  templateName: "property-guest-notice" | "internal-notice";
  templateData: Record<string, unknown>;
  replyTo?: string;
  idempotencyKey: string;
}

/** Sends one email, retries transient failures, and always writes a log row. */
async function sendLogged(job: LoggedSend): Promise<boolean> {
  const db = await admin();
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

  let attempts = 0;
  let status = "failed";
  let errorText: string | null = null;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    try {
      const result = await sendTemplateEmail(job.templateName, job.recipient, {
        templateData: { ...job.templateData, subject: job.subject },
        idempotencyKey: job.idempotencyKey,
        ...(job.replyTo ? { replyTo: job.replyTo } : {}),
      });
      status = result.sent ? "sent" : "suppressed";
      errorText = result.sent ? null : "recipient_suppressed";
      break;
    } catch (e) {
      errorText = e instanceof Error ? e.message : String(e);
      const retryAfter = (e as { retryAfterSeconds?: number })?.retryAfterSeconds;
      if (attempts >= MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, (retryAfter ?? 2) * 1000));
    }
  }

  const { error: logError } = await db.from("email_notifications").insert({
    property_id: job.propertyId,
    booking_id: job.bookingId,
    template: job.templateKey,
    recipient: job.recipient,
    recipient_type: job.recipientType,
    language: job.language,
    subject: job.subject,
    status,
    error: errorText,
    attempts,
    last_attempt_at: new Date().toISOString(),
    sent_at: status === "sent" ? new Date().toISOString() : null,
  });
  if (logError) console.error("[notify] log insert failed", logError.message);

  return status === "sent";
}

/** Guest email in the guest's own language, using the property template. */
export async function notifyGuest(
  bookingId: string,
  key: TemplateKey,
  ctxIn?: BookingContext,
): Promise<boolean> {
  const ctx = ctxIn ?? (await loadBookingContext(bookingId));
  if (!ctx) return false;
  const tpl = await resolveTemplate(ctx.property.id, key, ctx.language);
  const subject = renderPlaceholders(tpl.subject, ctx.vars);
  const body = renderPlaceholders(tpl.body, ctx.vars);
  return sendLogged({
    propertyId: ctx.property.id,
    bookingId,
    recipient: ctx.booking.guest_email,
    recipientType: "guest",
    templateKey: key,
    language: ctx.language,
    subject,
    templateName: "property-guest-notice",
    templateData: {
      heading: subject,
      bodyText: body,
      propertyName: ctx.property.public_name,
      language: ctx.language,
      previewText: subject,
    },
    replyTo: HOST_EMAIL,
    idempotencyKey: `guest-${key}-${bookingId}`,
  });
}

/**
 * Internal notifications: the central desk always, assigned owners per their
 * own flags. Each recipient receives a separate email.
 */
export async function notifyInternal(
  event: NotificationEvent,
  bookingId: string,
  ctxIn?: BookingContext,
): Promise<void> {
  const ctx = ctxIn ?? (await loadBookingContext(bookingId));
  if (!ctx) return;
  const db = await admin();
  const { booking, property, vars } = ctx;
  const title = EVENT_TITLE[event];
  const subject = `${title} – ${property.public_name} (${booking.checkin} – ${booking.checkout})`;

  // Central booking desk: full detail, guest address as Reply-To.
  const centralRows = [
    { label: "Wohnung", value: property.public_name },
    { label: "Buchungsnummer", value: vars["booking_number"] },
    { label: "Gast", value: booking.guest_name },
    { label: "E-Mail", value: booking.guest_email },
    { label: "Telefon", value: booking.guest_phone },
    { label: "Anreise", value: booking.checkin },
    { label: "Abreise", value: booking.checkout },
    { label: "Gäste", value: String(booking.guests ?? "") },
    { label: "Nächte", value: vars["nights"] },
    { label: "Gesamtpreis", value: vars["total_amount"] },
    { label: "Nachricht", value: booking.message },
    { label: "Sprache", value: ctx.language },
    { label: "Quelle", value: booking.source },
    { label: "Status", value: `${booking.booking_status} / ${booking.payment_status}` },
  ];

  await sendLogged({
    propertyId: property.id,
    bookingId,
    recipient: HOST_EMAIL,
    recipientType: "central",
    templateKey: `internal_${event}`,
    language: "de",
    subject,
    templateName: "internal-notice",
    templateData: {
      heading: title,
      intro: `${property.public_name} · ${booking.checkin} – ${booking.checkout}`,
      rows: centralRows,
      adminUrl: ADMIN_URL,
      adminLabel: "Anfrage im Adminbereich öffnen",
    },
    replyTo: booking.guest_email,
    idempotencyKey: `central-${event}-${bookingId}`,
  });

  // Assigned owners of this property only.
  const flag = OWNER_FLAG[event];
  const { data: recipients } = await db
    .from("property_notification_recipients")
    .select("*")
    .eq("property_id", property.id)
    .eq("active", true);

  for (const r of recipients ?? []) {
    if (!(r as Record<string, any>)[flag]) continue;
    if (r.recipient_email.toLowerCase() === HOST_EMAIL.toLowerCase()) continue;
    // Owners get management data only — no guest contact details or messages.
    const ownerRows = [
      { label: "Wohnung", value: property.public_name },
      { label: "Buchungsnummer", value: vars["booking_number"] },
      { label: "Anreise", value: booking.checkin },
      { label: "Abreise", value: booking.checkout },
      { label: "Gäste", value: String(booking.guests ?? "") },
      { label: "Buchungsstatus", value: booking.booking_status },
      { label: "Zahlungsstatus", value: booking.payment_status },
      { label: "Gesamtpreis", value: vars["total_amount"] },
    ];
    await sendLogged({
      propertyId: property.id,
      bookingId,
      recipient: r.recipient_email,
      recipientType: "owner",
      templateKey: `owner_${event}`,
      language: "de",
      subject,
      templateName: "internal-notice",
      templateData: {
        heading: title,
        intro: `Hallo ${r.recipient_name}, es gibt eine Aktualisierung für ${property.public_name}.`,
        rows: ownerRows,
        adminUrl: ADMIN_URL,
        adminLabel: "Im geschützten Backend ansehen",
        note: "Diese Nachricht betrifft ausschließlich die Ihnen zugeordnete Wohnung.",
      },
      idempotencyKey: `owner-${event}-${bookingId}-${r.id}`,
    });
  }
}

/** Operational alerts without a booking (sync failures, calendar conflicts). */
export async function notifyOperational(
  event: Extract<NotificationEvent, "sync_failed" | "calendar_conflict">,
  propertyId: string | null,
  detail: string,
): Promise<void> {
  const db = await admin();
  let propertyName = "Sunny Stays";
  if (propertyId) {
    const { data } = await db
      .from("properties")
      .select("public_name")
      .eq("id", propertyId)
      .maybeSingle();
    propertyName = data?.public_name ?? propertyName;
  }
  const title = EVENT_TITLE[event];
  const subject = `${title} – ${propertyName}`;
  const rows = [
    { label: "Wohnung", value: propertyName },
    { label: "Ereignis", value: title },
    { label: "Details", value: detail },
    { label: "Zeitpunkt", value: new Date().toISOString() },
  ];

  await sendLogged({
    propertyId,
    bookingId: null,
    recipient: HOST_EMAIL,
    recipientType: "central",
    templateKey: `internal_${event}`,
    language: "de",
    subject,
    templateName: "internal-notice",
    templateData: { heading: title, rows, adminUrl: ADMIN_URL },
    idempotencyKey: `ops-${event}-${propertyId ?? "none"}-${Date.now()}`,
  });

  if (!propertyId) return;
  const { data: recipients } = await db
    .from("property_notification_recipients")
    .select("*")
    .eq("property_id", propertyId)
    .eq("active", true)
    .eq("receive_calendar_errors", true);
  for (const r of recipients ?? []) {
    if (r.recipient_email.toLowerCase() === HOST_EMAIL.toLowerCase()) continue;
    await sendLogged({
      propertyId,
      bookingId: null,
      recipient: r.recipient_email,
      recipientType: "owner",
      templateKey: `owner_${event}`,
      language: "de",
      subject,
      templateName: "internal-notice",
      templateData: { heading: title, rows, adminUrl: ADMIN_URL },
      idempotencyKey: `ops-owner-${event}-${r.id}-${Date.now()}`,
    });
  }
}

/** Fire-and-forget wrapper — email problems never break the caller. */
export async function safeNotify(run: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await run();
  } catch (e) {
    console.error(`[notify] ${label} failed`, e);
  }
}
