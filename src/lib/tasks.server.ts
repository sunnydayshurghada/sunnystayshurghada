/**
 * Server-only task engine: automatic task creation from bookings, status
 * workflow with history + audit, checklists and time tracking.
 * Always called with the service-role client AFTER the caller was authorised.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

export const OPEN_STATUSES = ["unassigned", "assigned", "accepted", "declined", "overdue"];
export const ACTIVE_STATUSES = ["on_the_way", "started", "paused"];
export const FINAL_STATUSES = ["done", "approved", "cancelled"];

export interface StaffAccess {
  userId: string;
  isAdmin: boolean;
  isManager: boolean;
  staffType: "team_lead" | "staff" | "contractor" | null;
  teamId: string | null;
  active: boolean;
  canViewTeam: boolean;
  canViewGuestContact: boolean;
  language: string;
  propertyIds: string[];
}

export async function getAccess(db: Db, userId: string): Promise<StaffAccess> {
  const [{ data: roles }, { data: profile }, { data: props }] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", userId),
    db.from("staff_profiles").select("*").eq("user_id", userId).maybeSingle(),
    db.from("staff_property_assignments").select("property_id").eq("user_id", userId),
  ]);
  const isAdmin = (roles ?? []).some((r) =>
    ["admin", "super_admin", "booking_manager"].includes(r.role as string),
  );
  const active = Boolean(profile?.active);
  const staffType = (profile?.staff_type ?? null) as StaffAccess["staffType"];
  return {
    userId,
    isAdmin,
    isManager: isAdmin || (active && staffType === "team_lead"),
    staffType,
    teamId: profile?.team_id ?? null,
    active,
    canViewTeam: Boolean(profile?.can_view_team_tasks),
    canViewGuestContact: Boolean(profile?.can_view_guest_contact),
    language: profile?.preferred_language ?? "de",
    propertyIds: (props ?? []).map((p) => p.property_id),
  };
}

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

/** Mirrors the database rule can_view_task (defence in depth). */
export function canSee(a: StaffAccess, t: Pick<TaskRow, "assigned_user_id" | "assigned_team_id" | "team_visible">) {
  if (a.isAdmin) return true;
  if (!a.active) return false;
  if (t.assigned_user_id === a.userId) return true;
  if (a.staffType === "team_lead" && t.assigned_team_id && t.assigned_team_id === a.teamId) return true;
  if (a.staffType === "staff" && a.canViewTeam && t.team_visible && t.assigned_team_id === a.teamId)
    return true;
  return false;
}

export function canManage(a: StaffAccess, t: Pick<TaskRow, "assigned_team_id">) {
  if (a.isAdmin) return true;
  return a.active && a.staffType === "team_lead" && !!a.teamId && t.assigned_team_id === a.teamId;
}

export async function audit(
  db: Db,
  taskId: string | null,
  actorId: string | null,
  action: string,
  detail: Record<string, unknown> = {},
) {
  await db.from("task_audit_log").insert({ task_id: taskId, actor_id: actorId, action, detail: detail as never });
}

