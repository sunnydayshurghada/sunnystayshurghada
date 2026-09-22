import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { BlockedRange } from "@/lib/availability";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

export function createPublicSupabase() {
  const url = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase configuration");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/**
 * Public, privacy-safe availability for ONE apartment: only date ranges,
 * never guest data. Without a property id the first active apartment is used.
 */
export const getBlockedRanges = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ propertyId: z.string().uuid().nullish() }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<BlockedRange[]> => {
    const supabase = createPublicSupabase();
    const { data: rows, error } = data.propertyId
      ? await supabase.rpc("public_blocked_ranges_for", { _property_id: data.propertyId })
      : await supabase.rpc("public_blocked_ranges");
    if (error) {
      console.error("[availability] blocked ranges failed", error.message);
      return [];
    }
    return (rows ?? []) as BlockedRange[];
  });
