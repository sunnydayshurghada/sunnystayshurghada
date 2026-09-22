import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getNotificationSettings,
  saveRecipient,
  deleteRecipient,
  getEmailTemplate,
  saveEmailTemplate,
  resetEmailTemplate,
  sendTestEmail,
  retryFailedEmails,
  type RecipientRow,
} from "@/lib/notifications.functions";
import { TEMPLATE_KEYS, TEMPLATE_LANGUAGES, TEMPLATE_VARIABLES } from "@/lib/email-defaults";

const FLAGS = [
  "receive_new_inquiries",
  "receive_confirmed_bookings",
  "receive_payments",
  "receive_cancellations",
  "receive_booking_changes",
  "receive_calendar_errors",
] as const;

const emptyRecipient = (propertyId: string) => ({
  id: null as string | null,
  property_id: propertyId,
  recipient_name: "",
  recipient_email: "",
  recipient_role: "owner",
  receive_new_inquiries: true,
  receive_confirmed_bookings: true,
  receive_payments: false,
  receive_cancellations: true,
  receive_booking_changes: true,
  receive_calendar_errors: false,
  active: true,
});

export function NotificationsManager({ propertyId }: { propertyId: string | null }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const load = useServerFn(getNotificationSettings);
  const save = useServerFn(saveRecipient);
  const remove = useServerFn(deleteRecipient);
  const loadTemplate = useServerFn(getEmailTemplate);
  const storeTemplate = useServerFn(saveEmailTemplate);
  const resetTemplate = useServerFn(resetEmailTemplate);
  const testMail = useServerFn(sendTestEmail);
  const retry = useServerFn(retryFailedEmails);

  const [form, setForm] = useState(() => emptyRecipient(propertyId ?? ""));
  const [templateKey, setTemplateKey] = useState<string>(TEMPLATE_KEYS[0]);
  const [language, setLanguage] = useState<string>("de");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(emptyRecipient(propertyId ?? ""));
  }, [propertyId]);

  const { data } = useQuery({
    queryKey: ["admin-notifications", propertyId ?? "none"],
    queryFn: () => load({ data: { propertyId: propertyId! } }),
    enabled: Boolean(propertyId),
  });
  const settings = data && !("error" in data) ? data : null;

  const { data: templateData } = useQuery({
    queryKey: ["admin-email-template", propertyId ?? "none", templateKey, language],
    queryFn: () =>
      loadTemplate({
        data: { propertyId: propertyId!, key: templateKey as never, language: language as never },
      }),
    enabled: Boolean(propertyId),
  });
  const template = templateData && !("error" in templateData) ? templateData : null;

  useEffect(() => {
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  }, [template]);

  if (!propertyId) {
    return (
      <section className="rounded-3xl border border-forest/10 bg-card p-6">
        <h2 className="font-display text-xl text-forest">{t("notifications.title")}</h2>
        <p className="mt-2 text-sm text-forest/60">{t("notifications.pick_property")}</p>
      </section>
    );
  }

  const run = async (fn: () => Promise<{ ok?: true; error?: string } | any>, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res && "error" in res && res.error) {
        toast.error(t(`notifications.errors.${res.error}`, t("notifications.errors.generic")));
      } else {
        toast.success(okMsg);
        void qc.invalidateQueries({ queryKey: ["admin-notifications"] });
        void qc.invalidateQueries({ queryKey: ["admin-email-template"] });
      }
    } catch {
      toast.error(t("notifications.errors.generic"));
    }
    setBusy(false);
  };

  const inputCls =
    "w-full rounded-xl border border-forest/15 bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none";
  const btn =
    "rounded-full bg-forest px-4 py-2 text-xs uppercase tracking-widest text-sand transition-colors hover:bg-gold hover:text-forest disabled:opacity-50";
  const ghost =
    "rounded-full border border-forest/20 px-4 py-2 text-xs uppercase tracking-widest text-forest transition-colors hover:border-gold hover:text-gold disabled:opacity-50";

  return (
    <section className="space-y-6 rounded-3xl border border-forest/10 bg-card p-5 sm:p-6">
      <div>
        <h2 className="font-display text-xl text-forest">{t("notifications.title")}</h2>
        <p className="mt-1 text-sm text-forest/60">{t("notifications.intro")}</p>
      </div>

      {/* Central booking desk */}
      <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold">
          {t("notifications.central_label")}
        </p>
        <p className="mt-1 text-sm font-medium text-forest">{settings?.centralEmail}</p>
        <p className="text-xs text-forest/60">{t("notifications.central_note")}</p>
      </div>

      {/* Recipients */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-forest">{t("notifications.recipients")}</h3>
        {(settings?.recipients ?? []).map((r: RecipientRow) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-forest/10 p-3 text-sm"
          >
            <div>
              <p className="font-medium text-forest">
                {r.recipient_name}{" "}
                <span className="text-xs text-forest/50">({r.recipient_role})</span>
              </p>
              <p className="text-xs text-forest/60">{r.recipient_email}</p>
              <p className="mt-1 text-[11px] text-forest/50">
                {FLAGS.filter((f) => r[f]).map((f) => t(`notifications.flags.${f}`)).join(" · ") ||
                  t("notifications.no_events")}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className={ghost} onClick={() => setForm({ ...r })}>
                {t("notifications.edit")}
              </button>
              <button
                type="button"
                className={ghost}
                disabled={busy}
                onClick={() =>
                  run(
                    () => save({ data: { ...r, active: !r.active } }),
                    t("notifications.toast.saved"),
                  )
                }
              >
                {r.active ? t("notifications.deactivate") : t("notifications.activate")}
              </button>
              <button
                type="button"
                className={ghost}
                disabled={busy}
                onClick={() =>
                  run(() => remove({ data: { id: r.id } }), t("notifications.toast.deleted"))
                }
              >
                {t("notifications.delete")}
              </button>
            </div>
          </div>
        ))}

        <div className="space-y-3 rounded-2xl border border-forest/10 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              className={inputCls}
              placeholder={t("notifications.name")}
              value={form.recipient_name}
              onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
            />
            <input
              className={inputCls}
              type="email"
              placeholder={t("notifications.email")}
              value={form.recipient_email}
              onChange={(e) => setForm({ ...form, recipient_email: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder={t("notifications.role")}
              value={form.recipient_role}
              onChange={(e) => setForm({ ...form, recipient_role: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-forest/70">
            {FLAGS.map((f) => (
              <label key={f} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={form[f]}
                  onChange={(e) => setForm({ ...form, [f]: e.target.checked })}
                />
                {t(`notifications.flags.${f}`)}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const res = await save({ data: { ...form, property_id: propertyId } });
                  if (!("error" in res)) setForm(emptyRecipient(propertyId));
                  return res;
                }, t("notifications.toast.saved"))
              }
            >
              {form.id ? t("notifications.update") : t("notifications.add")}
            </button>
            {form.id ? (
              <button
                type="button"
                className={ghost}
                onClick={() => setForm(emptyRecipient(propertyId))}
              >
                {t("notifications.cancel")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Templates */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-forest">{t("notifications.templates")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className={inputCls}
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
          >
            {TEMPLATE_KEYS.map((k) => (
              <option key={k} value={k}>
                {t(`notifications.template_keys.${k}`)}
              </option>
            ))}
          </select>
          <select
            className={inputCls}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {TEMPLATE_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {t(`notifications.languages.${l}`)}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-forest/50">
          {t("notifications.source")}:{" "}
          {template ? t(`notifications.sources.${template.source}`) : "—"}
        </p>
        <input
          className={inputCls}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("notifications.subject")}
        />
        <textarea
          className={`${inputCls} min-h-[220px] font-mono text-xs`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="text-[11px] leading-relaxed text-forest/50">
          {t("notifications.variables")}: {TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(" ")}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btn}
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  storeTemplate({
                    data: {
                      propertyId,
                      key: templateKey as never,
                      language: language as never,
                      subject,
                      body,
                    },
                  }),
                t("notifications.toast.template_saved"),
              )
            }
          >
            {t("notifications.save_template")}
          </button>
          <button
            type="button"
            className={ghost}
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  resetTemplate({
                    data: { propertyId, key: templateKey as never, language: language as never },
                  }),
                t("notifications.toast.template_reset"),
              )
            }
          >
            {t("notifications.reset_template")}
          </button>
        </div>

        {template ? (
          <div className="rounded-2xl border border-forest/10 bg-sand/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gold">
              {t("notifications.preview")}
            </p>
            <p className="mt-1 text-sm font-semibold text-forest">{template.preview.subject}</p>
            <p
              className="mt-2 whitespace-pre-line text-xs text-forest/70"
              dir={language === "ar" ? "rtl" : "ltr"}
            >
              {template.preview.body}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputCls} max-w-xs`}
            type="email"
            placeholder={t("notifications.test_to")}
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <button
            type="button"
            className={ghost}
            disabled={busy || !testTo}
            onClick={() =>
              run(
                () =>
                  testMail({
                    data: {
                      propertyId,
                      key: templateKey as never,
                      language: language as never,
                      to: testTo,
                    },
                  }),
                t("notifications.toast.test_sent"),
              )
            }
          >
            {t("notifications.send_test")}
          </button>
        </div>
      </div>

      {/* Delivery log */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-forest">{t("notifications.log")}</h3>
          <button
            type="button"
            className={ghost}
            disabled={busy}
            onClick={() =>
              run(() => retry({ data: { propertyId } }), t("notifications.toast.retried"))
            }
          >
            {t("notifications.retry_failed")}
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto rounded-2xl border border-forest/10">
          {(settings?.log ?? []).length === 0 ? (
            <p className="p-4 text-xs text-forest/50">{t("notifications.log_empty")}</p>
          ) : (
            (settings?.log ?? []).map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-forest/5 px-4 py-2 text-xs last:border-0"
              >
                <span className="text-forest/70">
                  {new Date(row.created_at).toLocaleString()} · {row.template} · {row.language}
                </span>
                <span className="text-forest/60">{row.recipient}</span>
                <span
                  className={
                    row.status === "sent"
                      ? "text-emerald-600"
                      : row.status === "failed"
                        ? "text-rose-600"
                        : "text-forest/50"
                  }
                >
                  {t(`notifications.status.${row.status}`, row.status)}
                  {row.attempts ? ` (${row.attempts})` : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
