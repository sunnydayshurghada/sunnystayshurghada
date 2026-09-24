import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  getCurrencyAdmin,
  refreshExchangeRates,
  saveCurrencySettings,
  setManualRate,
  type CurrencyAdminData,
} from "@/lib/currency.functions";
import { CURRENCIES, type Currency } from "@/lib/currency";

export function CurrencyManager({
  propertyId,
  intlLocale,
}: {
  propertyId: string | null;
  intlLocale: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const load = useServerFn(getCurrencyAdmin);
  const save = useServerFn(saveCurrencySettings);
  const refresh = useServerFn(refreshExchangeRates);
  const saveRate = useServerFn(setManualRate);
  const { data: raw } = useQuery({
    queryKey: ["currency-admin", propertyId],
    queryFn: () => load({ data: { propertyId: propertyId! } }),
    enabled: Boolean(propertyId),
  });
  const data = raw && !("error" in raw) ? (raw as CurrencyAdminData) : null;
  const [form, setForm] = useState<CurrencyAdminData["settings"] | null>(null);
  const [manual, setManual] = useState<{ from: Currency; to: Currency; rate: string }>({
    from: "EUR",
    to: "EGP",
    rate: "",
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setForm(data.settings);
  }, [raw]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!propertyId || !form) return null;
  const input =
    "w-full rounded-xl border border-forest/15 bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none";
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale, { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso),
    );
  const sel = (key: keyof typeof form, options: readonly string[], label: string) => (
    <label className="space-y-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <select
        className={input}
        value={String(form[key])}
        onChange={(e) => setForm({ ...form, [key]: e.target.value } as typeof form)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {t(`currency.opt.${o}`, o)}
          </option>
        ))}
      </select>
    </label>
  );

  const onSave = async () => {
    setBusy(true);
    const res = await save({
      data: { propertyId, ...form, rounding_rule: form.rounding_rule as "half_up" },
    });
    setBusy(false);
    if ("error" in res) toast.error(t("currency.error"));
    else {
      toast.success(t("currency.saved"));
      qc.invalidateQueries({ queryKey: ["currency-admin"] });
    }
  };

  return (
    <section className="rounded-3xl border border-forest/10 bg-card p-5 sm:p-6 space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.35em] text-gold">{t("currency.eyebrow")}</p>
        <h2 className="font-display text-xl text-forest">{t("currency.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("currency.hint")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {sel("base_currency", CURRENCIES, t("currency.base"))}
        {sel("owner_statement_currency", CURRENCIES, t("currency.statement"))}
        {sel("payout_currency", CURRENCIES, t("currency.payout"))}
        {sel("rate_mode", ["auto", "manual"], t("currency.mode"))}
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>{t("currency.markup")}</span>
          <input
            type="number"
            min={0}
            max={20}
            step={0.1}
            className={input}
            value={form.markup_percent}
            onChange={(e) => setForm({ ...form, markup_percent: Number(e.target.value) || 0 })}
          />
        </label>
        {sel("rounding_rule", ["half_up", "down", "up", "whole_unit"], t("currency.rounding"))}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onSave}
        className="rounded-full bg-gold px-5 py-2 text-xs uppercase tracking-widest text-forest disabled:opacity-50"
      >
        {t("currency.save")}
      </button>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg text-forest">{t("currency.rates")}</h3>
          <button
            type="button"
            disabled={busy}
            className="rounded-full border border-forest/20 px-4 py-1.5 text-xs uppercase tracking-widest text-forest hover:border-gold"
            onClick={async () => {
              setBusy(true);
              const r = await refresh();
              setBusy(false);
              if (r.ok) toast.success(t("currency.refreshed"));
              else toast.error(t("currency.providerDown"));
              qc.invalidateQueries({ queryKey: ["currency-admin"] });
            }}
          >
            {t("currency.refresh")}
          </button>
        </div>
        {data!.rates.length === 0 && <p className="text-sm text-destructive">{t("currency.noRate")}</p>}
        <ul className="grid gap-2 sm:grid-cols-2 text-sm">
          {data!.rates.map((r) => (
            <li key={`${r.from}${r.to}`} className="rounded-xl border border-forest/10 p-3">
              <span className="font-medium text-forest">
                1 {r.from} = {r.rate.toLocaleString(intlLocale, { maximumFractionDigits: 4 })} {r.to}
              </span>
              <span className="block text-xs text-muted-foreground">
                {r.source} · {fmtTime(r.fetched_at)}
              </span>
              {r.stale && (
                <span className="block text-xs text-destructive">
                  {t("currency.stale", { time: fmtTime(r.fetched_at) })}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {form.rate_mode === "manual" && (
        <div className="grid gap-3 sm:grid-cols-4 items-end">
          <select
            className={input}
            value={manual.from}
            onChange={(e) => setManual({ ...manual, from: e.target.value as Currency })}
          >
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select
            className={input}
            value={manual.to}
            onChange={(e) => setManual({ ...manual, to: e.target.value as Currency })}
          >
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input
            type="number"
            step="0.0001"
            min="0"
            placeholder={t("currency.rate")}
            className={input}
            value={manual.rate}
            onChange={(e) => setManual({ ...manual, rate: e.target.value })}
          />
          <button
            type="button"
            className="rounded-full bg-forest px-4 py-2 text-xs uppercase tracking-widest text-primary-foreground"
            onClick={async () => {
              const rate = Number(manual.rate);
              if (!(rate > 0) || manual.from === manual.to) {
                toast.error(t("currency.invalidRate"));
                return;
              }
              const r = await saveRate({ data: { propertyId, from: manual.from, to: manual.to, rate } });
              if ("error" in r) toast.error(t("currency.error"));
              else {
                toast.success(t("currency.saved"));
                qc.invalidateQueries({ queryKey: ["currency-admin"] });
              }
            }}
          >
            {t("currency.saveRate")}
          </button>
        </div>
      )}
    </section>
  );
}
