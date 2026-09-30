import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ArrowLeft, LogOut, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TaskDetailPanel } from "@/components/TaskDetailPanel";
import { getStaffSession, listMyTasks, type StaffTaskCard } from "@/lib/tasks.functions";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Mitarbeiterbereich – Sunny Stays Hurghada" },
      { name: "description", content: "Aufgaben und Einsätze für das Sunny Stays Team." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: StaffPortal,
});

type Filter = "all" | "today" | "tomorrow" | "week";

function StaffPortal() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language.startsWith("ar");
  const lang = rtl ? "ar" : i18n.language.startsWith("en") ? "en" : "de";
  const locale = i18n.language === "ar-EG" ? "ar-EG" : i18n.language;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const session = useServerFn(getStaffSession);
  const list = useServerFn(listMyTasks);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [property, setProperty] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [prio, setPrio] = useState("");

  const { data: sess } = useQuery({ queryKey: ["staff-session"], queryFn: () => session() });
  const { data: raw, isLoading } = useQuery({
    queryKey: ["my-tasks", lang],
    queryFn: () => list({ data: { lang } }),
    enabled: Boolean(sess?.isStaff || sess?.isAdmin),
    refetchInterval: 60_000,
  });
  const tasks: StaffTaskCard[] = raw && "tasks" in raw ? raw.tasks : [];

  const signOut = async () => {
    qc.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  const groups = useMemo(() => {
    const now = new Date();
    const dayStr = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Africa/Cairo" });
    const today = dayStr(now);
    const tomorrow = dayStr(new Date(now.getTime() + 86400_000));
    const weekEnd = dayStr(new Date(now.getTime() + 7 * 86400_000));
    const f = tasks.filter((x) => {
      const d = x.scheduled_start ? dayStr(new Date(x.scheduled_start)) : "";
      if (filter === "today" && d !== today) return false;
      if (filter === "tomorrow" && d !== tomorrow) return false;
      if (filter === "week" && (d < today || d > weekEnd)) return false;
      if (property && x.property_id !== property) return false;
      if (status && x.effective_status !== status) return false;
      if (type && x.task_type_id !== type) return false;
      if (prio && x.priority !== prio) return false;
      return true;
    });
    const done = ["done", "approved", "cancelled"];
    const open = f.filter((x) => !done.includes(x.status));
    return {
      next: open.find((x) => x.effective_status !== "overdue" && x.status !== "declined") ?? null,
      fresh: open.filter((x) => x.status === "assigned"),
      overdue: open.filter((x) => x.effective_status === "overdue"),
      high: open.filter((x) => ["high", "urgent"].includes(x.priority) && x.effective_status !== "overdue"),
      today: open.filter((x) => x.scheduled_start && dayStr(new Date(x.scheduled_start)) === today),
      upcoming: open.filter((x) => x.scheduled_start && dayStr(new Date(x.scheduled_start)) > today),
      recent: f.filter((x) => ["done", "approved"].includes(x.status)).slice(-10).reverse(),
    };
  }, [tasks, filter, property, status, type, prio]);

  const uniq = <K extends keyof StaffTaskCard>(k: K, label: K) =>
    [...new Map(tasks.map((x) => [x[k], x[label]])).entries()] as [string, string][];

  const fmt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";

  const Card = ({ x }: { x: StaffTaskCard }) => (
    <button
      type="button"
      onClick={() => setOpenId(x.id)}
      className="w-full rounded-3xl border border-forest/10 bg-card p-4 text-start shadow-sm active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-gold">{x.type_name}</p>
          <p className="font-display text-lg leading-tight text-forest">{x.property_name}</p>
          <p className="text-sm text-forest/70">{fmt(x.scheduled_start)}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] ${
            x.effective_status === "overdue" ? "bg-destructive/15 text-destructive" : "bg-forest/10 text-forest"
          }`}
        >
          {t(`tasks.status.${x.effective_status}`)}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-forest/60">
        {["high", "urgent"].includes(x.priority) && <span className="text-destructive">{t(`tasks.priority.${x.priority}`)}</span>}
        {x.checklist_total > 0 && (
          <span>
            ✓ {x.checklist_done}/{x.checklist_total}
          </span>
        )}
        {x.booking_ref && <span>{x.booking_ref}</span>}
      </div>
    </button>
  );

  const Section = ({ title, items }: { title: string; items: StaffTaskCard[] }) =>
    items.length ? (
      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-[0.3em] text-forest/60">
          {title} ({items.length})
        </h2>
        {items.map((x) => (
          <Card key={x.id} x={x} />
        ))}
      </section>
    ) : null;

  const sel = "rounded-xl border border-forest/15 bg-card px-3 py-2 text-sm";

  if (sess && !sess.isStaff && !sess.isAdmin) {
    return (
      <main dir={rtl ? "rtl" : "ltr"} className="flex min-h-screen items-center justify-center bg-sand p-6">
        <div className="max-w-sm rounded-3xl bg-card p-8 text-center">
          <p className="mb-4 text-forest">{t("tasks.no_access")}</p>
          <button onClick={signOut} className="text-xs uppercase tracking-widest text-forest/60">
            {t("admin.sign_out")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main dir={rtl ? "rtl" : "ltr"} className="min-h-screen bg-sand pb-16 text-forest">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-forest/10 bg-paper/95 px-4 py-3 backdrop-blur">
        {openId ? (
          <button onClick={() => setOpenId(null)} className="flex min-h-11 items-center gap-2 text-sm">
            <ArrowLeft className={`h-5 w-5 ${rtl ? "rotate-180" : ""}`} /> {t("tasks.back")}
          </button>
        ) : (
          <p className="font-display text-lg">{t("tasks.my_tasks")}</p>
        )}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button onClick={signOut} aria-label={t("admin.sign_out")} className="p-2">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-xl space-y-6 px-4 py-5">
        {openId ? (
          <TaskDetailPanel taskId={openId} onChanged={() => qc.invalidateQueries({ queryKey: ["my-tasks"] })} />
        ) : isLoading ? (
          <p className="text-sm text-forest/60">{t("tasks.loading")}</p>
        ) : (
          <>
            {groups.next && (
              <section className="space-y-2">
                <h2 className="text-xs uppercase tracking-[0.3em] text-gold">{t("tasks.next")}</h2>
                <Card x={groups.next} />
              </section>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(["all", "today", "tomorrow", "week"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`min-h-10 shrink-0 rounded-full border px-4 text-sm ${filter === f ? "border-gold bg-gold/20" : "border-forest/15"}`}
                >
                  {t(`tasks.filter.${f}`)}
                </button>
              ))}
            </div>
            <details>
              <summary className="cursor-pointer text-sm text-forest/70">{t("tasks.more_filters")}</summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select className={sel} value={property} onChange={(e) => setProperty(e.target.value)}>
                  <option value="">{t("tasks.all_properties")}</option>
                  {uniq("property_id", "property_name").map(([id, n]) => (
                    <option key={id} value={id}>{n}</option>
                  ))}
                </select>
                <select className={sel} value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">{t("tasks.all_types")}</option>
                  {uniq("task_type_id", "type_name").map(([id, n]) => (
                    <option key={id} value={id}>{n}</option>
                  ))}
                </select>
                <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">{t("tasks.all_status")}</option>
                  {["assigned", "accepted", "on_the_way", "started", "paused", "done", "approved", "rework", "overdue"].map((s) => (
                    <option key={s} value={s}>{t(`tasks.status.${s}`)}</option>
                  ))}
                </select>
                <select className={sel} value={prio} onChange={(e) => setPrio(e.target.value)}>
                  <option value="">{t("tasks.all_priorities")}</option>
                  {["low", "normal", "high", "urgent"].map((p) => (
                    <option key={p} value={p}>{t(`tasks.priority.${p}`)}</option>
                  ))}
                </select>
              </div>
            </details>
            {groups.overdue.length > 0 && (
              <p className="flex items-center gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" /> {t("tasks.overdue_hint", { count: groups.overdue.length })}
              </p>
            )}
            <Section title={t("tasks.sec.new")} items={groups.fresh} />
            <Section title={t("tasks.sec.overdue")} items={groups.overdue} />
            <Section title={t("tasks.sec.high")} items={groups.high} />
            <Section title={t("tasks.sec.today")} items={groups.today} />
            <Section title={t("tasks.sec.upcoming")} items={groups.upcoming} />
            <Section title={t("tasks.sec.recent")} items={groups.recent} />
            {tasks.length === 0 && <p className="text-center text-sm text-forest/60">{t("tasks.empty")}</p>}
          </>
        )}
      </div>
    </main>
  );
}
