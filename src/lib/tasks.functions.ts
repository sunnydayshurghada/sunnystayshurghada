import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();

async function ctxAccess(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getAccess } = await import("@/lib/tasks.server");
  return { db: supabaseAdmin, access: await getAccess(supabaseAdmin, userId) };
}

function typeName(n: unknown, lang: string) {
  const l = (n ?? {}) as Record<string, string>;
  return l[lang] ?? l.de ?? l.en ?? "";
}

/* ---------------------------------------------------------------- session */

export const getStaffSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, access } = await ctxAccess(context.userId);
    const { data: owner } = await db
      .from("user_profiles")
      .select("role, active")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      isAdmin: access.isAdmin,
      isStaff: access.active && access.staffType !== null,
      staffType: access.staffType,
      isOwner: owner?.role === "owner" && owner.active,
      language: access.language,
    };
  });

/* ------------------------------------------------------------ staff side */

export interface StaffTaskCard {
  id: string;
  title: string;
  type_name: string;
  type_key: string;
  property_name: string;
  address: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  due_at: string | null;
  priority: string;
  status: string;
  effective_status: string;
  property_id: string;
  task_type_id: string;
  booking_ref: string | null;
  checklist_done: number;
  checklist_total: number;
  completed_at: string | null;
}

async function cards(db: any, rows: any[], lang: string, statusFn: (t: any) => string): Promise<StaffTaskCard[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const { data: items } = await db.from("task_checklist_items").select("task_id, done").in("task_id", ids);
  return rows.map((t) => {
    const mine = (items ?? []).filter((i: any) => i.task_id === t.id);
    return {
      id: t.id,
      title: t.title,
      type_name: typeName(t.type?.name, lang),
      type_key: t.type?.key ?? "",
      property_name: t.property?.public_name ?? "",
      address: t.property?.address ?? null,
      scheduled_start: t.scheduled_start,
      scheduled_end: t.scheduled_end,
      due_at: t.due_at,
      priority: t.priority,
      status: t.status,
      effective_status: statusFn(t),
      property_id: t.property_id,
      task_type_id: t.task_type_id,
      booking_ref: t.booking?.booking_number ?? (t.calendar_block_id ? "Airbnb/Manuell" : null),
      checklist_done: mine.filter((i: any) => i.done).length,
      checklist_total: mine.length,
      completed_at: t.completed_at,
    };
  });
}

const TASK_SELECT =
  "*, type:task_types(key, name, guest_contact_allowed, materials), property:properties(public_name, address), booking:bookings(booking_number)";

export const listMyTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ lang: z.string().max(5).default("de") }).parse(i))
  .handler(async ({ data, context }): Promise<{ tasks: StaffTaskCard[] } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    if (!access.active || !access.staffType) return { error: "forbidden" };
    const { effectiveStatus, canSee } = await import("@/lib/tasks.server");
    const since = new Date(Date.now() - 14 * 86400_000).toISOString();
    let q = db.from("tasks").select(TASK_SELECT).gte("scheduled_start", since).order("scheduled_start").limit(300);
    // Contractors only ever see tasks assigned to them.
    if (access.staffType === "contractor" || !access.teamId) q = q.eq("assigned_user_id", context.userId);
    else q = q.or(`assigned_user_id.eq.${context.userId},assigned_team_id.eq.${access.teamId}`);
    const { data: rows } = await q;
    const visible = (rows ?? []).filter((t) => canSee(access, t));
    return { tasks: await cards(db, visible, data.lang, effectiveStatus) };
  });

export interface TaskDetail extends StaffTaskCard {
  description: string | null;
  employee_notes: string | null;
  internal_notes: string | null;
  owner_visible_notes: string | null;
  materials: string | null;
  requires_photos: boolean;
  worked_minutes: number;
  guest: { name: string; phone: string | null; guests: number } | null;
  stay: { checkin: string; checkout: string } | null;
  contact: string | null;
  checklist: { id: string; label: string; required: boolean; done: boolean }[];
  attachments: { id: string; category: string; description: string | null; visibility: string; url: string | null; file_type: string | null; created_at: string }[];
  history: { old_status: string | null; new_status: string; comment: string | null; created_at: string }[];
  can_manage: boolean;
  is_assignee: boolean;
  assigned_user_id: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  currency: string;
}

