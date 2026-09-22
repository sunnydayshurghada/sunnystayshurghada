import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, Copy, KeyRound, Link2 } from "lucide-react";
import {
  getIcalStatus,
  setAirbnbIcalUrl,
  rotateExportToken,
  syncAirbnbNow,
} from "@/lib/ical.functions";

export function AirbnbSyncPanel({
  intlLocale,
  propertyId,
}: {
  intlLocale: string;
  propertyId?: string | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const loadStatus = useServerFn(getIcalStatus);
  const saveUrl = useServerFn(setAirbnbIcalUrl);
  const rotate = useServerFn(rotateExportToken);
  const syncNow = useServerFn(syncAirbnbNow);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["ical-status"],
    queryFn: () => loadStatus(),
    refetchOnMount: "always",
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["ical-status"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-data"] });
  };

  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(intlLocale, { dateStyle: "short", timeStyle: "short" }) : "—";

  const exportUrl =
    data?.exportToken && typeof window !== "undefined"
      ? `${window.location.origin}/api/public/calendar/${data.exportToken}.ics`
      : "";

  const onSaveUrl = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const res = await saveUrl({ data: { url: String(fd.get("url") ?? "") } });
    setBusy(false);
    if (!res.ok) {
      toast.error(t(`admin.sync.errors.${res.error ?? "generic"}`, t("admin.errors.generic")));
      return;
    }
    toast.success(t("admin.sync.toast.url_saved"));
    e.currentTarget.reset();
    await refresh();
  };

  const onSync = async () => {
    setBusy(true);
    const res = await syncNow();
    setBusy(false);
    if (!res.ok) {
      toast.error(t(`admin.sync.errors.${res.error ?? "generic"}`, t("admin.errors.generic")));
    } else {
      toast.success(t("admin.sync.toast.synced", { count: res.imported ?? 0 }));
    }
    await refresh();
  };

  const onRotate = async () => {
    setBusy(true);
    const res = await rotate();
    setBusy(false);
    if (!res.ok) toast.error(t("admin.errors.generic"));
    else toast.success(t("admin.sync.toast.token_rotated"));
    await refresh();
  };

  const copy = async () => {
    if (!exportUrl) return;
    await navigator.clipboard.writeText(exportUrl);
    toast.success(t("admin.sync.toast.copied"));
  };

  const statusLabel = !data?.hasUrl
    ? t("admin.sync.status_not_connected")
    : data.lastSyncStatus === "ok"
      ? t("admin.sync.status_ok")
      : data.lastSyncStatus === "error"
        ? t("admin.sync.status_error")
        : t("admin.sync.status_waiting");

  const statusColor = !data?.hasUrl
    ? "bg-forest/20"
    : data.lastSyncStatus === "ok"
      ? "bg-emerald-500"
      : data.lastSyncStatus === "error"
        ? "bg-red-500"
        : "bg-gold";

  return (
    <section>
      <h2 className="font-display text-2xl mb-4">{t("admin.sync.title")}</h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-card rounded-3xl border border-forest/10 p-6 space-y-4">
          <h3 className="font-display text-lg">{t("admin.sync.import_title")}</h3>
          <p className="text-xs text-forest/60 leading-relaxed">{t("admin.sync.import_hint")}</p>

          <form onSubmit={onSaveUrl} className="space-y-3">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">
                {t("admin.sync.url_label")}
              </span>
              <input
                name="url"
                type="url"
                placeholder="https://www.airbnb.com/calendar/ical/…"
                className="w-full bg-card p-3 border border-forest/10 rounded-xl text-sm focus:outline-none focus:border-gold"
              />
            </label>
            {data?.hasUrl ? (
              <p className="text-[11px] text-forest/55 flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> {t("admin.sync.url_saved_hint")}{" "}
                <span className="font-mono">{data.urlHint}</span>
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-forest text-sand py-3.5 rounded-xl text-xs uppercase tracking-[0.25em] font-bold hover:bg-gold hover:text-forest transition-colors disabled:opacity-60"
            >
              {t("admin.sync.save_url")}
            </button>
          </form>

          <div className="border-t border-forest/10 pt-4 space-y-2 text-sm">
            <Row label={t("admin.sync.connection")}>
              <span className="inline-flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
                {statusLabel}
              </span>
            </Row>
            <Row label={t("admin.sync.last_sync")}>{when(data?.lastSyncAt ?? null)}</Row>
            <Row label={t("admin.sync.next_sync")}>{when(data?.nextSyncAt ?? null)}</Row>
            <Row label={t("admin.sync.imported_count")}>{data?.importedCount ?? 0}</Row>
            {data?.lastSyncStatus === "error" ? (
              <p className="text-xs text-red-600">
                {t(`admin.sync.errors.${data.lastSyncError ?? "generic"}`, t("admin.errors.generic"))}
              </p>
            ) : null}
          </div>

          <button
            onClick={onSync}
            disabled={busy}
            className="w-full border border-forest/15 py-3.5 rounded-xl text-xs uppercase tracking-[0.25em] font-bold hover:border-gold hover:text-gold transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            {t("admin.sync.sync_now")}
          </button>
        </div>

        <div className="bg-card rounded-3xl border border-forest/10 p-6 space-y-4">
          <h3 className="font-display text-lg">{t("admin.sync.export_title")}</h3>
          <p className="text-xs text-forest/60 leading-relaxed">{t("admin.sync.export_hint")}</p>

          <div className="flex gap-2">
            <input
              readOnly
              value={exportUrl}
              className="flex-1 bg-sand/60 p-3 border border-forest/10 rounded-xl text-xs font-mono"
            />
            <button
              onClick={copy}
              className="px-4 rounded-xl border border-forest/15 hover:border-gold hover:text-gold transition-colors"
              aria-label={t("admin.sync.copy")}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={onRotate}
            disabled={busy}
            className="w-full border border-forest/15 py-3.5 rounded-xl text-xs uppercase tracking-[0.25em] font-bold hover:border-gold hover:text-gold transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            <KeyRound className="h-3.5 w-3.5" /> {t("admin.sync.rotate_token")}
          </button>

          <div className="border-t border-forest/10 pt-4">
            <h4 className="text-[10px] uppercase tracking-widest text-forest/50 mb-2">
              {t("admin.sync.log_title")}
            </h4>
            {(data?.log?.length ?? 0) === 0 ? (
              <p className="text-xs text-forest/55">{t("admin.sync.log_empty")}</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-forest/70">
                {data!.log.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3">
                    <span>{when(l.ran_at)}</span>
                    <span className={l.status === "ok" ? "text-emerald-700" : "text-red-600"}>
                      {l.status === "ok"
                        ? t("admin.sync.log_ok", { imported: l.imported, removed: l.removed })
                        : t(`admin.sync.errors.${l.message ?? "generic"}`, t("admin.errors.generic"))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] uppercase tracking-widest text-forest/50">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}
