import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  getTaskDashboard,
  inviteStaff,
  updateStaff,
  createTeam,
  type TaskDashboard,
  type StaffOption,
} from "@/lib/tasks.functions";

type Form = Omit<StaffOption, "name" | "open_tasks"> & { email: string };

const empty = (): Form => ({
  user_id: "",
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  staff_type: "staff",
  team_id: null,
  active: true,
  available: true,
  preferred_language: "de",
  can_view_team_tasks: false,
  can_view_guest_contact: false,
  default_hourly_rate: null,
  default_fixed_rate: null,
  currency: "EGP",
  notes: "",
  property_ids: [],
  task_type_ids: [],
} as unknown as Form);

export function StaffManager() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("ar") ? "ar" : i18n.language.startsWith("en") ? "en" : "de";
  const qc = useQueryClient();
  const load = useServerFn(getTaskDashboard);
  const invite = useServerFn(inviteStaff);
  const save = useServerFn(updateStaff);
  const team = useServerFn(createTeam);
  const today = new Date().toISOString().slice(0, 10);
  const { data: raw } = useQuery({
    queryKey: ["task-dashboard", today, today, lang, "staff"],
    queryFn: () => load({ data: { from: today, to: today, lang } }),
  });
  const d = raw && !("error" in raw) ? (raw as TaskDashboard) : null;
  const [form, setForm] = useState<(Form & { first_name: string; last_name: string }) | null>(null);
  const [teamName, setTeamName] = useState("");
  if (!d?.isAdmin) return null;

  const input = "w-full rounded-xl border border-forest/15 bg-card px-3 py-2 text-sm";
  const f = form as any;
  const set = (k: string, v: unknown) => setForm({ ...(form as any), [k]: v });
  const toggleIn = (k: "property_ids" | "task_type_ids", id: string) =>
    set(k, f[k].includes(id) ? f[k].filter((x: string) => x !== id) : [...f[k], id]);

  const submit = async () => {
    const payload = {
      first_name: f.first_name ?? "",
      last_name: f.last_name ?? "",
      phone: f.phone || null,
      preferred_language: f.preferred_language,
      staff_type: f.staff_type,
      team_id: f.team_id || null,
      active: f.active,
      available: f.available,
      can_view_team_tasks: f.can_view_team_tasks,
      can_view_guest_contact: f.can_view_guest_contact,
      default_hourly_rate: f.default_hourly_rate ?? null,
      default_fixed_rate: f.default_fixed_rate ?? null,
      currency: f.currency,
      notes: f.notes || null,
      property_ids: f.property_ids,
      task_type_ids: f.task_type_ids,
    };
    const r = f.user_id
      ? await save({ data: { ...payload, user_id: f.user_id } })
      : await invite({ data: { ...payload, email: f.email } });
    if ("error" in r) toast.error(t(`tasks.errors.${r.error}`, t("tasks.errors.generic")));
    else {
      toast.success(f.user_id ? t("tasks.saved") : t("tasks.invited"));
      setForm(null);
      qc.invalidateQueries({ queryKey: ["task-dashboard"] });
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-forest/10 bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-gold">{t("tasks.eyebrow")}</p>
          <h2 className="font-display text-2xl text-forest">{t("tasks.staff_title")}</h2>
        </div>
        <button className="rounded-full bg-gold px-4 py-2 text-xs uppercase tracking-widest" onClick={() => setForm(empty() as never)}>
          {t("tasks.invite_staff")}
        </button>
      </div>

      <ul className="divide-y divide-forest/10 text-sm">
        {d.staff.map((s) => (
          <li key={s.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <p className="font-medium">{s.name} <span className="text-xs text-forest/50">· {t(`tasks.type.${s.staff_type}`)}</span></p>
              <p className="text-xs text-forest/60">
                {s.email} · {s.property_ids.length} {t("tasks.properties")} · {s.open_tasks} {t("tasks.open")}
                {!s.active && ` · ${t("tasks.inactive")}`}
                {!s.available && ` · ${t("tasks.unavailable")}`}
              </p>
            </div>
            <button
              className="text-xs uppercase tracking-widest text-gold"
              onClick={() => {
                const [first_name, ...rest] = s.name.split(" ");
                setForm({ ...s, first_name, last_name: rest.join(" ") } as never);
              }}
            >
              {t("tasks.edit")}
            </button>
          </li>
        ))}
        {d.staff.length === 0 && <li className="py-3 text-forest/50">{t("tasks.no_staff")}</li>}
      </ul>

      <div className="flex gap-2">
        <input className={input} placeholder={t("tasks.team_name")} value={teamName} onChange={(e) => setTeamName(e.target.value)} />
        <button
          className="rounded-xl bg-forest px-4 text-xs text-primary-foreground"
          onClick={async () => {
            if (teamName.trim().length < 2) return;
            await team({ data: { name: teamName } });
            setTeamName("");
            qc.invalidateQueries({ queryKey: ["task-dashboard"] });
          }}
        >
          {t("tasks.add_team")}
        </button>
      </div>
      {d.teams.length > 0 && <p className="text-xs text-forest/60">{t("tasks.teams")}: {d.teams.map((x) => x.name).join(", ")}</p>}

      {form && (
        <div className="grid gap-2 rounded-2xl bg-sand/50 p-4 sm:grid-cols-2">
          {!f.user_id && <input className={input} type="email" placeholder="E-Mail" value={f.email} onChange={(e) => set("email", e.target.value)} />}
          <input className={input} placeholder={t("tasks.first_name")} value={f.first_name} onChange={(e) => set("first_name", e.target.value)} />
          <input className={input} placeholder={t("tasks.last_name")} value={f.last_name} onChange={(e) => set("last_name", e.target.value)} />
          <input className={input} placeholder={t("tasks.phone")} value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          <select className={input} value={f.staff_type} onChange={(e) => set("staff_type", e.target.value)}>
            {["team_lead", "staff", "contractor"].map((x) => <option key={x} value={x}>{t(`tasks.type.${x}`)}</option>)}
          </select>
          <select className={input} value={f.team_id ?? ""} onChange={(e) => set("team_id", e.target.value || null)}>
            <option value="">{t("tasks.no_team")}</option>
            {d.teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <select className={input} value={f.preferred_language} onChange={(e) => set("preferred_language", e.target.value)}>
            <option value="de">Deutsch</option><option value="en">English</option><option value="ar">العربية</option>
          </select>
          <div className="flex gap-2">
            <input className={input} type="number" placeholder={t("tasks.hourly_rate")} value={f.default_hourly_rate != null ? f.default_hourly_rate / 100 : ""} onChange={(e) => set("default_hourly_rate", e.target.value ? Math.round(Number(e.target.value) * 100) : null)} />
            <select className={input} value={f.currency} onChange={(e) => set("currency", e.target.value)}>{["EGP", "EUR", "USD"].map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div className="space-y-1 text-sm sm:col-span-2">
            {(["active", "available", "can_view_team_tasks", "can_view_guest_contact"] as const).map((k) => (
              <label key={k} className="me-4 inline-flex items-center gap-2">
                <input type="checkbox" checked={f[k]} onChange={(e) => set(k, e.target.checked)} /> {t(`tasks.perm.${k}`)}
              </label>
            ))}
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase text-forest/50">{t("tasks.properties")}</p>
            {d.properties.map((p) => (
              <label key={p.id} className="me-4 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.property_ids.includes(p.id)} onChange={() => toggleIn("property_ids", p.id)} /> {p.name}
              </label>
            ))}
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase text-forest/50">{t("tasks.task_types")}</p>
            <div className="flex flex-wrap gap-x-4">
              {d.types.map((p) => (
                <label key={p.id} className="inline-flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={f.task_type_ids.includes(p.id)} onChange={() => toggleIn("task_type_ids", p.id)} /> {p.name}
                </label>
              ))}
            </div>
          </div>
          <textarea className={`${input} sm:col-span-2`} placeholder={t("tasks.notes")} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          <div className="flex gap-2 sm:col-span-2">
            <button className="rounded-full bg-forest px-4 py-2 text-xs uppercase text-primary-foreground" onClick={submit}>
              {f.user_id ? t("tasks.save") : t("tasks.send_invite")}
            </button>
            <button className="text-xs" onClick={() => setForm(null)}>{t("tasks.close")}</button>
          </div>
        </div>
      )}
    </section>
  );
}
