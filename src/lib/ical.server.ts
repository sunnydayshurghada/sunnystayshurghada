/**
 * Server-only iCal helpers: Airbnb import + privacy-safe export feed.
 * Everything is scoped to a single property; calendars never mix.
 * Never import this from client code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type IcalEvent = { uid: string; start: string; end: string; summary: string };

export type SyncResult = {
  ok: boolean;
  imported: number;
  removed: number;
  error?: string;
};

type Integration = Database["public"]["Tables"]["calendar_integrations"]["Row"];

async function admin(): Promise<SupabaseClient<Database>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient<Database>;
}

export async function defaultPropertyId(): Promise<string | null> {
  const db = await admin();
  const { data } = await db
    .from("properties")
    .select("id")
    .eq("status", "active")
    .order("sort_order")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

function newToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

/** Integration row for one property, created on demand. */
export async function getIntegration(propertyId: string): Promise<Integration> {
  const db = await admin();
  const { data } = await db
    .from("calendar_integrations")
    .select("*")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (data) return data;
  const { data: created } = await db
    .from("calendar_integrations")
    .insert({ property_id: propertyId, export_token: newToken() })
    .select("*")
    .single();
  return created!;
}

/** Shared cron secret (still stored on the legacy global settings row). */
export async function getCronSecret(): Promise<string | null> {
  const db = await admin();
  const { data } = await db.from("ical_settings").select("cron_secret").eq("id", true).maybeSingle();
  return data?.cron_secret ?? null;
}

/** Resolve an export token to its property. */
export async function findPropertyByExportToken(token: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db
    .from("calendar_integrations")
    .select("property_id, export_token")
    .eq("export_token", token)
    .maybeSingle();
  return data?.property_id ?? null;
}

/** Unfold RFC 5545 line folding and split into logical lines. */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function toISODateFromIcal(value: string): string | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseIcal(text: string): IcalEvent[] {
  const lines = unfold(text);
  const events: IcalEvent[] = [];
  let current: Partial<IcalEvent> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current?.uid && current.start && current.end) {
        events.push({
          uid: current.uid,
          start: current.start,
          end: current.end,
          summary: current.summary ?? "",
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const rawName = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const name = rawName.split(";")[0].toUpperCase();

    if (name === "UID") current.uid = value.trim();
    else if (name === "DTSTART") current.start = toISODateFromIcal(value) ?? undefined;
    else if (name === "DTEND") current.end = toISODateFromIcal(value) ?? undefined;
    else if (name === "SUMMARY") current.summary = value.trim();
  }

  return events.filter((e) => e.end > e.start);
}

/** Airbnb marks unavailable-but-not-booked ranges; we block all of them. */
function isBlockingEvent(e: IcalEvent): boolean {
  return !/^\s*(available|verfügbar)/i.test(e.summary);
}

export async function syncAirbnb(
  triggerSource: "manual" | "cron" | "confirm",
  propertyId?: string | null,
): Promise<SyncResult> {
  const db = await admin();
  const pid = propertyId ?? (await defaultPropertyId());
  if (!pid) return { ok: false, imported: 0, removed: 0, error: "no_property" };

  const settings = await getIntegration(pid);
  const url = settings.airbnb_ical_url;

  const finish = async (result: SyncResult, message?: string) => {
    await db
      .from("calendar_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: result.ok ? "ok" : "error",
        last_sync_error: result.ok ? null : (result.error ?? null),
        last_sync_imported: result.imported,
        updated_at: new Date().toISOString(),
      })
      .eq("property_id", pid);
    await db.from("ical_sync_log").insert({
      property_id: pid,
      status: result.ok ? "ok" : "error",
      imported: result.imported,
      removed: result.removed,
      trigger_source: triggerSource,
      message: message ?? result.error ?? null,
    });
    return result;
  };

  if (!url) return { ok: false, imported: 0, removed: 0, error: "no_url" };

  let text: string;
  try {
    const res = await fetch(url, { headers: { Accept: "text/calendar" } });
    if (!res.ok) return finish({ ok: false, imported: 0, removed: 0, error: "fetch_failed" });
    text = await res.text();
  } catch {
    return finish({ ok: false, imported: 0, removed: 0, error: "fetch_failed" });
  }

  if (!text.includes("BEGIN:VCALENDAR")) {
    return finish({ ok: false, imported: 0, removed: 0, error: "invalid_calendar" });
  }

  const events = parseIcal(text).filter(isBlockingEvent);
  const now = new Date().toISOString();
  let imported = 0;

  for (const e of events) {
    const uid = `airbnb:${e.uid}`;
    const { data: existing } = await db
      .from("calendar_blocks")
      .select("id, start_date, end_date")
      .eq("property_id", pid)
      .eq("external_uid", uid)
      .maybeSingle();

    if (existing) {
      if (existing.start_date !== e.start || existing.end_date !== e.end) {
        await db
          .from("calendar_blocks")
          .update({ start_date: e.start, end_date: e.end, last_seen_at: now })
          .eq("id", existing.id);
      } else {
        await db.from("calendar_blocks").update({ last_seen_at: now }).eq("id", existing.id);
      }
    } else {
      await db.from("calendar_blocks").insert({
        property_id: pid,
        start_date: e.start,
        end_date: e.end,
        entry_type: "booking",
        source: "airbnb",
        external_uid: uid,
        last_seen_at: now,
        note: null,
      });
    }
    imported += 1;
  }

  // Ranges gone from this property's Airbnb feed (cancelled) are released again.
  const { data: removedRows } = await db
    .from("calendar_blocks")
    .delete()
    .eq("property_id", pid)
    .eq("source", "airbnb")
    .not("external_uid", "is", null)
    .lt("last_seen_at", now)
    .select("id");

  return finish({ ok: true, imported, removed: removedRows?.length ?? 0 });
}

