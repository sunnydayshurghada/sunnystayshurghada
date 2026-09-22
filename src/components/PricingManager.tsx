import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getAdminPricing,
  savePricingSettings,
  applyDayPrices,
  clearDayPrices,
  syncPricelabsNow,
} from "@/lib/pricing.functions";
import type { AdminPricing } from "@/lib/pricing.functions";
import type { NightPrice, PricingSettings } from "@/lib/pricing.server";

const SOURCE_STYLES: Record<string, string> = {
  manual: "bg-gold/25 border-gold/60",
  pricelabs_override: "bg-gold/40 border-gold",
  pricelabs: "bg-sky-100 border-sky-300",
  season: "bg-emerald-100 border-emerald-300",
  weekend: "bg-amber-50 border-amber-200",
  base: "bg-card border-forest/10",
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthBounds(year: number, month: number): { from: string; to: string } {
  return {
    from: iso(new Date(Date.UTC(year, month, 1))),
    to: iso(new Date(Date.UTC(year, month + 1, 1))),
  };
}

export function PricingManager({
  propertyId,
  intlLocale,
}: {
  propertyId: string | null;
  intlLocale: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const load = useServerFn(getAdminPricing);
  const saveSettings = useServerFn(savePricingSettings);
  const applyPrices = useServerFn(applyDayPrices);
  const clearPrices = useServerFn(clearDayPrices);
  const syncNow = useServerFn(syncPricelabsNow);

  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)));
  const [selection, setSelection] = useState<string[]>([]);
  const [detail, setDetail] = useState<NightPrice | null>(null);
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const { from, to } = monthBounds(year, month);

  const { data } = useQuery({
    queryKey: ["admin-pricing", propertyId ?? "default", from],
    queryFn: () => load({ data: { propertyId, from, to } }),
    enabled: Boolean(propertyId),
  });

  const pricing: AdminPricing | null =
    data && !("error" in data) ? (data as AdminPricing) : null;
  const settings = pricing?.settings ?? null;
  const currency = settings?.currency ?? "EUR";

  const byDate = useMemo(() => {
    const m = new Map<string, NightPrice>();
    for (const n of pricing?.nights ?? []) m.set(n.date, n);
    return m;
  }, [pricing]);

  const money = (cents: number) =>
    new Intl.NumberFormat(intlLocale, { style: "currency", currency }).format(cents / 100);

  const days = useMemo(() => {
    const first = new Date(Date.UTC(year, month, 1));
    const lead = (first.getUTCDay() + 6) % 7; // Monday-first grid
    const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: count }, (_, i) => iso(new Date(Date.UTC(year, month, i + 1)))),
    ];
  }, [year, month]);

  function toggleDay(date: string, extend: boolean) {
    setDetail(byDate.get(date) ?? null);
    setSelection((prev) => {
      if (extend && prev.length > 0) {
        const all = [...prev, date].sort();
        const start = all[0]!;
        const end = all[all.length - 1]!;
        return days.filter((d): d is string => Boolean(d) && d! >= start && d! <= end);
      }
      return prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort();
    });
  }

  function selectMonth() {
    setSelection(days.filter((d): d is string => Boolean(d)));
  }

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setBusy(true);
    try {
      const res = await fn();
      if (res.ok) {
        toast.success(okMsg);
        setSelection([]);
        await qc.invalidateQueries({ queryKey: ["admin-pricing"] });
      } else {
        toast.error(t(`pricing.errors.${res.error}`, t("pricing.errors.generic")));
      }
    } finally {
      setBusy(false);
    }
  }

  const range = selection.length
    ? { from: selection[0]!, to: iso(new Date(new Date(`${selection[selection.length - 1]!}T00:00:00Z`).getTime() + 86_400_000)) }
    : null;

  if (!propertyId) {
    return (
      <section>
        <h2 className="font-display text-2xl mb-3">{t("pricing.title")}</h2>
        <p className="text-sm text-forest/60">{t("pricing.pick_property")}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">{t("pricing.title")}</h2>
        <p className="text-sm text-forest/60 mt-1">{t("pricing.intro")}</p>
      </div>

      {settings ? <SettingsForm settings={settings} busy={busy} onSave={(payload) => run(() => saveSettings({ data: { propertyId, ...payload } }), t("pricing.toast.saved"))} /> : null}

      <div className="bg-card rounded-3xl border border-forest/10 p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={() => setCursor(new Date(Date.UTC(year, month - 1, 1)))}
            className="px-3 py-2 rounded-xl border border-forest/15 text-sm hover:border-gold"
          >
            ‹
          </button>
          <span className="font-display text-lg">
            {new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric", timeZone: "UTC" }).format(cursor)}
          </span>
          <button
            type="button"
            onClick={() => setCursor(new Date(Date.UTC(year, month + 1, 1)))}
            className="px-3 py-2 rounded-xl border border-forest/15 text-sm hover:border-gold"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map((date, i) =>
            date === null ? (
              <div key={`pad-${i}`} />
            ) : (
              <button
                key={date}
                type="button"
                onClick={(e) => toggleDay(date, e.shiftKey)}
                className={`rounded-xl border p-2 text-start min-h-[62px] transition-colors ${
                  SOURCE_STYLES[byDate.get(date)?.source ?? "base"]
                } ${selection.includes(date) ? "ring-2 ring-forest" : ""}`}
              >
                <span className="block text-xs text-forest/60">{Number(date.slice(8))}</span>
                <span className="block text-[11px] font-medium">
                  {byDate.has(date) ? money(byDate.get(date)!.price) : "—"}
                </span>
              </button>
            ),
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-end mt-5">
          <button type="button" onClick={selectMonth} className="text-[11px] uppercase tracking-widest border border-forest/20 rounded-xl px-4 py-3 hover:border-gold">
            {t("pricing.select_month")}
          </button>
          <button type="button" onClick={() => setSelection([])} className="text-[11px] uppercase tracking-widest border border-forest/20 rounded-xl px-4 py-3 hover:border-gold">
            {t("pricing.clear_selection")}
          </button>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">{t("pricing.price_cents")}</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className="w-32 bg-card p-3 border border-forest/10 rounded-xl text-sm" />
          </label>
          <label className="block flex-1 min-w-[160px]">
            <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">{t("pricing.reason")}</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-card p-3 border border-forest/10 rounded-xl text-sm" />
          </label>
          <button
            type="button"
            disabled={busy || !range || !price}
            onClick={() =>
              run(
                () => applyPrices({ data: { propertyId, from: range!.from, to: range!.to, price: Number(price), minimum_nights: null, reason, expires_at: null } }),
                t("pricing.toast.applied"),
              )
            }
            className="bg-forest text-sand px-5 py-3 rounded-xl text-[11px] uppercase tracking-[0.2em] font-bold hover:bg-gold hover:text-forest disabled:opacity-50"
          >
            {t("pricing.apply")}
          </button>
          <button
            type="button"
            disabled={busy || !range}
            onClick={() => run(() => clearPrices({ data: { propertyId, from: range!.from, to: range!.to } }), t("pricing.toast.reset"))}
            className="border border-forest/20 px-5 py-3 rounded-xl text-[11px] uppercase tracking-[0.2em] font-bold hover:border-red-500 hover:text-red-600 disabled:opacity-50"
          >
            {t("pricing.reset")}
          </button>
        </div>

        <div className="flex flex-wrap gap-4 mt-5 text-[11px] text-forest/60">
          {(["manual", "pricelabs", "pricelabs_override", "season", "weekend", "base"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-2">
              <span className={`h-3 w-3 rounded border ${SOURCE_STYLES[s]}`} /> {t(`pricing.sources.${s}`)}
            </span>
          ))}
        </div>

        {detail && settings ? (
          <div className="mt-5 rounded-2xl border border-forest/10 p-4 text-sm space-y-1">
            <p className="font-medium">{new Intl.DateTimeFormat(intlLocale, { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${detail.date}T00:00:00Z`))}</p>
            <p>{t("pricing.detail.used")}: <strong>{money(detail.price)}</strong></p>
            <p>{t("pricing.detail.pricelabs")}: {detail.pricelabsPrice ? money(detail.pricelabsPrice) : "—"}</p>
            <p>{t("pricing.detail.bounds")}: {money(settings.minimum_price)} – {money(settings.maximum_price)}</p>
            <p>{t("pricing.detail.source")}: {t(`pricing.sources.${detail.source}`)}{detail.ruleName ? ` · ${detail.ruleName}` : ""}</p>
            <p>{t("pricing.detail.updated")}: {detail.providerUpdatedAt ? new Date(detail.providerUpdatedAt).toLocaleString(intlLocale) : "—"}</p>
            {detail.overrideReason ? <p>{t("pricing.reason")}: {detail.overrideReason}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="bg-card rounded-3xl border border-forest/10 p-5 md:p-6">
        <h3 className="font-display text-xl mb-2">{t("pricing.pricelabs.title")}</h3>
        <p className="text-sm text-forest/65">
          {pricing?.pricelabs.configured ? t("pricing.pricelabs.configured") : t("pricing.pricelabs.missing_key")}
        </p>
        {pricing?.pricelabs.syncError ? (
          <p className="text-sm text-red-600 mt-2">{t(`pricing.pricelabs.error.${pricing.pricelabs.syncError}`, pricing.pricelabs.syncError)}</p>
        ) : null}
        <p className="text-xs text-forest/55 mt-2">
          {t("pricing.pricelabs.last_sync")}: {pricing?.pricelabs.lastSyncAt ? new Date(pricing.pricelabs.lastSyncAt).toLocaleString(intlLocale) : "—"}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => syncNow({ data: { propertyId } }), t("pricing.toast.synced"))}
          className="mt-4 border border-forest/20 px-5 py-3 rounded-xl text-[11px] uppercase tracking-[0.2em] font-bold hover:border-gold disabled:opacity-50"
        >
          {t("pricing.pricelabs.sync_now")}
        </button>
      </div>
    </section>
  );
}

type SettingsPayload = Omit<
  Parameters<typeof savePricingSettings>[0] extends never ? never : Record<string, unknown>,
  never
>;

function SettingsForm({
  settings,
  busy,
  onSave,
}: {
  settings: PricingSettings;
  busy: boolean;
  onSave: (payload: SettingsPayload) => void;
}) {
  const { t } = useTranslation();
  const num = (fd: FormData, key: string) => Number(fd.get(key) ?? 0);
  const nullableNum = (fd: FormData, key: string) => {
    const raw = String(fd.get(key) ?? "").trim();
    return raw === "" ? null : Number(raw);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSave({
          pricing_mode: String(fd.get("pricing_mode")),
          currency: String(fd.get("currency")).toUpperCase(),
          base_price: num(fd, "base_price"),
          minimum_price: num(fd, "minimum_price"),
          maximum_price: num(fd, "maximum_price"),
          weekend_price: nullableNum(fd, "weekend_price"),
          cleaning_fee: num(fd, "cleaning_fee"),
          minimum_stay: num(fd, "minimum_stay"),
          direct_booking_adjustment_percent: num(fd, "direct_booking_adjustment_percent"),
          direct_booking_adjustment_fixed: num(fd, "direct_booking_adjustment_fixed"),
          extra_guest_fee: num(fd, "extra_guest_fee"),
          extra_guest_after: num(fd, "extra_guest_after"),
          weekly_discount_percent: num(fd, "weekly_discount_percent"),
          monthly_discount_percent: num(fd, "monthly_discount_percent"),
          length_of_stay_nights: nullableNum(fd, "length_of_stay_nights"),
          length_of_stay_discount_percent: num(fd, "length_of_stay_discount_percent"),
          last_minute_days: nullableNum(fd, "last_minute_days"),
          last_minute_discount_percent: num(fd, "last_minute_discount_percent"),
          pricelabs_enabled: fd.get("pricelabs_enabled") === "on",
          pricelabs_listing_id: String(fd.get("pricelabs_listing_id") ?? "").trim() || null,
        });
      }}
      className="bg-card rounded-3xl border border-forest/10 p-5 md:p-6 space-y-4"
    >
      <h3 className="font-display text-xl">{t("pricing.settings_title")}</h3>
      <label className="block max-w-xs">
        <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">{t("pricing.mode")}</span>
        <select name="pricing_mode" defaultValue={settings.pricing_mode} className="w-full bg-card p-3 border border-forest/10 rounded-xl text-sm">
          {(["manual", "pricelabs", "hybrid"] as const).map((m) => (
            <option key={m} value={m}>{t(`pricing.modes.${m}`)}</option>
          ))}
        </select>
      </label>
      <p className="text-xs text-forest/55">{t("pricing.price_hint")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Num name="base_price" label={t("pricing.base_price")} value={settings.base_price} />
        <Num name="minimum_price" label={t("pricing.minimum_price")} value={settings.minimum_price} />
        <Num name="maximum_price" label={t("pricing.maximum_price")} value={settings.maximum_price} />
        <Num name="weekend_price" label={t("pricing.weekend_price")} value={settings.weekend_price} />
        <Num name="cleaning_fee" label={t("pricing.cleaning_fee")} value={settings.cleaning_fee} />
        <Num name="minimum_stay" label={t("pricing.minimum_stay")} value={settings.minimum_stay} />
        <Num name="extra_guest_fee" label={t("pricing.extra_guest_fee")} value={settings.extra_guest_fee} />
        <Num name="extra_guest_after" label={t("pricing.extra_guest_after")} value={settings.extra_guest_after} />
        <Num name="direct_booking_adjustment_percent" label={t("pricing.direct_percent")} value={Number(settings.direct_booking_adjustment_percent)} step="0.01" />
        <Num name="direct_booking_adjustment_fixed" label={t("pricing.direct_fixed")} value={settings.direct_booking_adjustment_fixed} />
        <Num name="weekly_discount_percent" label={t("pricing.weekly_discount")} value={Number(settings.weekly_discount_percent)} step="0.01" />
        <Num name="monthly_discount_percent" label={t("pricing.monthly_discount")} value={Number(settings.monthly_discount_percent)} step="0.01" />
        <Num name="length_of_stay_nights" label={t("pricing.los_nights")} value={settings.length_of_stay_nights} />
        <Num name="length_of_stay_discount_percent" label={t("pricing.los_discount")} value={Number(settings.length_of_stay_discount_percent)} step="0.01" />
        <Num name="last_minute_days" label={t("pricing.last_minute_days")} value={settings.last_minute_days} />
        <Num name="last_minute_discount_percent" label={t("pricing.last_minute_discount")} value={Number(settings.last_minute_discount_percent)} step="0.01" />
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">{t("pricing.currency")}</span>
          <input name="currency" defaultValue={settings.currency} maxLength={3} className="w-full bg-card p-3 border border-forest/10 rounded-xl text-sm" />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">{t("pricing.pricelabs.listing_id")}</span>
          <input name="pricelabs_listing_id" defaultValue={settings.pricelabs_listing_id ?? ""} className="w-full bg-card p-3 border border-forest/10 rounded-xl text-sm" />
        </label>
      </div>
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" name="pricelabs_enabled" defaultChecked={settings.pricelabs_enabled} /> {t("pricing.pricelabs.enabled")}
      </label>
      <button type="submit" disabled={busy} className="w-full sm:w-auto bg-forest text-sand px-6 py-3 rounded-xl text-[11px] uppercase tracking-[0.2em] font-bold hover:bg-gold hover:text-forest disabled:opacity-50">
        {t("pricing.save")}
      </button>
    </form>
  );
}

function Num({
  name,
  label,
  value,
  step,
}: {
  name: string;
  label: string;
  value: number | null;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">{label}</span>
      <input
        name={name}
        type="number"
        step={step}
        defaultValue={value ?? ""}
        className="w-full bg-card p-3 border border-forest/10 rounded-xl text-sm focus:outline-none focus:border-gold"
      />
    </label>
  );
}
