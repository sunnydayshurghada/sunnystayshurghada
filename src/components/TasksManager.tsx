import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, X } from "lucide-react";
import { TaskDetailPanel } from "@/components/TaskDetailPanel";
import {
  getTaskDashboard,
  createTask,
  updateTask,
  backfillAutomaticTasks,
  type TaskDashboard,
  type AdminTaskRow,
} from "@/lib/tasks.functions";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function TasksManager() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("ar") ? "ar" : i18n.language.startsWith("en") ? "en" : "de";
  const locale = i18n.language === "ar-EG" ? "ar-EG" : i18n.language;
  const qc = useQueryClient();
  const load = useServerFn(getTaskDashboard);
  const create = useServerFn(createTask);
  const update = useServerFn(updateTask);
  const backfill = useServerFn(backfillAutomaticTasks);
  const [from, setFrom] = useState(iso(new Date(Date.now() - 7 * 86400_000)));
  const [to, setTo] = useState(iso(new Date(Date.now() + 30 * 86400_000)));
  const [view, setView] = useState<"list" | "week">("list");
  const [bucket, setBucket] = useState("all");
  const [search, setSearch] = useState("");
  const [prop, setProp] = useState("");
  const [staffF, setStaffF] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const { data: raw } = useQuery({
    queryKey: ["task-dashboard", from, to, lang],
    queryFn: () => load({ data: { from, to, lang } }),
  });
  const d = raw && !("error" in raw) ? (raw as TaskDashboard) : null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["task-dashboard"] });

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Cairo" });
  const dayOf = (x: AdminTaskRow) =>
    x.scheduled_start ? new Date(x.scheduled_start).toLocaleDateString("sv-SE", { timeZone: "Africa/Cairo" }) : "";
  const all = d?.tasks ?? [];
  const buckets: Record<string, (x: AdminTaskRow) => boolean> = {
    all: () => true,
    today: (x) => dayOf(x) === today && x.status !== "cancelled",
    unassigned: (x) => x.status === "unassigned" || x.status === "declined",
    overdue: (x) => x.effective_status === "overdue",
    review: (x) => x.status === "done",
    rework: (x) => x.status === "rework",
    conflicts: (x) => x.conflict,
  };
  const rows = all.filter(
    (x) =>
      buckets[bucket](x) &&
      (!prop || x.property_id === prop) &&
      (!staffF || x.assigned_user_id === staffF) &&
      (!search || `${x.title} ${x.property_name} ${x.assignee_name ?? ""} ${x.booking_ref ?? ""}`.toLowerCase().includes(search.toLowerCase())),
  );

  const money = (v: number, c: string) => new Intl.NumberFormat(locale, { style: "currency", currency: c }).format(v / 100);
  const costs = useMemo(() => {
    const m: Record<string, { est: number; act: number }> = {};
    for (const x of rows) {
      const e = (m[x.currency] ??= { est: 0, act: 0 });
      e.est += x.estimated_cost ?? 0;
      e.act += x.actual_cost ?? 0;
    }
    return m;
  }, [rows]);
  const perStaff = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of rows) if (x.assignee_name && x.status !== "cancelled") m.set(x.assignee_name, (m.get(x.assignee_name) ?? 0) + 1);
    return [...m.entries()];
  }, [rows]);
  const perProp = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of rows) if (x.status !== "cancelled") m.set(x.property_name, (m.get(x.property_name) ?? 0) + 1);
    return [...m.entries()];
  }, [rows]);

  const fmt = (s: string | null) =>
    s ? new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(s)) : "—";

  const assign = async (task: AdminTaskRow, userId: string) => {
    const staff = d?.staff.find((s) => s.user_id === userId);
    if (staff && (!staff.available || !staff.property_ids.includes(task.property_id))) {
      if (!window.confirm(t("tasks.assign_warning"))) return;
    }
    const r = await update({ data: { id: task.id, assigned_user_id: userId || null } });
    if ("error" in r) toast.error(t(`tasks.errors.${r.error}`, t("tasks.errors.generic")));
    else toast.success(t("tasks.saved"));
    refresh();
  };

  const input = "rounded-xl border border-forest/15 bg-card px-3 py-2 text-sm";
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs ${on ? "border-gold bg-gold/20" : "border-forest/15"}`;

  // week planning grid
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(`${from}T12:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + i);
    return iso(dt);
  });

  if (raw && "error" in raw) return null;

  return (
    <section className="space-y-5 rounded-3xl border border-forest/10 bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-gold">{t("tasks.eyebrow")}</p>
          <h2 className="font-display text-2xl text-forest">{t("tasks.admin_title")}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-full bg-gold px-4 py-2 text-xs uppercase tracking-widest text-forest" onClick={() => setShowNew((v) => !v)}>
            {t("tasks.new_task")}
          </button>
          {d?.isAdmin && (
            <button
              className="rounded-full border border-forest/20 px-4 py-2 text-xs uppercase tracking-widest"
              onClick={async () => {
                const r = await backfill();
                if ("error" in r) toast.error(t("tasks.errors.generic"));
                else toast.success(t("tasks.backfilled", { count: r.created }));
                refresh();
              }}
            >
              {t("tasks.backfill")}
            </button>
          )}
        </div>
      </div>

      {showNew && d && (
        <form
          className="grid gap-2 rounded-2xl bg-sand/50 p-4 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const est = String(f.get("estimated_cost") ?? "");
            const r = await create({
              data: {
                property_id: String(f.get("property_id")),
                task_type_id: String(f.get("task_type_id")),
                title: String(f.get("title")),
                description: String(f.get("description") ?? "") || null,
                priority: String(f.get("priority")) as "normal",
                scheduled_start: new Date(String(f.get("start"))).toISOString(),
                duration_minutes: Number(f.get("duration")) || 60,
                assigned_user_id: String(f.get("assignee") ?? "") || null,
                estimated_cost: est ? Math.round(Number(est) * 100) : null,
                currency: String(f.get("currency")) as "EGP",
              },
            });
            if ("error" in r) toast.error(t(`tasks.errors.${r.error}`, t("tasks.errors.generic")));
            else {
              toast.success(t("tasks.saved"));
              setShowNew(false);
              refresh();
            }
          }}
        >
          <select name="property_id" required className={input}>
            {d.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select name="task_type_id" required className={input}>
            {d.types.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input name="title" required minLength={2} placeholder={t("tasks.title")} className={input} />
          <input name="start" type="datetime-local" required className={input} />
          <input name="duration" type="number" defaultValue={60} min={5} className={input} placeholder={t("tasks.duration")} />
          <select name="priority" defaultValue="normal" className={input}>
            {["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{t(`tasks.priority.${p}`)}</option>)}
          </select>
          <select name="assignee" className={input}>
            <option value="">{t("tasks.unassigned")}</option>
            {d.staff.filter((s) => s.active).map((s) => (
              <option key={s.user_id} value={s.user_id}>
                {s.name} ({s.open_tasks}){s.available ? "" : ` – ${t("tasks.unavailable")}`}
              </option>
            ))}
          </select>
          <input name="estimated_cost" type="number" step="0.01" min={0} placeholder={t("tasks.estimated_cost")} className={input} />
          <select name="currency" className={input}>{["EGP", "EUR", "USD"].map((c) => <option key={c}>{c}</option>)}</select>
          <textarea name="description" placeholder={t("tasks.description")} className={`${input} sm:col-span-3`} />
          <button className="rounded-full bg-forest px-4 py-2 text-xs uppercase tracking-widest text-primary-foreground sm:col-span-3">{t("tasks.create")}</button>
        </form>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
        {Object.keys(buckets).map((k) => (
          <button key={k} onClick={() => setBucket(k)} className={`rounded-2xl border p-3 text-start ${bucket === k ? "border-gold bg-gold/10" : "border-forest/10"}`}>
            <p className="text-2xl font-display">{all.filter(buckets[k]).length}</p>
            <p className="text-[11px] text-forest/60">{t(`tasks.kpi.${k}`)}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
        <input placeholder={t("tasks.search")} value={search} onChange={(e) => setSearch(e.target.value)} className={input} />
        <select value={prop} onChange={(e) => setProp(e.target.value)} className={input}>
          <option value="">{t("tasks.all_properties")}</option>
          {d?.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={staffF} onChange={(e) => setStaffF(e.target.value)} className={input}>
          <option value="">{t("tasks.all_staff")}</option>
          {d?.staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
        </select>
        <button className={chip(view === "list")} onClick={() => setView("list")}>{t("tasks.view_list")}</button>
        <button className={chip(view === "week")} onClick={() => setView("week")}>{t("tasks.view_week")}</button>
      </div>

      {view === "list" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-start text-[11px] uppercase tracking-wider text-forest/50">
              <tr>
                <th className="p-2 text-start">{t("tasks.when")}</th>
                <th className="p-2 text-start">{t("tasks.task")}</th>
                <th className="p-2 text-start">{t("tasks.property")}</th>
                <th className="p-2 text-start">{t("tasks.status_label")}</th>
                <th className="p-2 text-start">{t("tasks.assignee")}</th>
                <th className="p-2 text-start">{t("tasks.cost")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className="border-t border-forest/10">
                  <td className="p-2 whitespace-nowrap">{fmt(x.scheduled_start)}</td>
                  <td className="p-2">
                    <button className="text-start hover:text-gold" onClick={() => setOpenId(x.id)}>
                      <span className="block text-[10px] uppercase text-gold">{x.type_name}</span>
                      {x.title}
                    </button>
                  </td>
                  <td className="p-2">{x.property_name}</td>
                  <td className="p-2">
                    <span className={x.effective_status === "overdue" ? "text-destructive" : ""}>{t(`tasks.status.${x.effective_status}`)}</span>
                    {x.conflict && (
                      <span className="ms-1 inline-flex items-center text-destructive" title={t("tasks.conflict")}>
                        <AlertTriangle className="h-3 w-3" />
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <select
                      className="rounded-lg border border-forest/15 bg-card px-2 py-1 text-xs"
                      value={x.assigned_user_id ?? ""}
                      disabled={["approved", "cancelled"].includes(x.status)}
                      onChange={(e) => assign(x, e.target.value)}
                    >
                      <option value="">{t("tasks.unassigned")}</option>
                      {d?.staff.filter((s) => s.active).map((s) => (
                        <option key={s.user_id} value={s.user_id}>
                          {s.name} · {s.open_tasks}
                          {!s.available ? ` · ${t("tasks.unavailable")}` : ""}
                          {!s.property_ids.includes(x.property_id) ? " · ⚠" : ""}
                          {s.task_type_ids.length && !s.task_type_ids.includes(x.task_type_id) ? " · ≠" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 text-xs">
                    {x.estimated_cost != null && money(x.estimated_cost, x.currency)}
                    {x.actual_cost != null && ` / ${money(x.actual_cost, x.currency)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-4 text-center text-sm text-forest/50">{t("tasks.empty")}</p>}
          <p className="mt-2 text-[11px] text-forest/50">{t("tasks.assign_legend")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
          {weekDays.map((day) => (
            <div key={day} className="min-h-32 rounded-2xl bg-sand/50 p-2">
              <p className="mb-1 text-xs font-medium">
                {new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${day}T12:00:00Z`))}
              </p>
              {rows.filter((x) => dayOf(x) === day).map((x) => (
                <button key={x.id} onClick={() => setOpenId(x.id)} className={`mb-1 block w-full rounded-lg bg-card p-1.5 text-start text-[11px] ${x.conflict ? "ring-1 ring-destructive" : ""}`}>
                  <span className="block font-medium">{x.type_name}</span>
                  <span className="text-forest/60">{x.property_name} · {x.assignee_name ?? t("tasks.unassigned")}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <div className="rounded-2xl border border-forest/10 p-3">
          <p className="mb-1 text-xs uppercase text-forest/50">{t("tasks.per_staff")}</p>
          {perStaff.map(([n, c]) => <p key={n}>{n}: {c}</p>)}
        </div>
        <div className="rounded-2xl border border-forest/10 p-3">
          <p className="mb-1 text-xs uppercase text-forest/50">{t("tasks.per_property")}</p>
          {perProp.map(([n, c]) => <p key={n}>{n}: {c}</p>)}
        </div>
        <div className="rounded-2xl border border-forest/10 p-3">
          <p className="mb-1 text-xs uppercase text-forest/50">{t("tasks.costs_planned_actual")}</p>
          {Object.entries(costs).map(([c, v]) => <p key={c}>{money(v.est, c)} / {money(v.act, c)}</p>)}
        </div>
      </div>

      {openId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-forest/30" onClick={() => setOpenId(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto bg-paper p-5" onClick={(e) => e.stopPropagation()}>
            <button className="mb-3 p-1" onClick={() => setOpenId(null)} aria-label={t("tasks.back")}><X className="h-5 w-5" /></button>
            <TaskDetailPanel taskId={openId} onChanged={refresh} />
          </div>
        </div>
      )}
    </section>
  );
}
