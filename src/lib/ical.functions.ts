import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type SyncLogEntry = {
  id: string;
  ran_at: string;
  status: string;
  imported: number;
  removed: number;
  trigger_source: string;
  message: string | null;
};

export type IcalStatus = {
  isAdmin: boolean;
  propertyId: string | null;
  hasUrl: boolean;
  urlHint: string | null;
  exportToken: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  importedCount: number;
  nextSyncAt: string | null;
  log: SyncLogEntry[];
};

const propertyInput = z.object({ propertyId: z.string().uuid().nullish() });

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !error && data !== null;
}

function maskUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.host}/…${url.slice(-6)}`;
  } catch {
    return `…${url.slice(-6)}`;
  }
}

const EMPTY: IcalStatus = {
  isAdmin: false,
  propertyId: null,
  hasUrl: false,
  urlHint: null,
  exportToken: null,
  lastSyncAt: null,
  lastSyncStatus: null,
  lastSyncError: null,
  importedCount: 0,
  nextSyncAt: null,
  log: [],
};

async function resolveProperty(propertyId?: string | null): Promise<string | null> {
  if (propertyId) return propertyId;
  const { defaultPropertyId } = await import("@/lib/ical.server");
  return defaultPropertyId();
}

async function buildStatus(propertyId: string): Promise<IcalStatus> {
  const { getIntegration } = await import("@/lib/ical.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const settings = await getIntegration(propertyId);
  const { data: log } = await supabaseAdmin
    .from("ical_sync_log")
    .select("id, ran_at, status, imported, removed, trigger_source, message")
    .eq("property_id", propertyId)
    .order("ran_at", { ascending: false })
    .limit(10);
  const { count } = await supabaseAdmin
    .from("calendar_blocks")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .eq("source", "airbnb")
    .not("external_uid", "is", null);

  const next = settings.last_sync_at
    ? new Date(new Date(settings.last_sync_at).getTime() + 15 * 60_000).toISOString()
    : null;

  return {
    isAdmin: true,
    propertyId,
    hasUrl: Boolean(settings.airbnb_ical_url),
    urlHint: maskUrl(settings.airbnb_ical_url),
    exportToken: settings.export_token,
    lastSyncAt: settings.last_sync_at,
    lastSyncStatus: settings.last_sync_status,
    lastSyncError: settings.last_sync_error,
    importedCount: count ?? 0,
    nextSyncAt: next,
    log: (log ?? []) as SyncLogEntry[],
  };
}

export const getIcalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => propertyInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<IcalStatus> => {
    if (!(await assertAdmin(context.supabase, context.userId))) return EMPTY;
    const pid = await resolveProperty(data.propertyId);
    if (!pid) return { ...EMPTY, isAdmin: true };
    return buildStatus(pid);
  });

export const setAirbnbIcalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    propertyInput.extend({ url: z.string().trim().max(2000) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    if (!(await assertAdmin(context.supabase, context.userId)))
      return { ok: false, error: "forbidden" };

    const value = data.url.trim();
    if (value && !/^https?:\/\//i.test(value)) return { ok: false, error: "invalid_url" };

    const pid = await resolveProperty(data.propertyId);
    if (!pid) return { ok: false, error: "generic" };
    const { getIntegration } = await import("@/lib/ical.server");
    await getIntegration(pid);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("calendar_integrations")
      .update({ airbnb_ical_url: value || null, updated_at: new Date().toISOString() })
      .eq("property_id", pid);
    if (error) return { ok: false, error: "generic" };
    return { ok: true };
  });

export const rotateExportToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => propertyInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    if (!(await assertAdmin(context.supabase, context.userId)))
      return { ok: false, error: "forbidden" };
    const pid = await resolveProperty(data.propertyId);
    if (!pid) return { ok: false, error: "generic" };
    const { getIntegration } = await import("@/lib/ical.server");
    await getIntegration(pid);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().slice(0, 8);
    const { error } = await supabaseAdmin
      .from("calendar_integrations")
      .update({ export_token: token, updated_at: new Date().toISOString() })
      .eq("property_id", pid);
    if (error) return { ok: false, error: "generic" };
    return { ok: true };
  });

export const syncAirbnbNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => propertyInput.parse(input ?? {}))
  .handler(
    async ({ data, context }): Promise<{ ok: boolean; error?: string; imported?: number }> => {
      if (!(await assertAdmin(context.supabase, context.userId)))
        return { ok: false, error: "forbidden" };
      const pid = await resolveProperty(data.propertyId);
      if (!pid) return { ok: false, error: "generic" };
      const { syncAirbnb } = await import("@/lib/ical.server");
      const res = await syncAirbnb("manual", pid);
      return { ok: res.ok, error: res.error, imported: res.imported };
    },
  );