export const getTaskDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: uuid, lang: z.string().max(5).default("de") }).parse(i))
  .handler(async ({ data, context }): Promise<TaskDetail | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    const { canSee, canManage, effectiveStatus, checklistLabel } = await import("@/lib/tasks.server");
    const { data: t } = await db.from("tasks").select(TASK_SELECT).eq("id", data.id).maybeSingle();
    if (!t || !canSee(access, t)) return { error: "forbidden" };
    const [card] = await cards(db, [t], data.lang, effectiveStatus);
    const [{ data: items }, { data: atts }, { data: hist }, { data: prop }] = await Promise.all([
      db.from("task_checklist_items").select("*").eq("task_id", t.id).order("sort_order"),
      db.from("task_attachments").select("*").eq("task_id", t.id).order("created_at"),
      db.from("task_status_history").select("*").eq("task_id", t.id).order("created_at"),
      db.from("properties").select("host_contact").eq("id", t.property_id).maybeSingle(),
    ]);
    const manage = canManage(access, t);
    const visibleAtts = (atts ?? []).filter((a) => access.isAdmin || a.visibility !== "admin");
    const urls = await Promise.all(
      visibleAtts.map((a) => db.storage.from("task-files").createSignedUrl(a.file_path, 600)),
    );

    // Guest data only when the task needs it (reception, transfer, …).
    let guest: TaskDetail["guest"] = null;
    let stay: TaskDetail["stay"] = null;
    const allowContact = access.isAdmin || (t.type?.guest_contact_allowed && access.canViewGuestContact);
    if (t.booking_id) {
      const { data: b } = await db
        .from("bookings")
        .select("guest_name, guest_phone, guests, checkin, checkout")
        .eq("id", t.booking_id)
        .maybeSingle();
      if (b) {
        stay = { checkin: b.checkin, checkout: b.checkout };
        guest = {
          name: allowContact ? b.guest_name : b.guest_name.split(" ")[0],
          phone: allowContact ? b.guest_phone : null,
          guests: b.guests,
        };
      }
    } else if (t.calendar_block_id) {
      const { data: c } = await db
        .from("calendar_blocks")
        .select("guest_name, guest_phone, guests, start_date, end_date")
        .eq("id", t.calendar_block_id)
        .maybeSingle();
      if (c) {
        stay = { checkin: c.start_date, checkout: c.end_date };
        if (c.guest_name || c.guests)
          guest = {
            name: allowContact ? (c.guest_name ?? "") : (c.guest_name ?? "").split(" ")[0],
            phone: allowContact ? c.guest_phone : null,
            guests: c.guests ?? 0,
          };
      }
    }

    return {
      ...card,
      description: t.description,
      employee_notes: t.employee_notes,
      internal_notes: access.isManager ? t.internal_notes : null,
      owner_visible_notes: access.isManager ? t.owner_visible_notes : null,
      materials: t.type?.materials ?? null,
      requires_photos: t.requires_photos,
      worked_minutes: t.worked_minutes,
      guest,
      stay,
      contact: prop?.host_contact ?? null,
      checklist: (items ?? []).map((i) => ({
        id: i.id,
        label: checklistLabel(i.label, data.lang),
        required: i.required,
        done: i.done,
      })),
      attachments: visibleAtts.map((a, i) => ({
        id: a.id,
        category: a.category,
        description: a.description,
        visibility: a.visibility,
        url: urls[i].data?.signedUrl ?? null,
        file_type: a.file_type,
        created_at: a.created_at,
      })),
      history: (hist ?? []).map((h) => ({
        old_status: h.old_status,
        new_status: h.new_status,
        comment: h.comment,
        created_at: h.created_at,
      })),
      can_manage: manage,
      is_assignee: t.assigned_user_id === context.userId,
      assigned_user_id: t.assigned_user_id,
      estimated_cost: access.isManager ? t.estimated_cost : null,
      actual_cost: access.isManager ? t.actual_cost : null,
      currency: t.currency,
    };
  });

const STAFF_ACTIONS: Record<string, string> = {
  accept: "accepted",
  decline: "declined",
  on_the_way: "on_the_way",
  start: "started",
  pause: "paused",
  resume: "started",
  finish: "done",
};

