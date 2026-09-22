import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createPublicSupabase } from "@/lib/availability.functions";

export type PropertySummary = {
  id: string;
  internal_name: string;
  public_name: string;
  slug: string;
  status: string;
  short_description: string | null;
  full_description: string | null;
  translations: Record<string, Record<string, string>>;
  address: string | null;
  area: string | null;
  maximum_guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  check_in_time: string;
  check_out_time: string;
  minimum_nights: number;
  maximum_nights: number;
  base_price: number;
  min_price: number;
  max_price: number;
  cleaning_fee: number;
  currency: string;
  direct_booking_enabled: boolean;
  instant_booking_enabled: boolean;
  sort_order: number;
};

const COLUMNS =
  "id, internal_name, public_name, slug, status, short_description, full_description, translations, address, area, maximum_guests, bedrooms, beds, bathrooms, check_in_time, check_out_time, minimum_nights, maximum_nights, base_price, min_price, max_price, cleaning_fee, currency, direct_booking_enabled, instant_booking_enabled, sort_order";

async function isAdmin(supabase: SupabaseClient<Database>, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !error && data !== null;
}

/** Public: every apartment that is live. */
export const listPublicProperties = createServerFn({ method: "GET" }).handler(
  async (): Promise<PropertySummary[]> => {
    const supabase = createPublicSupabase();
    const { data } = await supabase
      .from("properties")
      .select(COLUMNS)
      .eq("status", "active")
      .order("sort_order")
      .order("created_at");
    return (data ?? []) as unknown as PropertySummary[];
  },
);

export const getPropertyBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().max(200) }).parse(input))
  .handler(async ({ data }): Promise<PropertySummary | null> => {
    const supabase = createPublicSupabase();
    const { data: row } = await supabase
      .from("properties")
      .select(COLUMNS)
      .eq("slug", data.slug)
      .eq("status", "active")
      .maybeSingle();
    return (row as unknown as PropertySummary) ?? null;
  });

/** Admin: all apartments, including drafts and inactive ones. */
export const listProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PropertySummary[]> => {
    if (!(await isAdmin(context.supabase, context.userId))) return [];
    const { data } = await context.supabase
      .from("properties")
      .select(COLUMNS)
      .order("sort_order")
      .order("created_at");
    return (data ?? []) as unknown as PropertySummary[];
  });

const propertySchema = z.object({
  id: z.string().uuid().optional(),
  internal_name: z.string().trim().min(2).max(120),
  public_name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/),
  status: z.enum(["draft", "active", "inactive"]),
  short_description: z.string().trim().max(500).default(""),
  full_description: z.string().trim().max(8000).default(""),
  translations: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  address: z.string().trim().max(300).default(""),
  area: z.string().trim().max(120).default(""),
  maximum_guests: z.number().int().min(1).max(30),
  bedrooms: z.number().int().min(0).max(20),
  beds: z.number().int().min(0).max(40),
  bathrooms: z.number().int().min(0).max(20),
  check_in_time: z.string().regex(/^\d{2}:\d{2}$/).default("14:00"),
  check_out_time: z.string().regex(/^\d{2}:\d{2}$/).default("11:00"),
  minimum_nights: z.number().int().min(1).max(365).default(1),
  maximum_nights: z.number().int().min(1).max(365).default(60),
  base_price: z.number().int().min(0).default(0),
  min_price: z.number().int().min(0).default(0),
  max_price: z.number().int().min(0).default(0),
  cleaning_fee: z.number().int().min(0).default(0),
  currency: z.string().trim().length(3).default("EUR"),
  direct_booking_enabled: z.boolean().default(true),
  instant_booking_enabled: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(999).default(0),
});

/** Create or update an apartment. */
export const saveProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => propertySchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: boolean; id?: string; error?: string }> => {
    if (!(await isAdmin(context.supabase, context.userId)))
      return { ok: false, error: "forbidden" };

    const { id, ...fields } = data;
    const payload = {
      ...fields,
      short_description: fields.short_description || null,
      full_description: fields.full_description || null,
      address: fields.address || null,
      area: fields.area || null,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { error } = await context.supabase.from("properties").update(payload).eq("id", id);
      if (error) return { ok: false, error: error.message.includes("slug") ? "slug_taken" : "generic" };
      return { ok: true, id };
    }
    const { data: created, error } = await context.supabase
      .from("properties")
      .insert(payload)
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message.includes("slug") ? "slug_taken" : "generic" };
    return { ok: true, id: created.id };
  });

/** Activate / deactivate an apartment without touching its data. */
export const setPropertyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["draft", "active", "inactive"]) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    if (!(await isAdmin(context.supabase, context.userId)))
      return { ok: false, error: "forbidden" };
    const { error } = await context.supabase
      .from("properties")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) return { ok: false, error: "generic" };
    return { ok: true };
  });