/** Cron entry point: every active property with a configured Airbnb feed. */
export async function syncAllProperties(): Promise<
  { property_id: string; result: SyncResult }[]
> {
  const db = await admin();
  const { data } = await db
    .from("calendar_integrations")
    .select("property_id, airbnb_ical_url")
    .not("airbnb_ical_url", "is", null);

  const out: { property_id: string; result: SyncResult }[] = [];
  for (const row of data ?? []) {
    out.push({ property_id: row.property_id, result: await syncAirbnb("cron", row.property_id) });
  }
  return out;
}

function icalDate(d: string): string {
  return d.replace(/-/g, "");
}

function stamp(d: Date = new Date()): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) {
    parts.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest) parts.push(" " + rest);
  return parts.join("\r\n");
}

/**
 * Privacy-safe export for ONE property: only dates, a neutral summary and a stable UID.
 * Airbnb-imported ranges are excluded to avoid sync loops.
 */
export async function buildExportIcs(propertyId: string): Promise<string> {
  const db = await admin();
  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    db
      .from("bookings")
      .select("id, checkin, checkout, updated_at")
      .eq("property_id", propertyId)
      .eq("status", "confirmed"),
    db
      .from("calendar_blocks")
      .select("id, start_date, end_date, updated_at, source, external_uid")
      .eq("property_id", propertyId)
      .is("external_uid", null),
  ]);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sunny Stays Hurghada//Availability//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Sunny Stays Hurghada",
  ];

  const push = (uid: string, start: string, end: string, changed: string | null) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp()}`,
      `LAST-MODIFIED:${changed ? stamp(new Date(changed)) : stamp()}`,
      `DTSTART;VALUE=DATE:${icalDate(start)}`,
      `DTEND;VALUE=DATE:${icalDate(end)}`,
      "SUMMARY:Sunny Stays – nicht verfügbar",
      "TRANSP:OPAQUE",
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  };

  for (const b of bookings ?? []) {
    push(`booking-${b.id}@sunnystays`, b.checkin, b.checkout, b.updated_at);
  }
  for (const e of blocks ?? []) {
    push(`block-${e.id}@sunnystays`, e.start_date, e.end_date, e.updated_at);
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