export const staffTaskAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: uuid,
        action: z.enum(["accept", "decline", "on_the_way", "start", "pause", "resume", "finish"]),
        comment: z.string().trim().max(1000).nullish(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    const { data: t } = await db.from("tasks").select("*").eq("id", data.id).maybeSingle();
    // Status changes and time tracking only for the assigned person.
    if (!t || !access.active || t.assigned_user_id !== context.userId) return { error: "forbidden" };
    const { setStatus } = await import("@/lib/tasks.server");
    const res = await setStatus(db, data.id, STAFF_ACTIONS[data.action], context.userId, data.comment ?? null, {
      timeUser: context.userId,
    });
    if ("ok" in res && data.action === "decline") {
      const { notifyOperational, safeNotify } = await import("@/lib/notifications.server");
      await safeNotify(
        () => notifyOperational("calendar_conflict", t.property_id, `Aufgabe abgelehnt: ${t.title}. ${data.comment ?? ""}`),
        "task declined",
      );
    }
    return res;
  });

export const toggleChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ itemId: uuid, done: z.boolean() }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    const { data: item } = await db.from("task_checklist_items").select("task_id, label").eq("id", data.itemId).maybeSingle();
    if (!item) return { error: "not_found" };
    const { data: t } = await db.from("tasks").select("assigned_user_id, assigned_team_id, status").eq("id", item.task_id).maybeSingle();
    const { canManage, audit } = await import("@/lib/tasks.server");
    if (!t || !(t.assigned_user_id === context.userId && access.active) && !canManage(access, t))
      return { error: "forbidden" };
    if (["approved", "cancelled"].includes(t.status)) return { error: "locked" };
    await db
      .from("task_checklist_items")
      .update({ done: data.done, done_by: data.done ? context.userId : null, done_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.itemId);
    await audit(db, item.task_id, context.userId, "checklist", { item: data.itemId, done: data.done });
    return { ok: true };
  });

export const saveEmployeeNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: uuid, note: z.string().trim().max(4000) }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    const { data: t } = await db.from("tasks").select("assigned_user_id, assigned_team_id").eq("id", data.id).maybeSingle();
    const { canManage, audit } = await import("@/lib/tasks.server");
    if (!t || !(t.assigned_user_id === context.userId && access.active) && !canManage(access, t))
      return { error: "forbidden" };
    await db.from("tasks").update({ employee_notes: data.note }).eq("id", data.id);
    await audit(db, data.id, context.userId, "note");
    return { ok: true };
  });

const CATS = ["before", "after", "damage", "receipt", "invoice", "other"] as const;

export const requestTaskUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: uuid, fileName: z.string().max(200), contentType: z.string().max(100) }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ path: string; token: string } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    const { data: t } = await db.from("tasks").select("assigned_user_id, assigned_team_id, property_id").eq("id", data.id).maybeSingle();
    const { canManage } = await import("@/lib/tasks.server");
    if (!t || !(t.assigned_user_id === context.userId && access.active) && !canManage(access, t))
      return { error: "forbidden" };
    if (!/^(image\/|application\/pdf)/.test(data.contentType)) return { error: "file_type" };
    const ext = (data.fileName.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5);
    const path = `${t.property_id}/${data.id}/${crypto.randomUUID()}.${ext}`;
    const { data: signed, error } = await db.storage.from("task-files").createSignedUploadUrl(path);
    if (error || !signed) return { error: "upload_failed" };
    return { path, token: signed.token };
  });

export const registerTaskAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: uuid,
        path: z.string().max(300),
        fileType: z.string().max(100),
        category: z.enum(CATS),
        description: z.string().trim().max(500).nullish(),
        visibility: z.enum(["admin", "staff", "owner"]).default("staff"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    const { data: t } = await db.from("tasks").select("assigned_user_id, assigned_team_id, property_id").eq("id", data.id).maybeSingle();
    const { canManage, audit } = await import("@/lib/tasks.server");
    if (!t || !(t.assigned_user_id === context.userId && access.active) && !canManage(access, t))
      return { error: "forbidden" };
    if (!data.path.startsWith(`${t.property_id}/${data.id}/`)) return { error: "forbidden" };
    // Only management may release documents to owners.
    const visibility = access.isManager ? data.visibility : data.visibility === "owner" ? "staff" : data.visibility;
    await db.from("task_attachments").insert({
      task_id: data.id,
      uploaded_by: context.userId,
      file_path: data.path,
      file_type: data.fileType,
      category: data.category,
      description: data.description ?? null,
      visibility,
    });
    await audit(db, data.id, context.userId, "upload", { category: data.category });
    return { ok: true };
  });

/* ------------------------------------------------------------ admin side */