/** ISO timestamp for a local Hurghada (Africa/Cairo) date + time. */
export function cairoIso(date: string, time: string): string {
  const guess = new Date(`${date}T${time.slice(0, 5)}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const g = (k: string) => Number(parts.find((p) => p.type === k)?.value);
  const asLocal = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
  const offset = asLocal - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

function name(label: unknown, lang = "de"): string {
  const l = (label ?? {}) as Record<string, string>;
  return l[lang] ?? l.de ?? l.en ?? "";
}

/** Copies checklist templates (property-specific ones replace the global list). */
export async function instantiateChecklist(db: Db, taskId: string, typeId: string, propertyId: string) {
  const { data: tpl } = await db
    .from("task_checklist_templates")
    .select("*")
    .eq("task_type_id", typeId)
    .eq("active", true)
    .order("sort_order");
  const rows = tpl ?? [];
  const own = rows.filter((r) => r.property_id === propertyId);
  const use = own.length ? own : rows.filter((r) => !r.property_id);
  if (!use.length) return;
  await db.from("task_checklist_items").insert(
    use.map((r) => ({
      task_id: taskId,
      label: JSON.stringify(r.label),
      required: r.required,
      sort_order: r.sort_order,
    })),
  );
}

interface StaySource {
  bookingId?: string | null;
  blockId?: string | null;
  propertyId: string;
  checkin: string;
  checkout: string;
  label: string;
}

/**
 * Creates the automatic tasks for a stay. Idempotent: an automation key per
 * rule plus a unique index guarantee no duplicates on repeated syncs.
 */
export async function generateTasksForStay(db: Db, s: StaySource, actorId: string | null) {
  const [{ data: rules }, { data: prop }] = await Promise.all([
    db
      .from("task_automation_rules")
      .select("*, type:task_types(*)")
      .eq("property_id", s.propertyId)
      .eq("active", true),
    db.from("properties").select("check_in_time, check_out_time, public_name").eq("id", s.propertyId).maybeSingle(),
  ]);
  let created = 0;
  for (const r of rules ?? []) {
    const type = (r as unknown as { type: Database["public"]["Tables"]["task_types"]["Row"] }).type;
    if (!type?.active) continue;
    const key = `auto:${type.key}:${r.anchor}`;
    let q = db.from("tasks").select("id").eq("automation_key", key);
    q = s.bookingId ? q.eq("booking_id", s.bookingId) : q.eq("calendar_block_id", s.blockId!);
    const { data: exists } = await q.maybeSingle();
    if (exists) continue;

    const baseDate = r.anchor === "checkin" ? s.checkin : s.checkout;
    const baseTime = r.anchor === "checkin" ? (prop?.check_in_time ?? "14:00") : (prop?.check_out_time ?? "11:00");
    const start = new Date(Date.parse(cairoIso(baseDate, baseTime)) + r.offset_minutes * 60_000);
    const end = new Date(start.getTime() + type.default_duration_minutes * 60_000);
    // Preparation tasks are due at the guest's arrival at the latest.
    const due = r.anchor === "checkin" ? new Date(Date.parse(cairoIso(s.checkin, baseTime))) : end;

    const { data: task, error } = await db
      .from("tasks")
      .insert({
        property_id: s.propertyId,
        booking_id: s.bookingId ?? null,
        calendar_block_id: s.blockId ?? null,
        task_type_id: type.id,
        automation_key: key,
        title: `${name(type.name)} – ${s.label}`,
        priority: r.priority,
        status: r.default_assignee ? "assigned" : "unassigned",
        assigned_user_id: r.default_assignee,
        scheduled_date: start.toISOString().slice(0, 10),
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        due_at: due.toISOString(),
        requires_photos: type.requires_photos,
        requires_checklist: type.requires_checklist,
        created_by: actorId,
      })
      .select("id, status")
      .single();
    if (error || !task) continue; // unique index hit by a parallel run
    await instantiateChecklist(db, task.id, type.id, s.propertyId);
    await db.from("task_status_history").insert({
      task_id: task.id,
      old_status: null,
      new_status: task.status,
      changed_by: actorId,
      comment: "automatic",
    });
    await audit(db, task.id, actorId, "created", { automatic: true, rule: r.id });
    created++;
  }
  return created;
}

export async function generateTasksForBooking(db: Db, bookingId: string, actorId: string | null) {
  const { data: b } = await db
    .from("bookings")
    .select("id, property_id, checkin, checkout, status, booking_number, guest_name")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b || b.status !== "confirmed") return 0;
  return generateTasksForStay(
    db,
    {
      bookingId: b.id,
      propertyId: b.property_id,
      checkin: b.checkin,
      checkout: b.checkout,
      label: b.booking_number ?? b.checkin,
    },
    actorId,
  );
}

export async function generateTasksForBlock(db: Db, blockId: string, actorId: string | null) {
  const { data: c } = await db.from("calendar_blocks").select("*").eq("id", blockId).maybeSingle();
  if (!c || c.entry_type !== "booking") return 0; // plain closures need no service
  return generateTasksForStay(
    db,
    {
      blockId: c.id,
      propertyId: c.property_id,
      checkin: c.start_date,
      checkout: c.end_date,
      label: c.source === "airbnb" ? `Airbnb ${c.start_date}` : c.start_date,
    },
    actorId,
  );
}

/**
 * Stay cancelled: not-yet-started tasks are cancelled; started, finished or
 * costed tasks are kept and the management is told about possible costs.
 */
export async function cancelTasksForStay(
  db: Db,
  ref: { bookingId?: string; blockId?: string },
  actorId: string | null,
  reason: string,
) {
  let q = db.from("tasks").select("id, status, title, actual_cost, estimated_cost, property_id, currency");
  q = ref.bookingId ? q.eq("booking_id", ref.bookingId) : q.eq("calendar_block_id", ref.blockId!);
  const { data: tasks } = await q;
  const kept: string[] = [];
  let cancelled = 0;
  for (const t of tasks ?? []) {
    if (t.status === "cancelled") continue;
    if (OPEN_STATUSES.includes(t.status) && !t.actual_cost) {
      await setStatus(db, t.id, "cancelled", actorId, reason, { force: true });
      cancelled++;
    } else {
      kept.push(`${t.title} (${t.status}${t.actual_cost ? `, ${t.actual_cost / 100} ${t.currency}` : ""})`);
      await audit(db, t.id, actorId, "kept_after_cancellation", { reason });
    }
  }
  if (kept.length) {
    try {
      const { notifyOperational, safeNotify } = await import("@/lib/notifications.server");
      await safeNotify(
        () =>
          notifyOperational(
            "calendar_conflict",
            tasks?.[0]?.property_id ?? null,
            `Stornierung: ${kept.length} Aufgabe(n) wurden bereits begonnen oder sind kostenpflichtig und bleiben bestehen – bitte mögliche Kosten prüfen: ${kept.join("; ")}`,
          ),
        "task cancellation notice",
      );
    } catch (e) {
      console.error("[tasks] cancellation notice failed", e);
    }
  }
  return { cancelled, kept: kept.length };
}

/** Stay dates changed (e.g. Airbnb): move tasks that have not started yet. */
export async function rescheduleForBlock(db: Db, blockId: string, actorId: string | null) {
  const { data: open } = await db
    .from("tasks")
    .select("id")
    .eq("calendar_block_id", blockId)
    .in("status", OPEN_STATUSES);
  if (!open?.length) return;
  for (const t of open) await setStatus(db, t.id, "cancelled", actorId, "rescheduled", { force: true });
  // New automation keys would collide, so free them before regenerating.
  await db
    .from("tasks")
    .update({ automation_key: null })
    .in("id", open.map((t) => t.id));
  await generateTasksForBlock(db, blockId, actorId);
}

const TRANSITIONS: Record<string, string[]> = {
  unassigned: ["assigned", "cancelled"],
  assigned: ["accepted", "declined", "assigned", "unassigned", "cancelled"],
  accepted: ["on_the_way", "started", "assigned", "unassigned", "cancelled", "declined"],
  declined: ["assigned", "unassigned", "cancelled"],
  on_the_way: ["started", "cancelled"],
  started: ["paused", "done", "cancelled"],
  paused: ["started", "done", "cancelled"],
  done: ["approved", "rework"],
  rework: ["started", "on_the_way", "done", "assigned", "cancelled"],
  approved: ["rework"],
  overdue: ["accepted", "started", "on_the_way", "assigned", "cancelled"],
  cancelled: [],
};

export async function closeOpenTime(db: Db, taskId: string) {
  const now = new Date().toISOString();
  await db.from("task_time_entries").update({ ended_at: now }).eq("task_id", taskId).is("ended_at", null);
}

export async function recomputeWorked(db: Db, taskId: string) {
  const { data } = await db.from("task_time_entries").select("*").eq("task_id", taskId).eq("kind", "work");
  const mins = (data ?? []).reduce((s, e) => {
    if (e.corrected_minutes !== null) return s + e.corrected_minutes;
    const end = e.ended_at ? Date.parse(e.ended_at) : Date.now();
    return s + Math.max(0, Math.round((end - Date.parse(e.started_at)) / 60000));
  }, 0);
  await db.from("tasks").update({ worked_minutes: mins }).eq("id", taskId);
  return mins;
}

export async function setStatus(
  db: Db,
  taskId: string,
  next: string,
  actorId: string | null,
  comment: string | null,
  opts: { force?: boolean; timeUser?: string } = {},
): Promise<{ ok: true } | { error: string }> {
  const { data: t } = await db.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (!t) return { error: "not_found" };
  const current = t.status;
  if (!opts.force && !(TRANSITIONS[current] ?? []).includes(next)) return { error: "invalid_transition" };

  if (next === "done") {
    const { data: items } = await db.from("task_checklist_items").select("required, done").eq("task_id", taskId);
    if ((items ?? []).some((i) => i.required && !i.done)) return { error: "checklist_incomplete" };
    if (t.requires_photos) {
      const { count } = await db
        .from("task_attachments")
        .select("id", { count: "exact", head: true })
        .eq("task_id", taskId)
        .in("category", ["after", "before", "damage"]);
      if (!count) return { error: "photos_required" };
    }
  }

  const now = new Date().toISOString();
  const patch: Database["public"]["Tables"]["tasks"]["Update"] = { status: next };
  const worker = opts.timeUser ?? t.assigned_user_id;

  // time tracking
  if (next === "started" && worker) {
    await closeOpenTime(db, taskId);
    await db.from("task_time_entries").insert({ task_id: taskId, user_id: worker, kind: "work" });
    if (!t.started_at) patch.started_at = now;
  }
  if (next === "paused" && worker) {
    await closeOpenTime(db, taskId);
    await db.from("task_time_entries").insert({ task_id: taskId, user_id: worker, kind: "pause" });
  }
  if (["done", "cancelled"].includes(next)) await closeOpenTime(db, taskId);
  if (next === "done") patch.completed_at = now;
  if (next === "cancelled") {
    patch.cancelled_at = now;
    patch.cancellation_reason = comment;
  }
  if (next === "rework") patch.completed_at = null;

  await db.from("tasks").update(patch).eq("id", taskId);
  if (["started", "paused", "done", "cancelled"].includes(next)) await recomputeWorked(db, taskId);
  await db.from("task_status_history").insert({
    task_id: taskId,
    old_status: current,
    new_status: next,
    changed_by: actorId,
    comment,
  });
  await audit(db, taskId, actorId, `status:${next}`, { from: current, comment });
  return { ok: true };
}

export function effectiveStatus(t: Pick<TaskRow, "status" | "due_at">): string {
  if (t.due_at && Date.parse(t.due_at) < Date.now() && ["unassigned", "assigned", "accepted", "declined", "on_the_way", "rework"].includes(t.status))
    return "overdue";
  return t.status;
}

export function checklistLabel(raw: string, lang: string): string {
  try {
    const l = JSON.parse(raw) as Record<string, string>;
    return l[lang] ?? l.de ?? l.en ?? raw;
  } catch {
    return raw;
  }
}
