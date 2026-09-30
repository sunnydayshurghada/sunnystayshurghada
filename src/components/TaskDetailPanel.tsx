import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Camera, MapPin, Phone, CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getTaskDetail,
  staffTaskAction,
  toggleChecklistItem,
  saveEmployeeNote,
  requestTaskUpload,
  registerTaskAttachment,
  reviewTask,
  addChecklistItem,
  correctTaskTime,
  type TaskDetail,
} from "@/lib/tasks.functions";

const CATS = ["before", "after", "damage", "receipt", "invoice", "other"] as const;

export function TaskDetailPanel({ taskId, onChanged }: { taskId: string; onChanged?: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith("ar") ? "ar" : i18n.language.startsWith("en") ? "en" : "de";
  const locale = i18n.language === "ar-EG" ? "ar-EG" : i18n.language;
  const qc = useQueryClient();
  const load = useServerFn(getTaskDetail);
  const act = useServerFn(staffTaskAction);
  const toggle = useServerFn(toggleChecklistItem);
  const saveNote = useServerFn(saveEmployeeNote);
  const reqUpload = useServerFn(requestTaskUpload);
  const register = useServerFn(registerTaskAttachment);
  const review = useServerFn(reviewTask);
  const addItem = useServerFn(addChecklistItem);
  const correct = useServerFn(correctTaskTime);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cat, setCat] = useState<(typeof CATS)[number]>("after");
  const [visibility, setVisibility] = useState<"admin" | "staff" | "owner">("staff");
  const [note, setNote] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [newItem, setNewItem] = useState("");

  const { data: raw } = useQuery({
    queryKey: ["task-detail", taskId, lang],
    queryFn: () => load({ data: { id: taskId, lang } }),
  });
  if (!raw) return <p className="p-6 text-sm text-forest/60">{t("tasks.loading")}</p>;
  if ("error" in raw) return <p className="p-6 text-sm text-destructive">{t("tasks.errors.forbidden")}</p>;
  const d = raw as TaskDetail;

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["task-detail", taskId] });
    onChanged?.();
  };
  const run = async (fn: () => Promise<{ ok: true } | { error: string }>, okKey = "tasks.saved") => {
    setBusy(true);
    try {
      const r = await fn();
      if ("error" in r) toast.error(t(`tasks.errors.${r.error}`, t("tasks.errors.generic")));
      else toast.success(t(okKey));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const fmt = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const up = await reqUpload({ data: { id: d.id, fileName: file.name, contentType: file.type || "image/jpeg" } });
      if ("error" in up) throw new Error(up.error);
      const { error } = await supabase.storage.from("task-files").uploadToSignedUrl(up.path, up.token, file, {
        contentType: file.type || "image/jpeg",
      });
      if (error) throw error;
      const r = await register({
        data: { id: d.id, path: up.path, fileType: file.type || "image/jpeg", category: cat, visibility, description: null },
      });
      if ("error" in r) throw new Error(r.error);
      toast.success(t("tasks.uploaded"));
      await refresh();
    } catch {
      toast.error(t("tasks.errors.upload_failed"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const big = "min-h-12 rounded-2xl px-4 py-3 text-sm font-medium uppercase tracking-wider disabled:opacity-50";
  const primary = `${big} bg-gold text-forest`;
  const ghost = `${big} border border-forest/20 text-forest`;
  const s = d.status;
  const assignee = d.is_assignee;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-gold">{d.type_name}</p>
        <h2 className="font-display text-xl text-forest">{d.title}</h2>
        <p className="mt-1 text-sm text-forest/70">
          {d.property_name} · {fmt(d.scheduled_start)}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-forest/10 px-3 py-1">{t(`tasks.status.${d.effective_status}`)}</span>
          <span className="rounded-full bg-gold/20 px-3 py-1">{t(`tasks.priority.${d.priority}`)}</span>
          {d.booking_ref && <span className="rounded-full bg-sand px-3 py-1">{d.booking_ref}</span>}
        </div>
      </div>

      {/* quick status actions for the assignee */}
      {assignee && (
        <div className="grid grid-cols-2 gap-2">
          {s === "assigned" && (
            <>
              <button disabled={busy} className={primary} onClick={() => run(() => act({ data: { id: d.id, action: "accept" } }))}>
                {t("tasks.actions.accept")}
              </button>
              <button
                disabled={busy}
                className={ghost}
                onClick={() => run(() => act({ data: { id: d.id, action: "decline", comment } }))}
              >
                {t("tasks.actions.decline")}
              </button>
            </>
          )}
          {["accepted", "rework", "overdue"].includes(s) && (
            <button disabled={busy} className={ghost} onClick={() => run(() => act({ data: { id: d.id, action: "on_the_way" } }))}>
              {t("tasks.actions.on_the_way")}
            </button>
          )}
          {["accepted", "on_the_way", "rework", "overdue"].includes(s) && (
            <button disabled={busy} className={primary} onClick={() => run(() => act({ data: { id: d.id, action: "start" } }))}>
              {t("tasks.actions.start")}
            </button>
          )}
          {s === "started" && (
            <button disabled={busy} className={ghost} onClick={() => run(() => act({ data: { id: d.id, action: "pause" } }))}>
              {t("tasks.actions.pause")}
            </button>
          )}
          {s === "paused" && (
            <button disabled={busy} className={ghost} onClick={() => run(() => act({ data: { id: d.id, action: "resume" } }))}>
              {t("tasks.actions.resume")}
            </button>
          )}
          {["started", "paused"].includes(s) && (
            <button disabled={busy} className={primary} onClick={() => run(() => act({ data: { id: d.id, action: "finish", comment } }))}>
              {t("tasks.actions.finish")}
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-forest/60">
        {t("tasks.worked", { minutes: d.worked_minutes })}
      </p>

      {d.address && (
        <a
          className={`${ghost} flex items-center justify-center gap-2`}
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.address)}`}
          target="_blank"
          rel="noreferrer"
        >
          <MapPin className="h-4 w-4" /> {t("tasks.navigate")}
        </a>
      )}

      <div className="rounded-2xl bg-sand/60 p-4 text-sm space-y-1">
        {d.address && <p>{d.address}</p>}
        {d.stay && (
          <p>
            {t("tasks.stay")}: {d.stay.checkin} → {d.stay.checkout}
          </p>
        )}
        {d.guest && (
          <p>
            {t("tasks.guest")}: {d.guest.name} · {t("tasks.guests", { count: d.guest.guests })}
            {d.guest.phone && (
              <a className="ms-2 inline-flex items-center gap-1 text-gold" href={`tel:${d.guest.phone}`}>
                <Phone className="h-3 w-3" /> {d.guest.phone}
              </a>
            )}
          </p>
        )}
        {d.contact && (
          <p>
            {t("tasks.contact")}: {d.contact}
          </p>
        )}
        {d.materials && (
          <p>
            {t("tasks.materials")}: {d.materials}
          </p>
        )}
        {d.description && <p className="whitespace-pre-line">{d.description}</p>}
        {d.internal_notes && (
          <p className="text-forest/70">
            {t("tasks.internal_notes")}: {d.internal_notes}
          </p>
        )}
      </div>

      {/* checklist */}
      {d.checklist.length > 0 && (
        <div>
          <h3 className="mb-2 font-display text-lg text-forest">
            {t("tasks.checklist")} ({d.checklist.filter((c) => c.done).length}/{d.checklist.length})
          </h3>
          <ul className="space-y-2">
            {d.checklist.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={busy || !(assignee || d.can_manage)}
                  onClick={() => run(() => toggle({ data: { itemId: c.id, done: !c.done } }), "tasks.saved")}
                  className="flex w-full items-center gap-3 rounded-2xl border border-forest/10 bg-card px-4 py-3 text-start text-base"
                >
                  {c.done ? <CheckCircle2 className="h-6 w-6 shrink-0 text-gold" /> : <Circle className="h-6 w-6 shrink-0 text-forest/30" />}
                  <span className={c.done ? "text-forest/50 line-through" : "text-forest"}>{c.label}</span>
                  {c.required && <span className="ms-auto text-xs text-destructive">*</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-forest/50">* {t("tasks.required")}</p>
        </div>
      )}
      {d.can_manage && (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-forest/15 bg-card px-3 py-2 text-sm"
            placeholder={t("tasks.add_item")}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <button
            className="rounded-xl bg-forest px-3 text-xs text-primary-foreground"
            onClick={() => {
              if (!newItem.trim()) return;
              void run(() => addItem({ data: { id: d.id, label: newItem, required: false } }));
              setNewItem("");
            }}
          >
            +
          </button>
        </div>
      )}

      {/* photos & documents */}
      {(assignee || d.can_manage) && (
        <div className="space-y-2">
          <h3 className="font-display text-lg text-forest">{t("tasks.photos")}</h3>
          {d.requires_photos && <p className="text-xs text-destructive">{t("tasks.photos_required")}</p>}
          <div className="grid grid-cols-2 gap-2">
            <select className="rounded-xl border border-forest/15 bg-card px-3 py-3 text-sm" value={cat} onChange={(e) => setCat(e.target.value as never)}>
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {t(`tasks.cat.${c}`)}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-forest/15 bg-card px-3 py-3 text-sm"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as never)}
            >
              <option value="staff">{t("tasks.vis.staff")}</option>
              <option value="admin">{t("tasks.vis.admin")}</option>
              {d.can_manage && <option value="owner">{t("tasks.vis.owner")}</option>}
            </select>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          <button disabled={busy} className={`${primary} flex w-full items-center justify-center gap-2`} onClick={() => fileRef.current?.click()}>
            <Camera className="h-5 w-5" /> {t("tasks.take_photo")}
          </button>
        </div>
      )}
      {d.attachments.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {d.attachments.map((a) =>
            a.url && a.file_type?.startsWith("image/") ? (
              <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block">
                <img src={a.url} alt={t(`tasks.cat.${a.category}`)} className="aspect-square w-full rounded-xl object-cover" />
                <span className="text-[10px] text-forest/60">{t(`tasks.cat.${a.category}`)}</span>
              </a>
            ) : (
              <a key={a.id} href={a.url ?? "#"} target="_blank" rel="noreferrer" className="rounded-xl border p-2 text-xs">
                {t(`tasks.cat.${a.category}`)}
              </a>
            ),
          )}
        </div>
      )}

      {/* notes */}
      {(assignee || d.can_manage) && (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-2xl border border-forest/15 bg-card p-3 text-sm"
            rows={3}
            placeholder={t("tasks.employee_notes")}
            value={note ?? d.employee_notes ?? ""}
            onChange={(e) => setNote(e.target.value)}
          />
          <button disabled={busy || note === null} className={ghost} onClick={() => run(() => saveNote({ data: { id: d.id, note: note ?? "" } }))}>
            {t("tasks.save_note")}
          </button>
        </div>
      )}

      {/* management review */}
      {d.can_manage && (
        <div className="space-y-2 rounded-2xl border border-gold/40 p-4">
          <h3 className="font-display text-lg text-forest">{t("tasks.review")}</h3>
          <input
            className="w-full rounded-xl border border-forest/15 bg-card px-3 py-2 text-sm"
            placeholder={t("tasks.comment")}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="grid grid-cols-3 gap-2">
            <button disabled={busy || s !== "done"} className={primary} onClick={() => run(() => review({ data: { id: d.id, action: "approve", comment } }))}>
              {t("tasks.actions.approve")}
            </button>
            <button
              disabled={busy || !["done", "approved"].includes(s)}
              className={ghost}
              onClick={() => run(() => review({ data: { id: d.id, action: "rework", comment } }))}
            >
              {t("tasks.actions.rework")}
            </button>
            <button
              disabled={busy || s === "cancelled"}
              className={ghost}
              onClick={() => run(() => review({ data: { id: d.id, action: "cancel", comment } }))}
            >
              {t("tasks.actions.cancel")}
            </button>
          </div>
          <button
            className="text-xs text-forest/60 underline"
            onClick={() => {
              const m = window.prompt(t("tasks.correct_minutes"), String(d.worked_minutes));
              if (m === null) return;
              const reason = window.prompt(t("tasks.correct_reason")) ?? "";
              void run(() => correct({ data: { id: d.id, minutes: Number(m) || 0, reason } }));
            }}
          >
            {t("tasks.correct_time")}
          </button>
        </div>
      )}

      {d.history.length > 0 && (
        <details className="text-xs text-forest/60">
          <summary className="cursor-pointer">{t("tasks.history")}</summary>
          <ul className="mt-2 space-y-1">
            {d.history.map((h, i) => (
              <li key={i}>
                {fmt(h.created_at)}: {h.old_status ? t(`tasks.status.${h.old_status}`) + " → " : ""}
                {t(`tasks.status.${h.new_status}`)}
                {h.comment ? ` – ${h.comment}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