export interface AdminTaskRow extends StaffTaskCard {
  assigned_user_id: string | null;
  assignee_name: string | null;
  assigned_team_id: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  currency: string;
  worked_minutes: number;
  conflict: boolean;
}

export interface StaffOption {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  staff_type: string;
  team_id: string | null;
  active: boolean;
  available: boolean;
  preferred_language: string;
  can_view_team_tasks: boolean;
  can_view_guest_contact: boolean;
  default_hourly_rate: number | null;
  default_fixed_rate: number | null;
  currency: string;
  notes: string | null;
  property_ids: string[];
  task_type_ids: string[];
  open_tasks: number;
}

export interface TaskDashboard {
  tasks: AdminTaskRow[];
  staff: StaffOption[];
  teams: { id: string; name: string }[];
  types: { id: string; key: string; name: string }[];
  properties: { id: string; name: string }[];
  isAdmin: boolean;
}

export const getTaskDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ from: z.string(), to: z.string(), lang: z.string().max(5).default("de") }).parse(i),
  )
  .handler(async ({ data, context }): Promise<TaskDashboard | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    if (!access.isManager) return { error: "forbidden" };
    const { effectiveStatus } = await import("@/lib/tasks.server");
    let q = db
      .from("tasks")
      .select(TASK_SELECT)
      .gte("scheduled_start", `${data.from}T00:00:00Z`)
      .lte("scheduled_start", `${data.to}T23:59:59Z`)
      .order("scheduled_start")
      .limit(1000);
    if (!access.isAdmin) q = q.eq("assigned_team_id", access.teamId ?? "00000000-0000-0000-0000-000000000000");
    const [{ data: rows }, { data: staff }, { data: teams }, { data: types }, { data: props }, { data: spa }, { data: stta }, { data: openRows }] =
      await Promise.all([
        q,
        db.from("staff_profiles").select("*").order("first_name"),
        db.from("teams").select("id, name").eq("active", true),
        db.from("task_types").select("id, key, name").eq("active", true).order("sort_order"),
        db.from("properties").select("id, public_name").order("sort_order"),
        db.from("staff_property_assignments").select("user_id, property_id"),
        db.from("staff_task_type_assignments").select("user_id, task_type_id"),
        db.from("tasks").select("assigned_user_id").not("status", "in", "(done,approved,cancelled)").not("assigned_user_id", "is", null),
      ]);
    const nameOf = new Map((staff ?? []).map((s) => [s.user_id, `${s.first_name} ${s.last_name}`.trim() || s.email]));
    const list = rows ?? [];
    const base = await cards(db, list, data.lang, effectiveStatus);
    const tasks: AdminTaskRow[] = base.map((c, i) => {
      const t = list[i];
      const conflict =
        !!t.assigned_user_id &&
        !["cancelled", "done", "approved"].includes(t.status) &&
        list.some(
          (o) =>
            o.id !== t.id &&
            o.assigned_user_id === t.assigned_user_id &&
            !["cancelled", "done", "approved"].includes(o.status) &&
            o.scheduled_start && t.scheduled_start && o.scheduled_end && t.scheduled_end &&
            o.scheduled_start < t.scheduled_end && t.scheduled_start < o.scheduled_end,
        );
      return {
        ...c,
        assigned_user_id: t.assigned_user_id,
        assignee_name: t.assigned_user_id ? (nameOf.get(t.assigned_user_id) ?? null) : null,
        assigned_team_id: t.assigned_team_id,
        estimated_cost: t.estimated_cost,
        actual_cost: t.actual_cost,
        currency: t.currency,
        worked_minutes: t.worked_minutes,
        conflict,
      };
    });
    const visibleStaff = (staff ?? []).filter((s) => access.isAdmin || s.team_id === access.teamId);
    return {
      tasks,
      staff: visibleStaff.map((s) => ({
        user_id: s.user_id,
        name: nameOf.get(s.user_id) ?? s.email,
        email: s.email,
        phone: s.phone,
        staff_type: s.staff_type,
        team_id: s.team_id,
        active: s.active,
        available: s.available,
        preferred_language: s.preferred_language,
        can_view_team_tasks: s.can_view_team_tasks,
        can_view_guest_contact: s.can_view_guest_contact,
        default_hourly_rate: access.isAdmin ? s.default_hourly_rate : null,
        default_fixed_rate: access.isAdmin ? s.default_fixed_rate : null,
        currency: s.currency,
        notes: access.isAdmin ? s.notes : null,
        property_ids: (spa ?? []).filter((a) => a.user_id === s.user_id).map((a) => a.property_id),
        task_type_ids: (stta ?? []).filter((a) => a.user_id === s.user_id).map((a) => a.task_type_id),
        open_tasks: (openRows ?? []).filter((r) => r.assigned_user_id === s.user_id).length,
      })),
      teams: teams ?? [],
      types: (types ?? []).map((t) => ({ id: t.id, key: t.key, name: typeName(t.name, data.lang) })),
      properties: (props ?? []).map((p) => ({ id: p.id, name: p.public_name })),
      isAdmin: access.isAdmin,
    };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        property_id: uuid,
        task_type_id: uuid,
        title: z.string().trim().min(2).max(200),
        description: z.string().trim().max(2000).nullish(),
        priority: z.enum(["low", "normal", "high", "urgent"]),
        scheduled_start: z.string(),
        duration_minutes: z.number().int().min(5).max(1440).default(60),
        assigned_user_id: uuid.nullish(),
        assigned_team_id: uuid.nullish(),
        internal_notes: z.string().trim().max(2000).nullish(),
        estimated_cost: z.number().int().min(0).nullish(),
        currency: z.enum(["EGP", "EUR", "USD"]).default("EGP"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; id: string } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    if (!access.isManager) return { error: "forbidden" };
    const team = access.isAdmin ? (data.assigned_team_id ?? null) : access.teamId;
    const { data: type } = await db.from("task_types").select("*").eq("id", data.task_type_id).maybeSingle();
    if (!type) return { error: "not_found" };
    const start = new Date(data.scheduled_start);
    if (Number.isNaN(start.getTime())) return { error: "invalid_date" };
    const end = new Date(start.getTime() + data.duration_minutes * 60_000);
    const { data: t, error } = await db
      .from("tasks")
      .insert({
        property_id: data.property_id,
        task_type_id: data.task_type_id,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        status: data.assigned_user_id ? "assigned" : "unassigned",
        assigned_user_id: data.assigned_user_id ?? null,
        assigned_team_id: team,
        scheduled_date: start.toISOString().slice(0, 10),
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        due_at: end.toISOString(),
        internal_notes: data.internal_notes ?? null,
        estimated_cost: data.estimated_cost ?? null,
        currency: data.currency,
        requires_photos: type.requires_photos,
        requires_checklist: type.requires_checklist,
        created_by: context.userId,
      })
      .select("id, status")
      .single();
    if (error || !t) return { error: "generic" };
    const { instantiateChecklist, audit } = await import("@/lib/tasks.server");
    await instantiateChecklist(db, t.id, type.id, data.property_id);
    await db.from("task_status_history").insert({ task_id: t.id, new_status: t.status, changed_by: context.userId });
    await audit(db, t.id, context.userId, "created", {});
    return { ok: true, id: t.id };
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: uuid,
        assigned_user_id: uuid.nullish(),
        assigned_team_id: uuid.nullish(),
        team_visible: z.boolean().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        scheduled_start: z.string().optional(),
        due_at: z.string().optional(),
        internal_notes: z.string().trim().max(2000).nullish(),
        owner_visible_notes: z.string().trim().max(2000).nullish(),
        estimated_cost: z.number().int().min(0).nullish(),
        actual_cost: z.number().int().min(0).nullish(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    const { data: t } = await db.from("tasks").select("*").eq("id", data.id).maybeSingle();
    const { canManage, audit, setStatus } = await import("@/lib/tasks.server");
    if (!t || !canManage(access, t)) return { error: "forbidden" };
    if (["approved", "cancelled"].includes(t.status) && data.assigned_user_id !== undefined) return { error: "locked" };

    const patch: Record<string, unknown> = {};
    if (data.assigned_user_id !== undefined) {
      if (data.assigned_user_id) {
        const { data: sp } = await db
          .from("staff_profiles")
          .select("active, team_id")
          .eq("user_id", data.assigned_user_id)
          .maybeSingle();
        if (!sp?.active) return { error: "staff_inactive" };
        if (!access.isAdmin && sp.team_id !== access.teamId) return { error: "forbidden" };
      }
      patch.assigned_user_id = data.assigned_user_id ?? null;
    }
    if (data.assigned_team_id !== undefined && access.isAdmin) patch.assigned_team_id = data.assigned_team_id;
    if (data.team_visible !== undefined) patch.team_visible = data.team_visible;
    if (data.priority) patch.priority = data.priority;
    if (data.scheduled_start) {
      const s = new Date(data.scheduled_start);
      const dur = t.scheduled_end && t.scheduled_start ? Date.parse(t.scheduled_end) - Date.parse(t.scheduled_start) : 3600_000;
      patch.scheduled_start = s.toISOString();
      patch.scheduled_end = new Date(s.getTime() + dur).toISOString();
      patch.scheduled_date = s.toISOString().slice(0, 10);
    }
    if (data.due_at) patch.due_at = new Date(data.due_at).toISOString();
    for (const k of ["internal_notes", "owner_visible_notes", "estimated_cost", "actual_cost"] as const)
      if (data[k] !== undefined) patch[k] = data[k];
    await db.from("tasks").update(patch as never).eq("id", data.id);
    await audit(db, data.id, context.userId, "updated", patch);

    if (data.assigned_user_id !== undefined && data.assigned_user_id !== t.assigned_user_id) {
      await setStatus(db, data.id, data.assigned_user_id ? "assigned" : "unassigned", context.userId, "assignment", {
        force: !["done", "approved", "cancelled"].includes(t.status) ? true : false,
      });
    }
    return { ok: true };
  });

