import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/email-defaults";
import type { NotificationEvent } from "@/lib/notifications.server";

/**
 * Re-sends every failed delivery of one property. Each retry writes a fresh
 * log row; the original failed row is marked as retried so it is not picked up
 * twice.
 */
export async function retryFailedForProperty(
  db: SupabaseClient<Database>,
  propertyId: string,
): Promise<number> {
  const { data: rows } = await db
    .from("email_notifications")
    .select("id, template, booking_id")
    .eq("property_id", propertyId)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!rows?.length) return 0;

  const { notifyGuest, notifyInternal } = await import("@/lib/notifications.server");
  let retried = 0;

  for (const row of rows) {
    if (!row.booking_id) continue;
    try {
      if ((TEMPLATE_KEYS as readonly string[]).includes(row.template)) {
        await notifyGuest(row.booking_id, row.template as TemplateKey);
      } else if (row.template.startsWith("internal_") || row.template.startsWith("owner_")) {
        const event = row.template.replace(/^(internal|owner)_/, "") as NotificationEvent;
        await notifyInternal(event, row.booking_id);
      } else {
        continue;
      }
      await db.from("email_notifications").update({ status: "retried" }).eq("id", row.id);
      retried += 1;
    } catch (e) {
      console.error("[notify] retry failed", e);
    }
  }
  return retried;
}
