import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  getOwnerOverview,
  getOwnerBookings,
  getOwnerCalendar,
  createOwnerBlock,
  exportOwnerCsv,
  updateOwnProfile,
  type OwnerOverview,
  type OwnerBooking,
  type OwnerCalendarEntry,
} from "@/lib/owner.functions";
import { recordLogin } from "@/lib/owners.admin.functions";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "Eigentümerportal – Sunny Stays Hurghada" },
      { name: "robots", content: "noindex, nofollow" },
      {
        name: "description",
        content: "Geschützter Bereich für Eigentümer der Sunny Stays Wohnungen in Hurghada.",
      },
    ],
  }),
  component: OwnerPortal,
});

type Preset = "this_month" | "last_month" | "next_month" | "this_year" | "custom";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: Preset): { from: string; to: string } {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = n.getUTCMonth();
  switch (preset) {
    case "last_month":
      return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 1))) };
    case "next_month":
      return {
        from: iso(new Date(Date.UTC(y, m + 1, 1))),
        to: iso(new Date(Date.UTC(y, m + 2, 1))),
      };
    case "this_year":
      return { from: iso(new Date(Date.UTC(y, 0, 1))), to: iso(new Date(Date.UTC(y + 1, 0, 1))) };
    default:
      return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 1))) };
  }
}

const KIND_STYLE: Record<string, string> = {
  confirmed: "bg-forest text-sand",
  inquiry: "bg-gold/30 text-forest",
  airbnb: "bg-rose-500/70 text-white",
  manual: "bg-forest/70 text-sand",
  block: "bg-forest/20 text-forest",
  cancelled: "bg-forest/10 text-forest/50 line-through",
};