export const reviewTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ id: uuid, action: z.enum(["approve", "rework", "cancel"]), comment: z.string().trim().max(1000).nullish() })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    const { data: t } = await db.from("tasks").select("*").eq("id", data.id).maybeSingle();
    const { canManage, setStatus } = await import("@/lib/tasks.server");
    if (!t || !canManage(access, t)) return { error: "forbidden" };
    if (data.action === "rework" && !data.comment) return { error: "comment_required" };
    const next = data.action === "approve" ? "approved" : data.action === "rework" ? "rework" : "cancelled";
    return setStatus(db, data.id, next, context.userId, data.comment ?? null, { force: data.action === "cancel" });
  });

export const addChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: uuid, label: z.string().trim().min(1).max(200), required: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    const { data: t } = await db.from("tasks").select("assigned_team_id").eq("id", data.id).maybeSingle();
    const { canManage, audit } = await import("@/lib/tasks.server");
    if (!t || !canManage(access, t)) return { error: "forbidden" };
    await db.from("task_checklist_items").insert({
      task_id: data.id,
      label: JSON.stringify({ de: data.label, en: data.label, ar: data.label }),
      required: data.required,
      sort_order: 999,
    });
    await audit(db, data.id, context.userId, "checklist_added", { label: data.label });
    return { ok: true };
  });

