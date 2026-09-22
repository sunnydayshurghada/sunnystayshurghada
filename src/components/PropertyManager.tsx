import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Plus, X } from "lucide-react";
import {
  listProperties,
  saveProperty,
  setPropertyStatus,
  type PropertySummary,
} from "@/lib/properties.functions";

const STATUSES = ["draft", "active", "inactive"] as const;

/** Host view: create, edit and deactivate apartments. */
export function PropertyManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const load = useServerFn(listProperties);
  const save = useServerFn(saveProperty);
  const setStatus = useServerFn(setPropertyStatus);
  const [editing, setEditing] = useState<PropertySummary | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: properties = [] } = useQuery({
    queryKey: ["admin-properties"],
    queryFn: () => load(),
    refetchOnMount: "always",
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-properties"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-data"] });
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string, fallback = 0) => {
      const raw = String(fd.get(k) ?? "").trim();
      return raw ? Number(raw) : fallback;
    };
    setBusy(true);
    const res = await save({
      data: {
        ...(editing && editing !== "new" ? { id: editing.id } : {}),
        internal_name: String(fd.get("internal_name") ?? ""),
        public_name: String(fd.get("public_name") ?? ""),
        slug: String(fd.get("slug") ?? "")
          .trim()
          .toLowerCase(),
        status: String(fd.get("status") ?? "draft") as (typeof STATUSES)[number],
        short_description: String(fd.get("short_description") ?? ""),
        full_description: String(fd.get("full_description") ?? ""),
        translations: {
          de: {
            public_name: String(fd.get("name_de") ?? ""),
            short_description: String(fd.get("short_de") ?? ""),
            full_description: String(fd.get("full_de") ?? ""),
          },
          en: {
            public_name: String(fd.get("name_en") ?? ""),
            short_description: String(fd.get("short_en") ?? ""),
            full_description: String(fd.get("full_en") ?? ""),
          },
          ar: {
            public_name: String(fd.get("name_ar") ?? ""),
            short_description: String(fd.get("short_ar") ?? ""),
            full_description: String(fd.get("full_ar") ?? ""),
          },
        },
        address: String(fd.get("address") ?? ""),
        area: String(fd.get("area") ?? ""),
        maximum_guests: num("maximum_guests", 2),
        bedrooms: num("bedrooms", 1),
        beds: num("beds", 1),
        bathrooms: num("bathrooms", 1),
        check_in_time: String(fd.get("check_in_time") || "14:00"),
        check_out_time: String(fd.get("check_out_time") || "11:00"),
        minimum_nights: num("minimum_nights", 1),
        maximum_nights: num("maximum_nights", 60),
        base_price: num("base_price"),
        min_price: num("min_price"),
        max_price: num("max_price"),
        cleaning_fee: num("cleaning_fee"),
        currency: String(fd.get("currency") || "EUR").toUpperCase(),
        direct_booking_enabled: fd.get("direct_booking_enabled") === "on",
        instant_booking_enabled: fd.get("instant_booking_enabled") === "on",
        sort_order: num("sort_order"),
      },
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t(`admin.properties.errors.${res.error ?? "generic"}`, t("admin.errors.generic")));
      return;
    }
    toast.success(t("admin.properties.toast.saved"));
    setEditing(null);
    await refresh();
  };

  const toggle = async (p: PropertySummary) => {
    setBusy(true);
    const res = await setStatus({
      data: { id: p.id, status: p.status === "active" ? "inactive" : "active" },
    });
    setBusy(false);
    if (!res.ok) toast.error(t("admin.errors.generic"));
    else toast.success(t("admin.properties.toast.saved"));
    await refresh();
  };

  const current = editing && editing !== "new" ? editing : null;
  const tr = (lang: string, key: string) => current?.translations?.[lang]?.[key] ?? "";

  return (
    <section>
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="font-display text-2xl">{t("admin.properties.title")}</h2>
        <button
          onClick={() => setEditing(editing === "new" ? null : "new")}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-forest/60 hover:text-gold"
        >
          {editing === "new" ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {editing === "new" ? t("admin.properties.cancel") : t("admin.properties.new")}
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {properties.map((p) => (
          <div
            key={p.id}
            className="bg-card rounded-2xl border border-forest/10 p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="text-sm">
              <span className="font-medium">{p.internal_name}</span>
              <span className="ms-3 text-[10px] uppercase tracking-widest text-gold">
                {t(`admin.properties.status.${p.status}`, p.status)}
              </span>
              <div className="text-xs text-forest/55 mt-1 font-mono">/apartments/{p.slug}</div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setEditing(p)}
                className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-forest/50 hover:text-gold"
              >
                <Pencil className="h-3.5 w-3.5" /> {t("admin.properties.edit")}
              </button>
              <button
                onClick={() => toggle(p)}
                disabled={busy}
                className="text-[11px] uppercase tracking-widest text-forest/50 hover:text-gold"
              >
                {p.status === "active"
                  ? t("admin.properties.deactivate")
                  : t("admin.properties.activate")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <form
          onSubmit={onSubmit}
          key={current?.id ?? "new"}
          className="bg-card rounded-3xl border border-forest/10 p-6 space-y-3"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <F label={t("admin.properties.internal_name")} name="internal_name" required defaultValue={current?.internal_name} />
            <F label={t("admin.properties.public_name")} name="public_name" required defaultValue={current?.public_name} />
            <F label={t("admin.properties.slug")} name="slug" required defaultValue={current?.slug} />
            <label className="block">
              <Lbl>{t("admin.properties.status_label")}</Lbl>
              <select
                name="status"
                defaultValue={current?.status ?? "draft"}
                className="w-full bg-card p-3 border border-forest/10 rounded-xl text-sm focus:outline-none focus:border-gold"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`admin.properties.status.${s}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <F label={t("admin.properties.short_description")} name="short_description" defaultValue={current?.short_description ?? ""} />
          <F label={t("admin.properties.full_description")} name="full_description" defaultValue={current?.full_description ?? ""} />

          <div className="grid gap-3 md:grid-cols-3 border-t border-forest/10 pt-4">
            <F label="DE — Name" name="name_de" defaultValue={tr("de", "public_name")} />
            <F label="EN — Name" name="name_en" defaultValue={tr("en", "public_name")} />
            <F label="AR — Name" name="name_ar" defaultValue={tr("ar", "public_name")} />
            <F label="DE — Kurztext" name="short_de" defaultValue={tr("de", "short_description")} />
            <F label="EN — Short text" name="short_en" defaultValue={tr("en", "short_description")} />
            <F label="AR — نص قصير" name="short_ar" defaultValue={tr("ar", "short_description")} />
            <F label="DE — Beschreibung" name="full_de" defaultValue={tr("de", "full_description")} />
            <F label="EN — Description" name="full_en" defaultValue={tr("en", "full_description")} />
            <F label="AR — الوصف" name="full_ar" defaultValue={tr("ar", "full_description")} />
          </div>

          <div className="grid gap-3 md:grid-cols-3 border-t border-forest/10 pt-4">
            <F label={t("admin.properties.address")} name="address" defaultValue={current?.address ?? ""} />
            <F label={t("admin.properties.area")} name="area" defaultValue={current?.area ?? ""} />
            <F label={t("admin.properties.max_guests")} name="maximum_guests" type="number" defaultValue={String(current?.maximum_guests ?? 2)} />
            <F label={t("admin.properties.bedrooms")} name="bedrooms" type="number" defaultValue={String(current?.bedrooms ?? 1)} />
            <F label={t("admin.properties.beds")} name="beds" type="number" defaultValue={String(current?.beds ?? 1)} />
            <F label={t("admin.properties.bathrooms")} name="bathrooms" type="number" defaultValue={String(current?.bathrooms ?? 1)} />
            <F label={t("admin.properties.check_in_time")} name="check_in_time" defaultValue={(current?.check_in_time ?? "14:00").slice(0, 5)} />
            <F label={t("admin.properties.check_out_time")} name="check_out_time" defaultValue={(current?.check_out_time ?? "11:00").slice(0, 5)} />
            <F label={t("admin.properties.min_nights")} name="minimum_nights" type="number" defaultValue={String(current?.minimum_nights ?? 1)} />
            <F label={t("admin.properties.max_nights")} name="maximum_nights" type="number" defaultValue={String(current?.maximum_nights ?? 60)} />
          </div>

          <div className="grid gap-3 md:grid-cols-3 border-t border-forest/10 pt-4">
            <F label={t("admin.properties.base_price")} name="base_price" type="number" defaultValue={String(current?.base_price ?? 0)} />
            <F label={t("admin.properties.min_price")} name="min_price" type="number" defaultValue={String(current?.min_price ?? 0)} />
            <F label={t("admin.properties.max_price")} name="max_price" type="number" defaultValue={String(current?.max_price ?? 0)} />
            <F label={t("admin.properties.cleaning_fee")} name="cleaning_fee" type="number" defaultValue={String(current?.cleaning_fee ?? 0)} />
            <F label={t("admin.properties.currency")} name="currency" defaultValue={current?.currency ?? "EUR"} />
            <F label={t("admin.properties.sort_order")} name="sort_order" type="number" defaultValue={String(current?.sort_order ?? 0)} />
          </div>
          <p className="text-[11px] text-forest/55">{t("admin.properties.price_hint")}</p>

          <div className="flex flex-wrap gap-6 pt-2">
            <Check name="direct_booking_enabled" label={t("admin.properties.direct_booking")} defaultChecked={current?.direct_booking_enabled ?? true} />
            <Check name="instant_booking_enabled" label={t("admin.properties.instant_booking")} defaultChecked={current?.instant_booking_enabled ?? false} />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-forest text-sand py-4 rounded-xl text-xs uppercase tracking-[0.25em] font-bold hover:bg-gold hover:text-forest transition-colors disabled:opacity-60"
          >
            {t("admin.properties.save")}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">
      {children}
    </span>
  );
}

function F({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <Lbl>{label}</Lbl>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="w-full bg-card p-3 border border-forest/10 rounded-xl text-sm focus:outline-none focus:border-gold"
      />
    </label>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="accent-gold" />
      {label}
    </label>
  );
}
