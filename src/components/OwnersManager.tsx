import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listOwners,
  inviteOwner,
  setOwnerActive,
  saveAssignment,
  removeAssignment,
  type OwnerAccount,
} from "@/lib/owners.admin.functions";

type Data = {
  owners: OwnerAccount[];
  properties: { id: string; name: string }[];
  audit: {
    id: string;
    created_at: string;
    actor_email: string | null;
    action: string;
    target: string | null;
  }[];
};

const PERMS = [
  "can_view_bookings",
  "can_view_calendar",
  "can_view_guest_contact_data",
  "can_view_financials",
  "can_view_payments",
  "can_create_calendar_blocks",
  "can_manage_prices",
  "can_receive_notifications",
] as const;

const DEFAULT_PERMS = {
  can_view_bookings: true,
  can_view_calendar: true,
  can_view_guest_contact_data: false,
  can_view_financials: false,
  can_view_payments: false,
  can_create_calendar_blocks: false,
  can_manage_prices: false,
  can_receive_notifications: true,
};

export function OwnersManager() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const load = useServerFn(listOwners);
  const invite = useServerFn(inviteOwner);
  const toggleActive = useServerFn(setOwnerActive);
  const save = useServerFn(saveAssignment);
  const remove = useServerFn(removeAssignment);

  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    preferred_language: "de" as "de" | "en" | "ar",
    role: "owner" as "owner" | "booking_manager",
  });
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [assignProperty, setAssignProperty] = useState("");

  const { data: raw } = useQuery({
    queryKey: ["admin-owners"],
    queryFn: () => load({ data: undefined as never }),
  });
  const data = raw && !("error" in raw) ? (raw as unknown as Data) : null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-owners"] });

  const card = "rounded-3xl border border-forest/10 bg-card p-5";
  const input =
    "rounded-xl border border-forest/15 bg-card px-3 py-2 text-sm focus:border-gold focus:outline-none";
  const btn =
    "rounded-full border border-forest/20 px-4 py-1.5 text-xs uppercase tracking-widest text-forest hover:border-gold hover:text-gold";

  if (!data) return null;

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl text-forest">{t("owners.title")}</h2>

      <div className={`${card} space-y-3`}>
        <h3 className="text-sm font-semibold text-forest">{t("owners.invite")}</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className={input}
            placeholder={t("owners.email")}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className={input}
            placeholder={t("owners.first_name")}
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          />
          <input
            className={input}
            placeholder={t("owners.last_name")}
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          />
          <input
            className={input}
            placeholder={t("owners.phone")}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <select
            className={input}
            value={form.preferred_language}
            onChange={(e) =>
              setForm({ ...form, preferred_language: e.target.value as "de" | "en" | "ar" })
            }
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
          <select
            className={input}
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as "owner" | "booking_manager" })
            }
          >
            <option value="owner">{t("owners.roles.owner")}</option>
            <option value="booking_manager">{t("owners.roles.booking_manager")}</option>
          </select>
        </div>
        <button
          type="button"
          disabled={busy || !form.email}
          className="rounded-full bg-forest px-4 py-2 text-xs uppercase tracking-widest text-sand hover:bg-gold hover:text-forest"
          onClick={async () => {
            setBusy(true);
            const res = await invite({ data: form });
            setBusy(false);
            if (res && "error" in res)
              toast.error(t(`owners.errors.${res.error}`, { defaultValue: t("owners.errors.generic") }));
            else {
              toast.success(t("owners.toast.invited"));
              setForm({ ...form, email: "", first_name: "", last_name: "", phone: "" });
              refresh();
            }
          }}
        >
          {t("owners.send_invite")}
        </button>
      </div>

      {data.owners.map((o) => (
        <div key={o.user_id} className={`${card} space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-forest">
                {o.first_name} {o.last_name} · {o.email}
              </p>
              <p className="text-xs text-forest/60">
                {t(`owners.roles.${o.role}`, { defaultValue: o.role })} ·{" "}
                {o.active ? t("owners.active") : t("owners.inactive")} · {t("owners.last_login")}:{" "}
                {o.last_login_at ? o.last_login_at.slice(0, 16).replace("T", " ") : "—"}
                {o.invitation_expires_at && !o.invitation_accepted_at
                  ? ` · ${t("owners.invite_expires")}: ${o.invitation_expires_at.slice(0, 10)}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btn}
                onClick={async () => {
                  const res = await invite({
                    data: {
                      email: o.email,
                      first_name: o.first_name,
                      last_name: o.last_name,
                      phone: o.phone ?? "",
                      preferred_language: (["de", "en", "ar"].includes(o.preferred_language)
                        ? o.preferred_language
                        : "de") as "de" | "en" | "ar",
                      role: (o.role === "booking_manager" ? "booking_manager" : "owner") as
                        | "owner"
                        | "booking_manager",
                    },
                  });
                  if (res && "error" in res) toast.error(t("owners.errors.generic"));
                  else {
                    toast.success(t("owners.toast.invited"));
                    refresh();
                  }
                }}
              >
                {t("owners.resend_invite")}
              </button>
              {o.role !== "super_admin" ? (
                <button
                  type="button"
                  className={btn}
                  onClick={async () => {
                    const res = await toggleActive({
                      data: { userId: o.user_id, active: !o.active },
                    });
                    if (res && "error" in res) toast.error(t("owners.errors.generic"));
                    else refresh();
                  }}
                >
                  {o.active ? t("owners.deactivate") : t("owners.activate")}
                </button>
              ) : null}
            </div>
          </div>

          {o.assignments.map((a) => (
            <div key={a.id} className="rounded-2xl border border-forest/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-forest">{a.property_name}</p>
                <button
                  type="button"
                  className={btn}
                  onClick={async () => {
                    const res = await remove({ data: { id: a.id } });
                    if (res && "error" in res) toast.error(t("owners.errors.generic"));
                    else {
                      toast.success(t("owners.toast.removed"));
                      refresh();
                    }
                  }}
                >
                  {t("owners.remove")}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                {PERMS.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-xs text-forest/70">
                    <input
                      type="checkbox"
                      checked={Boolean(a[p])}
                      onChange={async (e) => {
                        const res = await save({
                          data: {
                            id: a.id,
                            user_id: o.user_id,
                            property_id: a.property_id,
                            assignment_role: a.assignment_role as "owner" | "co_owner" | "manager",
                            ownership_share_percent: a.ownership_share_percent,
                            can_view_bookings: a.can_view_bookings,
                            can_view_guest_contact_data: a.can_view_guest_contact_data,
                            can_view_financials: a.can_view_financials,
                            can_view_payments: a.can_view_payments,
                            can_view_calendar: a.can_view_calendar,
                            can_create_calendar_blocks: a.can_create_calendar_blocks,
                            can_manage_prices: a.can_manage_prices,
                            can_receive_notifications: a.can_receive_notifications,
                            active: a.active,
                            [p]: e.target.checked,
                          },
                        });
                        if (res && "error" in res) toast.error(t("owners.errors.generic"));
                        else refresh();
                      }}
                    />
                    {t(`owners.perms.${p}`)}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <select
              className={input}
              value={assignFor === o.user_id ? assignProperty : ""}
              onChange={(e) => {
                setAssignFor(o.user_id);
                setAssignProperty(e.target.value);
              }}
            >
              <option value="">{t("owners.assign_property")}</option>
              {data.properties
                .filter((p) => !o.assignments.some((a) => a.property_id === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className={btn}
              disabled={assignFor !== o.user_id || !assignProperty}
              onClick={async () => {
                const res = await save({
                  data: {
                    id: null,
                    user_id: o.user_id,
                    property_id: assignProperty,
                    assignment_role: "owner",
                    ownership_share_percent: null,
                    active: true,
                    ...DEFAULT_PERMS,
                  },
                });
                if (res && "error" in res) toast.error(t("owners.errors.generic"));
                else {
                  toast.success(t("owners.toast.assigned"));
                  setAssignProperty("");
                  refresh();
                }
              }}
            >
              {t("owners.assign")}
            </button>
          </div>
        </div>
      ))}

      <div className={card}>
        <h3 className="text-sm font-semibold text-forest">{t("owners.audit")}</h3>
        <div className="mt-2 space-y-1 text-xs text-forest/70">
          {data.audit.length === 0 ? (
            <p>{t("owners.audit_empty")}</p>
          ) : (
            data.audit.map((a) => (
              <p key={a.id}>
                {a.created_at.slice(0, 16).replace("T", " ")} · {a.actor_email ?? "—"} ·{" "}
                {t(`owners.actions.${a.action}`, { defaultValue: a.action })}
                {a.target ? ` · ${a.target}` : ""}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