export const correctTaskTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: uuid, minutes: z.number().int().min(0).max(2880), reason: z.string().trim().min(3).max(500) }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    const { data: t } = await db.from("tasks").select("assigned_team_id, assigned_user_id").eq("id", data.id).maybeSingle();
    const { canManage, audit, recomputeWorked } = await import("@/lib/tasks.server");
    if (!t || !canManage(access, t)) return { error: "forbidden" };
    const { closeOpenTime } = await import("@/lib/tasks.server");
    await closeOpenTime(db, data.id);
    const { data: entries } = await db.from("task_time_entries").select("id").eq("task_id", data.id).eq("kind", "work");
    // Keep the raw entries; the correction replaces their total.
    for (const e of entries ?? [])
      await db.from("task_time_entries").update({ corrected_minutes: 0, correction_reason: data.reason, corrected_by: context.userId }).eq("id", e.id);
    await db.from("task_time_entries").insert({
      task_id: data.id,
      user_id: t.assigned_user_id ?? context.userId,
      kind: "work",
      ended_at: new Date().toISOString(),
      corrected_minutes: data.minutes,
      correction_reason: data.reason,
      corrected_by: context.userId,
    });
    await recomputeWorked(db, data.id);
    await audit(db, data.id, context.userId, "time_corrected", { minutes: data.minutes, reason: data.reason });
    return { ok: true };
  });