function OwnerPortal() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language.startsWith("ar");
  const intlLocale = i18n.language === "ar-EG" ? "ar-EG" : i18n.language;

  const [tab, setTab] = useState<"overview" | "bookings" | "cancellations" | "calendar" | "profile">(
    "overview",
  );
  const [preset, setPreset] = useState<Preset>("this_month");
  const [custom, setCustom] = useState(presetRange("this_month"));
  const range = preset === "custom" ? custom : presetRange(preset);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [block, setBlock] = useState({ start_date: "", end_date: "", note: "" });

  const loadOverview = useServerFn(getOwnerOverview);
  const loadBookings = useServerFn(getOwnerBookings);
  const loadCalendar = useServerFn(getOwnerCalendar);
  const addBlock = useServerFn(createOwnerBlock);
  const exportCsv = useServerFn(exportOwnerCsv);
  const saveProfile = useServerFn(updateOwnProfile);
  const login = useServerFn(recordLogin);

  useEffect(() => {
    void login({ data: undefined as never }).catch(() => {});
  }, [login]);

  const { data: overviewRaw } = useQuery({
    queryKey: ["owner-overview", range.from, range.to, propertyId],
    queryFn: () => loadOverview({ data: { ...range, propertyId } }),
  });
  const overview =
    overviewRaw && !("error" in overviewRaw) ? (overviewRaw as OwnerOverview) : null;
  const overviewError =
    overviewRaw && "error" in overviewRaw ? (overviewRaw.error as string) : null;

  useEffect(() => {
    if (overview?.profile.language && i18n.language !== overview.profile.language) {
      void i18n.changeLanguage(overview.profile.language);
    }
    // only react to the stored preference once it arrives
  }, [overview?.profile.language]); // eslint-disable-line react-hooks/exhaustive-deps

  const bookingFilters = {
    ...range,
    propertyId,
    status: status || null,
    paymentStatus: paymentStatus || null,
    source: source || null,
  };

  const { data: bookingsRaw } = useQuery({
    queryKey: ["owner-bookings", JSON.stringify(bookingFilters), tab],
    queryFn: () =>
      loadBookings({
        data: { ...bookingFilters, onlyCancelled: tab === "cancellations" },
      }),
    enabled: tab === "bookings" || tab === "cancellations",
  });
  const bookings: OwnerBooking[] =
    bookingsRaw && Array.isArray(bookingsRaw) ? (bookingsRaw as OwnerBooking[]) : [];

  const { data: calendarRaw } = useQuery({
    queryKey: ["owner-calendar", range.from, range.to, propertyId],
    queryFn: () => loadCalendar({ data: { ...range, propertyId } }),
    enabled: tab === "calendar",
  });
  const calendar: OwnerCalendarEntry[] = Array.isArray(calendarRaw)
    ? (calendarRaw as OwnerCalendarEntry[])
    : [];

  const money = useMemo(
    () => (cents: number | null | undefined, currency = overview?.totals.currency ?? "EUR") =>
      cents === null || cents === undefined
        ? "—"
        : new Intl.NumberFormat(intlLocale, { style: "currency", currency }).format(cents / 100),
    [intlLocale, overview?.totals.currency],
  );

  const canBlock = (overview?.properties ?? []).some((p) => p.permissions.blocks);
  const blockProperty =
    propertyId ?? (overview?.properties ?? []).find((p) => p.permissions.blocks)?.id ?? null;

  const download = async (kind: "bookings" | "cancellations") => {
    setBusy(true);
    const res = await exportCsv({ data: { ...bookingFilters, kind } });
    setBusy(false);
    if (!res || "error" in res) {
      toast.error(t("owner.errors.generic"));
      return;
    }
    const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sunny-stays-${kind}-${range.from}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const card = "rounded-3xl border border-forest/10 bg-card p-4 sm:p-5";
  const chip =
    "rounded-full border px-4 py-1.5 text-xs uppercase tracking-widest transition-colors";
  const input =
    "rounded-xl border border-forest/15 bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none";

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="min-h-screen bg-sand/40 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-gold">
              {t("owner.eyebrow")}
            </p>
            <h1 className="font-display text-2xl text-forest sm:text-3xl">
              {t("owner.title")}
              {overview?.profile.firstName ? `, ${overview.profile.firstName}` : ""}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              type="button"
              className={`${chip} border-forest/20 text-forest hover:border-gold hover:text-gold`}
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
            >
              {t("owner.sign_out")}
            </button>
          </div>
        </header>

        {overviewError ? (
          <div className={card}>
            <p className="text-sm text-forest/70">{t(`owner.errors.${overviewError}`)}</p>
          </div>
        ) : null}

        {/* period + property filters */}
        <div className={`${card} flex flex-wrap items-center gap-3`}>
          {(["this_month", "last_month", "next_month", "this_year", "custom"] as Preset[]).map(
            (p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`${chip} ${
                  preset === p
                    ? "border-gold bg-gold/20 text-forest"
                    : "border-forest/15 text-forest/70 hover:border-gold"
                }`}
              >
                {t(`owner.periods.${p}`)}
              </button>
            ),
          )}
          {preset === "custom" ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className={input}
                value={custom.from}
                onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              />
              <input
                type="date"
                className={input}
                value={custom.to}
                onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              />
            </div>
          ) : null}
          <select
            className={input}
            value={propertyId ?? ""}
            onChange={(e) => setPropertyId(e.target.value || null)}
          >
            <option value="">{t("owner.all_properties")}</option>
            {(overview?.properties ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* tabs */}
        <nav className="flex flex-wrap gap-2">
          {(["overview", "bookings", "cancellations", "calendar", "profile"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`${chip} ${
                tab === k
                  ? "border-forest bg-forest text-sand"
                  : "border-forest/15 text-forest/70 hover:border-gold"
              }`}
            >
              {t(`owner.tabs.${k}`)}
            </button>
          ))}
        </nav>

        {tab === "overview" && overview ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                ["properties", overview.totals.properties],
                ["current_guests", overview.totals.currentGuests],
                ["new_inquiries", overview.totals.newInquiries],
                ["confirmed", overview.totals.confirmed],
                ["cancelled", overview.totals.cancelled],
                ["nights_booked", overview.totals.nightsBooked],
                ["nights_available", overview.totals.nightsAvailable],
                ["occupancy", `${overview.totals.occupancy}%`],
              ].map(([key, value]) => (
                <div key={key as string} className={card}>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-forest/50">
                    {t(`owner.metrics.${key}`)}
                  </p>
                  <p className="mt-1 font-display text-2xl text-forest">{value as string}</p>
                </div>
              ))}
              {overview.totals.financialsVisible
                ? [
                    ["revenue", overview.totals.revenue],
                    ["paid", overview.totals.paid],
                    ["open", overview.totals.open],
                    ["refunds", overview.totals.refunds],
                  ].map(([key, value]) => (
                    <div key={key as string} className={`${card} border-gold/40 bg-gold/5`}>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-gold">
                        {t(`owner.metrics.${key}`)}
                      </p>
                      <p className="mt-1 font-display text-2xl text-forest">
                        {money(value as number)}
                      </p>
                    </div>
                  ))
                : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(["arrivals", "departures"] as const).map((k) => (
                <div key={k} className={card}>
                  <h2 className="text-sm font-semibold text-forest">{t(`owner.${k}`)}</h2>
                  {overview[k].length === 0 ? (
                    <p className="mt-2 text-xs text-forest/50">{t("owner.none")}</p>
                  ) : (
                    overview[k].map((row, idx) => (
                      <p key={idx} className="mt-1 text-sm text-forest/70">
                        {row.date} · {row.property} · {row.guests} {t("owner.guests")}
                      </p>
                    ))
                  )}
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {overview.properties.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPropertyId(p.id);
                    setTab("bookings");
                  }}
                  className={`${card} text-start transition-shadow hover:shadow-lift`}
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      className="mb-3 h-36 w-full rounded-2xl object-cover"
                    />
                  ) : null}
                  <p className="font-display text-lg text-forest">{p.name}</p>
                  <p className="text-xs text-forest/60">
                    {p.area} · {t(`owner.status.${p.status}`, { defaultValue: p.status })}
                  </p>
                  <p className="mt-2 text-xs text-forest/70">
                    {p.occupiedToday ? t("owner.occupied_now") : t("owner.free_now")} ·{" "}
                    {t("owner.metrics.occupancy")}: {p.occupancy}%
                  </p>
                  <p className="text-xs text-forest/70">
                    {t("owner.next_arrival")}: {p.nextArrival ?? "—"} · {t("owner.next_departure")}:{" "}
                    {p.nextDeparture ?? "—"}
                  </p>
                  <p className="text-xs text-forest/70">
                    {t("owner.metrics.confirmed")}: {p.bookingsInRange}
                    {p.revenue !== null ? ` · ${money(p.revenue, p.currency)}` : ""}
                  </p>
                  {p.syncError ? (
                    <p className="mt-2 text-xs text-rose-600">{t("owner.sync_error")}</p>
                  ) : null}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {(tab === "bookings" || tab === "cancellations") && (
          <div className={`${card} space-y-4`}>
            <div className="flex flex-wrap items-center gap-2">
              {tab === "bookings" ? (
                <>
                  <select
                    className={input}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">{t("owner.filters.any_status")}</option>
                    {["pending", "confirmed", "rejected", "cancelled"].map((s) => (
                      <option key={s} value={s}>
                        {t(`owner.booking_status.${s}`)}
                      </option>
                    ))}
                  </select>
                  <select
                    className={input}
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  >
                    <option value="">{t("owner.filters.any_payment")}</option>
                    {["unpaid", "pending", "paid", "refunded"].map((s) => (
                      <option key={s} value={s}>
                        {t(`owner.payment_status.${s}`)}
                      </option>
                    ))}
                  </select>
                  <select
                    className={input}
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    <option value="">{t("owner.filters.any_source")}</option>
                    {["direct", "airbnb", "manual", "other"].map((s) => (
                      <option key={s} value={s}>
                        {t(`owner.sources.${s}`)}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
              <button
                type="button"
                disabled={busy}
                className={`${chip} border-forest/20 text-forest hover:border-gold hover:text-gold`}
                onClick={() => void download(tab === "cancellations" ? "cancellations" : "bookings")}
              >
                {t("owner.export_csv")}
              </button>
            </div>

            {bookings.length === 0 ? (
              <p className="text-sm text-forest/50">{t("owner.none")}</p>
            ) : (
              <div className="space-y-2">
                {bookings.map((b) => (
                  <div key={b.id} className="rounded-2xl border border-forest/10 p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium text-forest">
                        {b.booking_number} · {b.property}
                      </span>
                      <span className="text-forest/60">
                        {t(`owner.booking_status.${b.status}`, { defaultValue: b.status })} ·{" "}
                        {t(`owner.payment_status.${b.payment_status}`, {
                          defaultValue: b.payment_status,
                        })}{" "}
                        · {t(`owner.sources.${b.source}`, { defaultValue: b.source })}
                      </span>
                    </div>
                    <p className="text-forest/70">
                      {b.checkin} → {b.checkout} · {b.nights} {t("owner.nights")} · {b.guests}{" "}
                      {t("owner.guests")}
                    </p>
                    {b.guest_name ? (
                      <p className="text-forest/60">
                        {b.guest_name} · {b.guest_email} · {b.guest_phone ?? "—"}
                      </p>
                    ) : null}
                    {b.financials ? (
                      <p className="text-forest/60">
                        {t("owner.metrics.revenue")}: {money(b.financials.gross, b.currency)} ·{" "}
                        {t("owner.finance.cleaning")}: {money(b.financials.cleaning, b.currency)} ·{" "}
                        {t("owner.finance.discount")}: {money(b.financials.discount, b.currency)} ·{" "}
                        {t("owner.finance.paid")}: {money(b.amount_paid, b.currency)} ·{" "}
                        {t("owner.finance.commission")}:{" "}
                        {money(b.financials.commission, b.currency)} · {t("owner.finance.net")}:{" "}
                        {money(b.financials.net, b.currency)}
                      </p>
                    ) : null}
                    {b.cancelled_at ? (
                      <p className="text-rose-600">
                        {t("owner.cancelled_on")}: {b.cancelled_at.slice(0, 10)}
                        {b.cancelled_by ? ` · ${b.cancelled_by}` : ""}
                        {b.cancellation_reason ? ` · ${b.cancellation_reason}` : ""} ·{" "}
                        {t("owner.finance.refund")}: {money(b.refund_amount, b.currency)} (
                        {b.refund_status})
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "calendar" ? (
          <div className={`${card} space-y-4`}>
            <div className="flex flex-wrap gap-3 text-xs text-forest/70">
              {Object.keys(KIND_STYLE).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={`inline-block h-3 w-5 rounded ${KIND_STYLE[k]}`} />
                  {t(`owner.kinds.${k}`)}
                </span>
              ))}
            </div>
            {calendar.length === 0 ? (
              <p className="text-sm text-forest/50">{t("owner.none")}</p>
            ) : (
              <div className="space-y-2">
                {calendar.map((e, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-forest/10 p-3 text-sm"
                  >
                    <span className="text-forest/70">
                      {e.start} → {e.end} · {e.property}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs ${KIND_STYLE[e.kind]}`}>
                      {t(`owner.kinds.${e.kind}`)}
                      {e.label ? ` · ${e.label}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {canBlock && blockProperty ? (
              <div className="space-y-2 rounded-2xl border border-forest/10 p-4">
                <h3 className="text-sm font-semibold text-forest">{t("owner.add_block")}</h3>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    className={input}
                    value={block.start_date}
                    onChange={(e) => setBlock({ ...block, start_date: e.target.value })}
                  />
                  <input
                    type="date"
                    className={input}
                    value={block.end_date}
                    onChange={(e) => setBlock({ ...block, end_date: e.target.value })}
                  />
                  <input
                    className={input}
                    placeholder={t("owner.block_note")}
                    value={block.note}
                    onChange={(e) => setBlock({ ...block, note: e.target.value })}
                  />
                  <button
                    type="button"
                    disabled={busy || !block.start_date || !block.end_date}
                    className={`${chip} border-forest bg-forest text-sand`}
                    onClick={async () => {
                      setBusy(true);
                      const res = await addBlock({
                        data: { propertyId: blockProperty, ...block },
                      });
                      setBusy(false);
                      if (res && "error" in res) {
                        toast.error(
                          t(`owner.errors.${res.error}`, { defaultValue: t("owner.errors.generic") }),
                        );
                      } else {
                        toast.success(t("owner.block_created"));
                        setBlock({ start_date: "", end_date: "", note: "" });
                      }
                    }}
                  >
                    {t("owner.save")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "profile" && overview ? (
          <ProfileForm
            initial={overview.profile}
            onSave={async (values) => {
              const res = await saveProfile({ data: values });
              if (res && "error" in res) toast.error(t("owner.errors.generic"));
              else {
                toast.success(t("owner.profile_saved"));
                void i18n.changeLanguage(values.preferred_language);
              }
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function ProfileForm({
  initial,
  onSave,
}: {
  initial: OwnerOverview["profile"];
  onSave: (v: {
    first_name: string;
    last_name: string;
    phone: string;
    preferred_language: "de" | "en" | "ar";
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [v, setV] = useState({
    first_name: initial.firstName,
    last_name: initial.lastName,
    phone: initial.phone ?? "",
    preferred_language: (["de", "en", "ar"].includes(initial.language)
      ? initial.language
      : "de") as "de" | "en" | "ar",
  });
  const input =
    "w-full rounded-xl border border-forest/15 bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none";
  return (
    <div className="space-y-3 rounded-3xl border border-forest/10 bg-card p-5">
      <h2 className="font-display text-xl text-forest">{t("owner.tabs.profile")}</h2>
      <p className="text-xs text-forest/60">{initial.email}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className={input}
          value={v.first_name}
          placeholder={t("owner.first_name")}
          onChange={(e) => setV({ ...v, first_name: e.target.value })}
        />
        <input
          className={input}
          value={v.last_name}
          placeholder={t("owner.last_name")}
          onChange={(e) => setV({ ...v, last_name: e.target.value })}
        />
        <input
          className={input}
          value={v.phone}
          placeholder={t("owner.phone")}
          onChange={(e) => setV({ ...v, phone: e.target.value })}
        />
        <select
          className={input}
          value={v.preferred_language}
          onChange={(e) =>
            setV({ ...v, preferred_language: e.target.value as "de" | "en" | "ar" })
          }
        >
          <option value="de">Deutsch</option>
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
      </div>
      <button
        type="button"
        className="rounded-full bg-forest px-4 py-2 text-xs uppercase tracking-widest text-sand hover:bg-gold hover:text-forest"
        onClick={() => void onSave(v)}
      >
        {t("owner.save")}
      </button>
    </div>
  );
}
