/**
 * Server-only iCal helpers: Airbnb import + privacy-safe export feed.
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

async function admin(): Promise<SupabaseClient<Database>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient<Database>;
}

export async function getSettings() {
  const db = await admin();
  const { data } = await db.from("ical_settings").select("*").eq("id", true).maybeSingle();
  if (data) return data;
  const { data: created } = await db
    .from("ical_settings")
    .insert({ id: true })
    .select("*")
    .single();
  return created!;
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
): Promise<SyncResult> {
  const db = await admin();
  const settings = await getSettings();
  const url = settings.airbnb_ical_url;

  const finish = async (result: SyncResult, message?: string) => {
    await db.from("ical_settings").update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: result.ok ? "ok" : "error",
      last_sync_error: result.ok ? null : (result.error ?? null),
      last_sync_imported: result.imported,
      updated_at: new Date().toISOString(),
    }).eq("id", true);
    await db.from("ical_sync_log").insert({
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

  // Ranges gone from the Airbnb feed (cancelled) are released again.
  const { data: removedRows } = await db
    .from("calendar_blocks")
    .delete()
    .eq("source", "airbnb")
    .not("external_uid", "is", null)
    .lt("last_seen_at", now)
    .select("id");

  return finish({ ok: true, imported, removed: removedRows?.length ?? 0 });
}

function icalDate(d: string): string {
  return d.replace(/-/g, "");
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
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
 * Privacy-safe export: only dates, a neutral summary and a stable UID.
 * Airbnb-imported ranges are excluded to avoid sync loops.
 */
export async function buildExportIcs(): Promise<string> {
  const db = await admin();
  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    db.from("bookings").select("id, checkin, checkout, updated_at").eq("status", "confirmed"),
    db
      .from("calendar_blocks")
      .select("id, start_date, end_date, updated_at, source, external_uid")
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
      `LAST-MODIFIED:${changed ? changed.replace(/[-:]/g, "").replace(/\.\d+/, "") : stamp()}`,
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