/** Creates missing automatic tasks for all confirmed upcoming stays (idempotent). */
export const backfillAutomaticTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; created: number } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    if (!access.isAdmin) return { error: "forbidden" };
    const { generateTasksForBooking, generateTasksForBlock } = await import("@/lib/tasks.server");
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: bookings }, { data: blocks }] = await Promise.all([
      db.from("bookings").select("id").eq("status", "confirmed").gte("checkout", today),
      db.from("calendar_blocks").select("id").eq("entry_type", "booking").gte("end_date", today),
    ]);
    let created = 0;
    for (const b of bookings ?? []) created += await generateTasksForBooking(db, b.id, context.userId);
    for (const c of blocks ?? []) created += await generateTasksForBlock(db, c.id, context.userId);
    return { ok: true, created };
  });

/* ------------------------------------------------ staff accounts (admin) */

const staffInput = z.object({
  first_name: z.string().trim().max(80).default(""),
  last_name: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(40).nullish(),
  preferred_language: z.enum(["de", "en", "ar"]).default("de"),
  staff_type: z.enum(["team_lead", "staff", "contractor"]).default("staff"),
  team_id: uuid.nullish(),
  active: z.boolean().default(true),
  available: z.boolean().default(true),
  can_view_team_tasks: z.boolean().default(false),
  can_view_guest_contact: z.boolean().default(false),
  default_hourly_rate: z.number().int().min(0).nullish(),
  default_fixed_rate: z.number().int().min(0).nullish(),
  currency: z.enum(["EGP", "EUR", "USD"]).default("EGP"),
  notes: z.string().trim().max(2000).nullish(),
  property_ids: z.array(uuid).default([]),
  task_type_ids: z.array(uuid).default([]),
});

async function syncStaffLinks(db: any, userId: string, propertyIds: string[], typeIds: string[], staffType: string) {
  await db.from("staff_property_assignments").delete().eq("user_id", userId);
  if (propertyIds.length)
    await db.from("staff_property_assignments").insert(propertyIds.map((p) => ({ user_id: userId, property_id: p })));
  await db.from("staff_task_type_assignments").delete().eq("user_id", userId);
  if (typeIds.length)
    await db.from("staff_task_type_assignments").insert(typeIds.map((t) => ({ user_id: userId, task_type_id: t })));
  await db.from("user_roles").delete().eq("user_id", userId).in("role", ["team_lead", "staff", "contractor"]);
  await db.from("user_roles").insert({ user_id: userId, role: staffType });
}

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => staffInput.extend({ email: z.string().trim().email().max(255) }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    if (!access.isAdmin) return { error: "forbidden" };
    const email = data.email.toLowerCase();
    if (email === (await db.auth.admin.getUserById(context.userId)).data.user?.email) return { error: "self" };
    let userId: string | null = null;
    const { data: existing } = await db.from("staff_profiles").select("user_id").eq("email", email).maybeSingle();
    userId = existing?.user_id ?? null;
    if (!userId) {
      const { data: up } = await db.from("user_profiles").select("user_id").eq("email", email).maybeSingle();
      userId = up?.user_id ?? null;
    }
    if (!userId) {
      const created = await db.auth.admin.createUser({ email, email_confirm: false });
      userId = created.data?.user?.id ?? null;
      if (!userId) {
        const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 500 });
        userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
      }
    }
    if (!userId) return { error: "create_failed" };
    const { property_ids, task_type_ids, ...profile } = data;
    await db.from("staff_profiles").upsert(
      { ...profile, email, user_id: userId, phone: profile.phone ?? null, invited_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    await syncStaffLinks(db, userId, property_ids, task_type_ids, data.staff_type);

    const link = await db.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: "https://sunnystayshurghada.lovable.app/auth" },
    });
    const actionLink = link.data?.properties?.action_link;
    if (actionLink) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const t = {
          de: ["Ihr Zugang zum Sunny Stays Mitarbeiterbereich", "Willkommen im Team", "bitte legen Sie Ihr Passwort fest.", "Passwort festlegen"],
          en: ["Your Sunny Stays staff access", "Welcome to the team", "please set your password.", "Set password"],
          ar: ["دخولك إلى منطقة موظفي Sunny Stays", "مرحبًا بك في الفريق", "يرجى تعيين كلمة المرور.", "تعيين كلمة المرور"],
        }[data.preferred_language];
        await sendTemplateEmail("internal-notice", email, {
          templateData: { subject: t[0], heading: t[1], intro: `${data.first_name}, ${t[2]}`, rows: [], adminUrl: actionLink, adminLabel: t[3] },
          idempotencyKey: `staff-invite-${email}-${Date.now()}`,
        });
      } catch (e) {
        console.error("[staff] invite mail failed", e);
        return { error: "invite_failed" };
      }
    }
    const { audit } = await import("@/lib/tasks.server");
    await audit(db, null, context.userId, "staff_invited", { email, staff_type: data.staff_type });
    return { ok: true };
  });

