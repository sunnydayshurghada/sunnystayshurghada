import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  getTaskSettings,
  saveAutomationRule,
  saveChecklistTemplate,
  createTaskType,
  type TaskSettings,
} from "@/lib/tasks.functions";

export function TaskSettingsManager({ propertyId }: { propertyId: string | null }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("ar") ? "ar" : i18n.language.startsWith("en") ? "en" : "de";
  const qc = useQueryClient();
  const load = useServerFn(getTaskSettings);
  const saveRule = useServerFn(saveAutomationRule);
  const saveList = useServerFn(saveChecklistTemplate);
  const addType = useServerFn(createTaskType);
  const [typeId, setTypeId] = useState("");
  const [items, setItems] = useState<{ label: string; required: boolean }[] | null>(null);
  const [nt, setNt] = useState({ de: "", en: "", ar: "", duration: 60 });
  const { data: raw } = useQuery({
    queryKey: ["task-settings", propertyId],
    queryFn: () => load({ data: { propertyId: propertyId! } }),
    enabled: Boolean(propertyId),
  });
  const d = raw && !("error" in raw) ? (raw as TaskSettings) : null;
  if (!propertyId || !d) return null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["task-settings"] });
  const nm = (n: Record<string, string>) => n[lang] ?? n.de;
  const input = "rounded-xl border border-forest/15 bg-card px-3 py-2 text-sm";

  const rule = (tid: string, anchor: string) => d.rules.find((r) => r.task_type_id === tid && r.anchor === anchor);
  const upsert = async (tid: string, anchor: "checkin" | "checkout", patch: Partial<{ offset_minutes: number; active: boolean; priority: string }>) => {
    const r = rule(tid, anchor);
    await saveRule({
      data: {
        propertyId,
        task_type_id: tid,
        anchor,
        offset_minutes: patch.offset_minutes ?? r?.offset_minutes ?? 0,
        priority: (patch.priority ?? r?.priority ?? "normal") as "normal",
        active: patch.active ?? r?.active ?? true,
        default_assignee: r?.default_assignee ?? null,
      },
    });
    toast.success(t("tasks.saved"));
    refresh();
  };

  const currentList = (tid: string) => {
    const own = d.checklist.filter((c) => c.task_type_id === tid && c.property_id === propertyId);
    const use = own.length ? own : d.checklist.filter((c) => c.task_type_id === tid && !c.property_id);
    return use.map((c) => ({ label: nm(c.label), required: c.required }));
  };

  return (
    <section className="space-y-5 rounded-3xl border border-forest/10 bg-card p-5 sm:p-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.35em] text-gold">{t("tasks.eyebrow")}</p>
        <h2 className="font-display text-2xl text-forest">{t("tasks.settings_title")}</h2>
        <p className="text-sm text-forest/60">{t("tasks.settings_hint")}</p>
      </div>

      <div>
        <h3 className="mb-2 font-display text-lg">{t("tasks.automation")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <tbody>
              {d.types.filter((x) => x.active).map((ty) =>
                (["checkin", "checkout"] as const).map((anchor) => {
                  const r = rule(ty.id, anchor);
                  return (
                    <tr key={ty.id + anchor} className="border-t border-forest/10">
                      <td className="p-2">{nm(ty.name)}</td>
                      <td className="p-2 text-xs text-forest/60">{t(`tasks.anchor.${anchor}`)}</td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={Boolean(r?.active)}
                          onChange={(e) => upsert(ty.id, anchor, { active: e.target.checked })}
                          aria-label={t("tasks.active")}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className={`${input} w-24`}
                          defaultValue={r ? r.offset_minutes / 60 : 0}
                          step={0.5}
                          onBlur={(e) => r && upsert(ty.id, anchor, { offset_minutes: Math.round(Number(e.target.value) * 60) })}
                        />
                        <span className="ms-1 text-xs text-forest/50">{t("tasks.hours_offset")}</span>
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-display text-lg">{t("tasks.checklist_templates")}</h3>
        <select
          className={input}
          value={typeId}
          onChange={(e) => {
            setTypeId(e.target.value);
            setItems(e.target.value ? currentList(e.target.value) : null);
          }}
        >
          <option value="">{t("tasks.choose_type")}</option>
          {d.types.map((x) => <option key={x.id} value={x.id}>{nm(x.name)}</option>)}
        </select>
        {items && (
          <div className="space-y-1">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={`${input} flex-1`} value={it.label} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <label className="text-xs"><input type="checkbox" checked={it.required} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} /> {t("tasks.required_short")}</label>
                <button className="text-xs text-destructive" onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <div className="flex gap-2">
              <button className="text-xs underline" onClick={() => setItems([...items, { label: "", required: false }])}>+ {t("tasks.add_item")}</button>
              <button
                className="rounded-full bg-forest px-4 py-1.5 text-xs text-primary-foreground"
                onClick={async () => {
                  await saveList({ data: { propertyId, task_type_id: typeId, items: items.filter((x) => x.label.trim()) } });
                  toast.success(t("tasks.saved"));
                  refresh();
                }}
              >
                {t("tasks.save_for_property")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-display text-lg">{t("tasks.new_type")}</h3>
        <div className="grid gap-2 sm:grid-cols-4">
          <input className={input} placeholder="Deutsch" value={nt.de} onChange={(e) => setNt({ ...nt, de: e.target.value })} />
          <input className={input} placeholder="English" value={nt.en} onChange={(e) => setNt({ ...nt, en: e.target.value })} />
          <input className={input} placeholder="العربية" dir="rtl" value={nt.ar} onChange={(e) => setNt({ ...nt, ar: e.target.value })} />
          <button
            className="rounded-full bg-gold px-4 py-2 text-xs uppercase"
            onClick={async () => {
              if (nt.de.trim().length < 2) return;
              await addType({ data: nt });
              setNt({ de: "", en: "", ar: "", duration: 60 });
              toast.success(t("tasks.saved"));
              refresh();
            }}
          >
            {t("tasks.create")}
          </button>
        </div>
      </div>
    </section>
  );
}
