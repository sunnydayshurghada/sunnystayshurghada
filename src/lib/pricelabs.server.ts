/**
 * PriceLabs integration scaffold.
 *
 * No endpoints are invented here: real API calls stay disabled until a verified
 * PriceLabs API key (plan with API access) is stored as a server-side secret.
 * Credentials are read from process.env inside the functions only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PricelabsStatus = {
  configured: boolean;
  enabled: boolean;
  listingId: string | null;
  lastSyncAt: string | null;
  syncStatus: string | null;
  syncError: string | null;
};

export function pricelabsConfigured(): boolean {
  return Boolean(process.env["PRICELABS_API_KEY"]);
}

export async function getPricelabsStatus(
  db: SupabaseClient<Database>,
  propertyId: string,
): Promise<PricelabsStatus> {
  const { data } = await db
    .from("property_pricing_settings")
    .select("pricelabs_enabled, pricelabs_listing_id, pricelabs_last_sync_at, pricelabs_sync_status, pricelabs_sync_error")
    .eq("property_id", propertyId)
    .maybeSingle();
  return {
    configured: pricelabsConfigured(),
    enabled: data?.pricelabs_enabled ?? false,
    listingId: data?.pricelabs_listing_id ?? null,
    lastSyncAt: data?.pricelabs_last_sync_at ?? null,
    syncStatus: data?.pricelabs_sync_status ?? null,
    syncError: data?.pricelabs_sync_error ?? null,
  };
}

/**
 * Pulls daily prices for one apartment.
 *
 * Failure never deletes stored prices and never writes a 0 price — the last
 * successful values stay in place and the error surfaces in the admin area.
 */
export async function syncPricelabs(
  db: SupabaseClient<Database>,
  propertyId: string,
): Promise<{ ok: boolean; imported: number; error?: string }> {
  if (!pricelabsConfigured()) {
    await db
      .from("property_pricing_settings")
      .update({
        pricelabs_sync_status: "not_configured",
        pricelabs_sync_error: "missing_api_key",
      })
      .eq("property_id", propertyId);
    return { ok: false, imported: 0, error: "not_configured" };
  }

  // Real endpoint wiring is deliberately left out until API access is confirmed.
  await db
    .from("property_pricing_settings")
    .update({
      pricelabs_sync_status: "not_implemented",
      pricelabs_sync_error: "api_access_unconfirmed",
    })
    .eq("property_id", propertyId);
  return { ok: false, imported: 0, error: "api_access_unconfirmed" };
}