export const updateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => staffInput.extend({ user_id: uuid }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    // Nobody can change their own assignments or role.
    if (!access.isAdmin || data.user_id === context.userId) return { error: "forbidden" };
    const { user_id, property_ids, task_type_ids, ...profile } = data;
    await db.from("staff_profiles").update({ ...profile, phone: profile.phone ?? null }).eq("user_id", user_id);
    await syncStaffLinks(db, user_id, property_ids, task_type_ids, data.staff_type);
    const { audit } = await import("@/lib/tasks.server");
    await audit(db, null, context.userId, "staff_updated", { user_id, active: data.active });
    return { ok: true };
  });

export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ name: z.string().trim().min(2).max(80) }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    if (!access.isAdmin) return { error: "forbidden" };
    await db.from("teams").insert({ name: data.name });
    return { ok: true };
  });

/* ----------------------------------------- catalogue & automation (admin) */

export interface TaskSettings {
  types: { id: string; key: string; name: Record<string, string>; active: boolean; requires_photos: boolean; guest_contact_allowed: boolean; default_duration_minutes: number }[];
  checklist: { id: string; task_type_id: string; property_id: string | null; label: Record<string, string>; required: boolean; sort_order: number }[];
  rules: { id: string; task_type_id: string; anchor: string; offset_minutes: number; priority: string; active: boolean; default_assignee: string | null }[];
}

export const getTaskSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ propertyId: uuid }).parse(i))
  .handler(async ({ data, context }): Promise<TaskSettings | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    if (!access.isAdmin) return { error: "forbidden" };
    const [{ data: types }, { data: checklist }, { data: rules }] = await Promise.all([
      db.from("task_types").select("*").order("sort_order"),
      db.from("task_checklist_templates").select("*").eq("active", true).or(`property_id.is.null,property_id.eq.${data.propertyId}`).order("sort_order"),
      db.from("task_automation_rules").select("*").eq("property_id", data.propertyId),
    ]);
    return { types: (types ?? []) as never, checklist: (checklist ?? []) as never, rules: (rules ?? []) as never };
  });

export const createTaskType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ de: z.string().trim().min(2).max(80), en: z.string().trim().max(80), ar: z.string().trim().max(80), duration: z.number().int().min(5).max(1440) }).parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    if (!access.isAdmin) return { error: "forbidden" };
    const key = `custom_${data.de.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30)}_${Date.now().toString(36)}`;
    await db.from("task_types").insert({
      key,
      name: { de: data.de, en: data.en || data.de, ar: data.ar || data.en || data.de },
      default_duration_minutes: data.duration,
      sort_order: 100,
    });
    return { ok: true };
  });

export const saveAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        propertyId: uuid,
        task_type_id: uuid,
        anchor: z.enum(["checkin", "checkout"]),
        offset_minutes: z.number().int().min(-20160).max(20160),
        priority: z.enum(["low", "normal", "high", "urgent"]),
        active: z.boolean(),
        default_assignee: uuid.nullish(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    if (!access.isAdmin) return { error: "forbidden" };
    const { propertyId, ...rest } = data;
    await db
      .from("task_automation_rules")
      .upsert({ property_id: propertyId, ...rest, default_assignee: rest.default_assignee ?? null }, { onConflict: "property_id,task_type_id,anchor" });
    return { ok: true };
  });

/** Property-specific checklist: first edit copies the global list for that apartment. */
export const saveChecklistTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        propertyId: uuid,
        task_type_id: uuid,
        items: z.array(z.object({ label: z.string().trim().min(1).max(200), required: z.boolean() })).max(60),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { db, access } = await ctxAccess(context.userId);
    if (!access.isAdmin) return { error: "forbidden" };
    await db
      .from("task_checklist_templates")
      .update({ active: false })
      .eq("task_type_id", data.task_type_id)
      .eq("property_id", data.propertyId);
    if (data.items.length)
      await db.from("task_checklist_templates").insert(
        data.items.map((it, i) => ({
          task_type_id: data.task_type_id,
          property_id: data.propertyId,
          label: { de: it.label, en: it.label, ar: it.label },
          required: it.required,
          sort_order: i + 1,
        })),
      );
    return { ok: true };
  });
