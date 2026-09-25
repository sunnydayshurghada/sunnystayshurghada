import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DayPicker } from "react-day-picker";
import { de, enUS, nl, ru, ar } from "react-day-picker/locale";
import { toast } from "sonner";
import { LogOut, Check, X, Trash2 } from "lucide-react";
import {
  listAdminData,
  getAdminSession,
  confirmBooking,
  setBookingStatus,
  createCalendarEntry,
  deleteCalendarEntry,
  type AdminBooking,
  type CalendarEntry,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { parseISODate } from "@/lib/availability";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AirbnbSyncPanel } from "@/components/AirbnbSyncPanel";
import { PropertyManager } from "@/components/PropertyManager";
import { PricingManager } from "@/components/PricingManager";
import { NotificationsManager } from "@/components/NotificationsManager";
import { OwnersManager } from "@/components/OwnersManager";
import { CurrencyManager } from "@/components/CurrencyManager";

import brandLogo from "@/assets/sunny-stays-hurghada-logo.png";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Buchungskalender — Sunny Stays Hurghada" },
      { name: "description", content: "Interner Buchungskalender der Gastgeber." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Buchungskalender — Sunny Stays Hurghada" },
      { property: "og:description", content: "Interner Buchungskalender der Gastgeber." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const SOURCE_KEYS = ["direct", "airbnb", "booking_com", "other"] as const;

const DP_LOCALES: Record<string, typeof de> = {
  de,
  en: enUS,
  nl,
  ru,
  ar,
  "ar-EG": ar,
};

const INTL_LOCALES: Record<string, string> = {
  de: "de-DE",
  en: "en-GB",
  nl: "nl-NL",
  ru: "ru-RU",
  ar: "ar-EG",
  "ar-EG": "ar-EG",
};

function days(start: string, end: string): Date[] {
  const out: Date[] = [];
  const s = parseISODate(start);
  const e = parseISODate(end);
  for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) out.push(new Date(d));
  return out;
}

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const lang = i18n.language in DP_LOCALES ? i18n.language : "de";
  const dir = lang.startsWith("ar") ? "rtl" : "ltr";
  const intlLocale = INTL_LOCALES[lang] ?? "de-DE";

  const fmt = (d: string) =>
    parseISODate(d).toLocaleDateString(intlLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const load = useServerFn(listAdminData);
  const session = useServerFn(getAdminSession);
  const doConfirm = useServerFn(confirmBooking);
  const doStatus = useServerFn(setBookingStatus);
  const doCreate = useServerFn(createCalendarEntry);
  const doDelete = useServerFn(deleteCalendarEntry);
  const [busy, setBusy] = useState(false);
  // "" = combined view across every apartment
  const [propertyId, setPropertyId] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-data", propertyId || "all"],
    queryFn: async () => {
      await session();
      return load({ data: { propertyId: propertyId || null } });
    },
  });

  const bookings = data?.bookings ?? [];
  const entries = data?.entries ?? [];
  const properties = data?.properties ?? [];
  const isAdmin = data?.isAdmin ?? false;
  const syncPropertyId = propertyId || properties[0]?.id || null;
  const propertyName = (id: string) => {
    const p = properties.find((x) => x.id === id);
    return p?.internal_name ?? p?.public_name ?? "";
  };

  const modifiers = useMemo(() => {
    const pending: Date[] = [];
    const confirmed: Date[] = [];
    const manual: Date[] = [];
    const blocked: Date[] = [];
    const airbnb: Date[] = [];
    for (const b of bookings) {
      if (b.status === "pending") pending.push(...days(b.checkin, b.checkout));
      if (b.status === "confirmed") confirmed.push(...days(b.checkin, b.checkout));
    }
    for (const e of entries) {
      const list = e.external_uid
        ? airbnb
        : e.entry_type === "booking"
          ? manual
          : blocked;
      list.push(...days(e.start_date, e.end_date));
    }
    return { pending, confirmed, manual, blocked, airbnb };
  }, [bookings, entries]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-data"] });

  const handle = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) {
        toast.error(t(`admin.errors.${res.error ?? "generic"}`, t("admin.errors.generic")));
        return false;
      }
      toast.success(okMsg);
      await refresh();
      return true;
    } catch {
      toast.error(t("admin.errors.generic"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  const onCreate = async (e: FormEvent<HTMLFormElement>, entry_type: "booking" | "block") => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const guestsRaw = String(fd.get("guests") ?? "").trim();
    const ok = await handle(
      () =>
        doCreate({
          data: {
            property_id: String(fd.get("property_id") ?? "") || syncPropertyId,
            start_date: String(fd.get("start_date") ?? ""),
            end_date: String(fd.get("end_date") ?? ""),
            entry_type,
            source: (String(fd.get("source") ?? "direct") || "direct") as
              | "direct"
              | "airbnb"
              | "booking_com"
              | "other",
            guest_name: String(fd.get("guest_name") ?? ""),
            guests: guestsRaw ? Number(guestsRaw) : null,
            guest_phone: String(fd.get("guest_phone") ?? ""),
            note: String(fd.get("note") ?? ""),
          },
        }),
      entry_type === "booking" ? t("admin.toast.booking_created") : t("admin.toast.blocked"),
    );
    if (ok) form.reset();
  };

  const pendingRequests = bookings.filter((b) => b.status === "pending");
  const otherRequests = bookings.filter((b) => b.status !== "pending");

  if (isLoading) {
    return (
      <main className="min-h-screen bg-sand flex items-center justify-center text-forest/60 text-sm">
        {t("admin.loading")}
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-sand flex items-center justify-center px-6" dir={dir}>
        <div className="bg-card rounded-3xl border border-forest/10 p-10 max-w-md text-center">
          <div className="flex justify-center mb-6">
            <LanguageSwitcher />
          </div>
          <h1 className="font-display text-2xl text-forest mb-3">{t("admin.no_access_title")}</h1>
          <p className="text-sm text-forest/70 mb-6">{t("admin.no_access_body")}</p>
          <button
            onClick={signOut}
            className="text-xs uppercase tracking-[0.25em] text-forest/60 hover:text-gold"
          >
            {t("admin.sign_out")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sand text-forest" dir={dir}>
      <header className="border-b border-forest/10 bg-paper">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <img src={brandLogo} alt="Sunny Stays Hurghada" className="h-12 w-auto" />
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-forest/60 hover:text-gold transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" /> {t("admin.sign_out")}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
        <section>
          <span className="block text-[10px] uppercase tracking-[0.35em] text-gold font-medium mb-2">
            {t("admin.overview")}
          </span>
          <h1 className="font-display text-3xl mb-6">{t("admin.calendar_title")}</h1>

          <label className="block max-w-sm mb-6">
            <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">
              {t("admin.property_filter")}
            </span>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full bg-card p-3 border border-forest/10 rounded-xl text-sm focus:outline-none focus:border-gold"
            >
              <option value="">{t("admin.all_properties")}</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.internal_name}
                  {p.status !== "active" ? ` (${t(`admin.properties.status.${p.status}`)})` : ""}
                </option>
              ))}
            </select>
          </label>


          <div className="bg-card rounded-3xl border border-forest/10 p-4 md:p-6 inline-block max-w-full overflow-x-auto">
            <DayPicker
              locale={DP_LOCALES[lang]}
              dir={dir}
              numberOfMonths={2}
              showOutsideDays={false}
              modifiers={modifiers}
              modifiersClassNames={{
                pending: "bg-gold/25 rounded-md",
                confirmed: "bg-forest text-paper rounded-md",
                manual: "bg-forest/70 text-paper rounded-md",
                blocked: "bg-forest/20 line-through rounded-md",
                airbnb: "bg-rose-500/70 text-paper rounded-md",
              }}
              className="[--rdp-day-height:2.3rem] [--rdp-day-width:2.3rem]"
            />
            <div className="mt-4 flex flex-wrap gap-4 text-[10px] uppercase tracking-widest text-forest/60">
              <Legend className="bg-gold/40" label={t("admin.legend.pending")} />
              <Legend className="bg-forest" label={t("admin.legend.confirmed")} />
              <Legend className="bg-forest/70" label={t("admin.legend.manual")} />
              <Legend className="bg-forest/20" label={t("admin.legend.blocked")} />
              <Legend className="bg-rose-500/70" label={t("admin.legend.airbnb")} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl mb-4">
            {t("admin.requests_open")}{" "}
            <span className="text-gold text-base align-middle">({pendingRequests.length})</span>
          </h2>
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-forest/60">{t("admin.no_open_requests")}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingRequests.map((b) => (
                <RequestCard
                  key={b.id}
                  booking={b}
                  busy={busy}
                  fmt={fmt}
                  intlLocale={intlLocale}
                  propertyName={propertyName(b.property_id)}
                  onConfirm={() =>
                    handle(() => doConfirm({ data: { id: b.id } }), t("admin.toast.confirmed"))
                  }
                  onReject={() =>
                    handle(
                      () => doStatus({ data: { id: b.id, status: "rejected" } }),
                      t("admin.toast.rejected"),
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={(e) => onCreate(e, "booking")}
            className="bg-card rounded-3xl border border-forest/10 p-6 space-y-3"
          >
            <h2 className="font-display text-xl mb-2">{t("admin.own_booking_title")}</h2>
            <PropertySelect properties={properties} value={propertyId || syncPropertyId} />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("admin.checkin")} name="start_date" type="date" required />
              <Field label={t("admin.checkout")} name="end_date" type="date" required />
            </div>
            <Field label={t("admin.guest_name_opt")} name="guest_name" />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t("admin.guests_opt")}
                name="guests"
                type="number"
                min={1}
                max={12}
              />
              <Field label={t("admin.phone_opt")} name="guest_phone" />
            </div>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">
                {t("admin.source")}
              </span>
              <select
                name="source"
                defaultValue="direct"
                className="w-full bg-card p-3 border border-forest/10 rounded-xl text-sm focus:outline-none focus:border-gold"
              >
                {SOURCE_KEYS.map((v) => (
                  <option key={v} value={v}>
                    {t(`admin.sources.${v}`)}
                  </option>
                ))}
              </select>
            </label>
            <Field label={t("admin.note")} name="note" />
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-forest text-sand py-4 rounded-xl text-xs uppercase tracking-[0.25em] font-bold hover:bg-gold hover:text-forest transition-colors disabled:opacity-60"
            >
              {t("admin.submit_booking")}
            </button>
          </form>

          <form
            onSubmit={(e) => onCreate(e, "block")}
            className="bg-card rounded-3xl border border-forest/10 p-6 space-y-3"
          >
            <h2 className="font-display text-xl mb-2">{t("admin.block_title")}</h2>
            <PropertySelect properties={properties} value={propertyId || syncPropertyId} />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("admin.from")} name="start_date" type="date" required />
              <Field label={t("admin.to")} name="end_date" type="date" required />
            </div>
            <Field label={t("admin.block_reason")} name="note" />
            <p className="text-xs text-forest/55 leading-relaxed">{t("admin.block_hint")}</p>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-forest text-sand py-4 rounded-xl text-xs uppercase tracking-[0.25em] font-bold hover:bg-gold hover:text-forest transition-colors disabled:opacity-60"
            >
              {t("admin.submit_block")}
            </button>
          </form>
        </section>

        <AirbnbSyncPanel intlLocale={intlLocale} propertyId={syncPropertyId} />

        <PricingManager propertyId={syncPropertyId} intlLocale={intlLocale} />

        <CurrencyManager propertyId={syncPropertyId} intlLocale={intlLocale} />

        <NotificationsManager propertyId={syncPropertyId} />

        <OwnersManager />


        <PropertyManager />

        <section>
          <h2 className="font-display text-2xl mb-4">{t("admin.entries_title")}</h2>
          {entries.length === 0 ? (
            <p className="text-sm text-forest/60">{t("admin.entries_empty")}</p>
          ) : (
            <div className="space-y-3">
              {entries.map((e: CalendarEntry) => (
                <div
                  key={e.id}
                  className="bg-card rounded-2xl border border-forest/10 p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="text-sm">
                    <span className="block text-[10px] uppercase tracking-[0.3em] text-gold mb-1">
                      {propertyName(e.property_id)}
                    </span>
                    <span className="font-medium">
                      {fmt(e.start_date)} – {fmt(e.end_date)}
                    </span>
                    <span className="ms-3 text-[10px] uppercase tracking-widest text-gold">
                      {e.entry_type === "booking"
                        ? `${t("admin.booking_label")} · ${t(`admin.sources.${e.source}`, e.source)}`
                        : t("admin.blocked_label")}
                    </span>
                    <div className="text-forest/60 text-xs mt-1">
                      {[
                        e.guest_name,
                        e.guests ? t("admin.guests_count", { count: e.guests }) : null,
                        e.guest_phone,
                        e.note,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  {e.external_uid ? (
                    <span className="text-[11px] uppercase tracking-widest text-forest/45">
                      {t("admin.sync.airbnb_readonly")}
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        handle(() => doDelete({ data: { id: e.id } }), t("admin.toast.removed"))
                      }
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-forest/50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t("admin.remove")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-2xl mb-4">{t("admin.handled_title")}</h2>
          {otherRequests.length === 0 ? (
            <p className="text-sm text-forest/60">{t("admin.handled_empty")}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {otherRequests.map((b) => (
                <div key={b.id} className="bg-card rounded-2xl border border-forest/10 p-4 text-sm">
                  <span className="block text-[10px] uppercase tracking-[0.3em] text-gold mb-1">
                    {propertyName(b.property_id)}
                  </span>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {fmt(b.checkin)} – {fmt(b.checkout)}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="text-forest/60 text-xs mt-1">
                    {b.guest_name} · {t("admin.guests_count", { count: b.guests })} ·{" "}
                    {b.guest_email}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/** Apartment picker inside the create forms — entries never land on the wrong calendar. */
function PropertySelect({
  properties,
  value,
}: {
  properties: { id: string; internal_name: string }[];
  value: string | null;
}) {
  const { t } = useTranslation();
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">
        {t("admin.property")}
      </span>
      <select
        name="property_id"
        defaultValue={value ?? ""}
        key={value ?? ""}
        className="w-full bg-card p-3 border border-forest/10 rounded-xl text-sm focus:outline-none focus:border-gold"
      >
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.internal_name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${className}`} />
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, string> = {
    pending: "bg-gold/25 text-forest",
    confirmed: "bg-forest text-paper",
    rejected: "bg-forest/10 text-forest/60",
    cancelled: "bg-forest/10 text-forest/60",
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest ${map[status] ?? ""}`}
    >
      {t(`admin.status.${status}`, status)}
    </span>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        min={min}
        max={max}
        className="w-full bg-card p-3 border border-forest/10 rounded-xl text-sm focus:outline-none focus:border-gold"
      />
    </label>
  );
}

function RequestCard({
  booking,
  busy,
  fmt,
  intlLocale,
  propertyName,
  onConfirm,
  onReject,
}: {
  booking: AdminBooking;
  busy: boolean;
  fmt: (d: string) => string;
  intlLocale: string;
  propertyName: string;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="bg-card rounded-3xl border border-forest/10 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="block text-[10px] uppercase tracking-[0.3em] text-gold mb-1">
            {propertyName}
          </span>
          <h3 className="font-display text-lg">{booking.guest_name}</h3>
          <p className="text-xs text-forest/60 mt-0.5">
            {t("admin.received_on", {
              date: new Date(booking.created_at).toLocaleDateString(intlLocale),
            })}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Info label={t("admin.checkin")} value={fmt(booking.checkin)} />
        <Info label={t("admin.checkout")} value={fmt(booking.checkout)} />
        <Info label={t("admin.guests")} value={String(booking.guests)} />
        <Info label={t("admin.phone")} value={booking.guest_phone || "—"} />
        <Info label={t("admin.email")} value={booking.guest_email} wide />
        {booking.message ? <Info label={t("admin.message")} value={booking.message} wide /> : null}
      </dl>
      <div className="mt-5 flex gap-3">
        <button
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-forest text-sand py-3 rounded-xl text-[11px] uppercase tracking-[0.2em] font-bold hover:bg-gold hover:text-forest transition-colors disabled:opacity-60"
        >
          <Check className="h-3.5 w-3.5" /> {t("admin.confirm")}
        </button>
        <button
          onClick={onReject}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-2 border border-forest/20 py-3 rounded-xl text-[11px] uppercase tracking-[0.2em] font-bold hover:border-red-500 hover:text-red-600 transition-colors disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" /> {t("admin.reject")}
        </button>
      </div>
    </div>
  );
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-[10px] uppercase tracking-widest text-forest/45">{label}</dt>
      <dd className="text-forest/85 break-words">{value}</dd>
    </div>
  );
}
