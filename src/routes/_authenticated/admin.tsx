import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DayPicker } from "react-day-picker";
import { de } from "react-day-picker/locale";
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

const ERRORS: Record<string, string> = {
  dates_unavailable: "Dieser Zeitraum ist inzwischen belegt — Bestätigung nicht möglich.",
  not_pending: "Diese Anfrage wurde bereits bearbeitet.",
  not_found: "Eintrag nicht gefunden.",
  forbidden: "Keine Berechtigung.",
  invalid_range: "Das Abreisedatum muss nach dem Anreisedatum liegen.",
  generic: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
};

const SOURCES: Record<string, string> = {
  direct: "Direkt",
  airbnb: "Airbnb",
  booking_com: "Booking.com",
  other: "Andere",
};

function days(start: string, end: string): Date[] {
  const out: Date[] = [];
  const s = parseISODate(start);
  const e = parseISODate(end);
  for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) out.push(new Date(d));
  return out;
}

function fmt(d: string): string {
  return parseISODate(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const load = useServerFn(listAdminData);
  const session = useServerFn(getAdminSession);
  const doConfirm = useServerFn(confirmBooking);
  const doStatus = useServerFn(setBookingStatus);
  const doCreate = useServerFn(createCalendarEntry);
  const doDelete = useServerFn(deleteCalendarEntry);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-data"],
    queryFn: async () => {
      await session();
      return load();
    },
  });

  const bookings = data?.bookings ?? [];
  const entries = data?.entries ?? [];
  const isAdmin = data?.isAdmin ?? false;

  const modifiers = useMemo(() => {
    const pending: Date[] = [];
    const confirmed: Date[] = [];
    const manual: Date[] = [];
    const blocked: Date[] = [];
    for (const b of bookings) {
      if (b.status === "pending") pending.push(...days(b.checkin, b.checkout));
      if (b.status === "confirmed") confirmed.push(...days(b.checkin, b.checkout));
    }
    for (const e of entries) {
      const list = e.entry_type === "booking" ? manual : blocked;
      list.push(...days(e.start_date, e.end_date));
    }
    return { pending, confirmed, manual, blocked };
  }, [bookings, entries]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-data"] });

  const handle = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) {
        toast.error(ERRORS[res.error ?? "generic"] ?? ERRORS["generic"]);
        return false;
      }
      toast.success(okMsg);
      await refresh();
      return true;
    } catch {
      toast.error(ERRORS["generic"]);
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
      entry_type === "booking" ? "Buchung eingetragen." : "Zeitraum blockiert.",
    );
    if (ok) form.reset();
  };

  const pendingRequests = bookings.filter((b) => b.status === "pending");
  const otherRequests = bookings.filter((b) => b.status !== "pending");

  if (isLoading) {
    return (
      <main className="min-h-screen bg-sand flex items-center justify-center text-forest/60 text-sm">
        Lade Kalender…
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-sand flex items-center justify-center px-6">
        <div className="bg-card rounded-3xl border border-forest/10 p-10 max-w-md text-center">
          <h1 className="font-display text-2xl text-forest mb-3">Kein Zugriff</h1>
          <p className="text-sm text-forest/70 mb-6">
            Dieses Konto ist nicht als Gastgeber freigeschaltet.
          </p>
          <button
            onClick={signOut}
            className="text-xs uppercase tracking-[0.25em] text-forest/60 hover:text-gold"
          >
            Abmelden
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sand text-forest">
      <header className="border-b border-forest/10 bg-paper">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <img src={brandLogo} alt="Sunny Stays Hurghada" className="h-12 w-auto" />
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-forest/60 hover:text-gold transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Abmelden
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
        <section>
          <span className="block text-[10px] uppercase tracking-[0.35em] text-gold font-medium mb-2">
            Übersicht
          </span>
          <h1 className="font-display text-3xl mb-6">Buchungskalender</h1>

          <div className="bg-card rounded-3xl border border-forest/10 p-4 md:p-6 inline-block max-w-full overflow-x-auto">
            <DayPicker
              locale={de}
              numberOfMonths={2}
              showOutsideDays={false}
              modifiers={modifiers}
              modifiersClassNames={{
                pending: "bg-gold/25 rounded-md",
                confirmed: "bg-forest text-paper rounded-md",
                manual: "bg-forest/70 text-paper rounded-md",
                blocked: "bg-forest/20 line-through rounded-md",
              }}
              className="[--rdp-day-height:2.3rem] [--rdp-day-width:2.3rem]"
            />
            <div className="mt-4 flex flex-wrap gap-4 text-[10px] uppercase tracking-widest text-forest/60">
              <Legend className="bg-gold/40" label="Anfrage (pending)" />
              <Legend className="bg-forest" label="Bestätigt" />
              <Legend className="bg-forest/70" label="Eigene Buchung" />
              <Legend className="bg-forest/20" label="Blockiert" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl mb-4">
            Offene Anfragen{" "}
            <span className="text-gold text-base align-middle">({pendingRequests.length})</span>
          </h2>
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-forest/60">Keine offenen Anfragen.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingRequests.map((b) => (
                <RequestCard
                  key={b.id}
                  booking={b}
                  busy={busy}
                  onConfirm={() =>
                    handle(() => doConfirm({ data: { id: b.id } }), "Buchung bestätigt.")
                  }
                  onReject={() =>
                    handle(
                      () => doStatus({ data: { id: b.id, status: "rejected" } }),
                      "Anfrage abgelehnt.",
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
            <h2 className="font-display text-xl mb-2">Eigene Buchung eintragen</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Anreise" name="start_date" type="date" required />
              <Field label="Abreise" name="end_date" type="date" required />
            </div>
            <Field label="Name des Gastes (optional)" name="guest_name" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Anzahl Gäste (optional)" name="guests" type="number" min={1} max={12} />
              <Field label="Telefon (optional)" name="guest_phone" />
            </div>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">
                Buchungsquelle
              </span>
              <select
                name="source"
                defaultValue="direct"
                className="w-full bg-card p-3 border border-forest/10 rounded-xl text-sm focus:outline-none focus:border-gold"
              >
                {Object.entries(SOURCES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Notiz" name="note" />
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-forest text-sand py-4 rounded-xl text-xs uppercase tracking-[0.25em] font-bold hover:bg-gold hover:text-forest transition-colors disabled:opacity-60"
            >
              Buchung eintragen
            </button>
          </form>

          <form
            onSubmit={(e) => onCreate(e, "block")}
            className="bg-card rounded-3xl border border-forest/10 p-6 space-y-3"
          >
            <h2 className="font-display text-xl mb-2">Zeitraum blockieren</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Von" name="start_date" type="date" required />
              <Field label="Bis" name="end_date" type="date" required />
            </div>
            <Field label="Grund / Notiz (nur intern)" name="note" />
            <p className="text-xs text-forest/55 leading-relaxed">
              Gäste sehen diese Tage nur als „Nicht verfügbar“ — der Grund bleibt intern.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-forest text-sand py-4 rounded-xl text-xs uppercase tracking-[0.25em] font-bold hover:bg-gold hover:text-forest transition-colors disabled:opacity-60"
            >
              Zeitraum blockieren
            </button>
          </form>
        </section>

        <section>
          <h2 className="font-display text-2xl mb-4">Eigene Einträge</h2>
          {entries.length === 0 ? (
            <p className="text-sm text-forest/60">Noch keine eigenen Buchungen oder Sperrzeiten.</p>
          ) : (
            <div className="space-y-3">
              {entries.map((e: CalendarEntry) => (
                <div
                  key={e.id}
                  className="bg-card rounded-2xl border border-forest/10 p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="text-sm">
                    <span className="font-medium">
                      {fmt(e.start_date)} – {fmt(e.end_date)}
                    </span>
                    <span className="ms-3 text-[10px] uppercase tracking-widest text-gold">
                      {e.entry_type === "booking"
                        ? `Buchung · ${SOURCES[e.source] ?? e.source}`
                        : "Blockiert"}
                    </span>
                    <div className="text-forest/60 text-xs mt-1">
                      {[e.guest_name, e.guests ? `${e.guests} Gäste` : null, e.guest_phone, e.note]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handle(() => doDelete({ data: { id: e.id } }), "Eintrag entfernt.")
                    }
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-forest/50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Entfernen
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-2xl mb-4">Bearbeitete Anfragen</h2>
          {otherRequests.length === 0 ? (
            <p className="text-sm text-forest/60">Noch keine.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {otherRequests.map((b) => (
                <div key={b.id} className="bg-card rounded-2xl border border-forest/10 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {fmt(b.checkin)} – {fmt(b.checkout)}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="text-forest/60 text-xs mt-1">
                    {b.guest_name} · {b.guests} Gäste · {b.guest_email}
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

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${className}`} />
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-gold/25 text-forest",
    confirmed: "bg-forest text-paper",
    rejected: "bg-forest/10 text-forest/60",
    cancelled: "bg-forest/10 text-forest/60",
  };
  const labels: Record<string, string> = {
    pending: "Offen",
    confirmed: "Bestätigt",
    rejected: "Abgelehnt",
    cancelled: "Storniert",
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest ${map[status] ?? ""}`}
    >
      {labels[status] ?? status}
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
  onConfirm,
  onReject,
}: {
  booking: AdminBooking;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <div className="bg-card rounded-3xl border border-forest/10 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg">{booking.guest_name}</h3>
          <p className="text-xs text-forest/60 mt-0.5">
            Eingegangen am {new Date(booking.created_at).toLocaleDateString("de-DE")}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Info label="Anreise" value={fmt(booking.checkin)} />
        <Info label="Abreise" value={fmt(booking.checkout)} />
        <Info label="Gäste" value={String(booking.guests)} />
        <Info label="Telefon" value={booking.guest_phone || "—"} />
        <Info label="E-Mail" value={booking.guest_email} wide />
        {booking.message ? <Info label="Nachricht" value={booking.message} wide /> : null}
      </dl>
      <div className="mt-5 flex gap-3">
        <button
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-forest text-sand py-3 rounded-xl text-[11px] uppercase tracking-[0.2em] font-bold hover:bg-gold hover:text-forest transition-colors disabled:opacity-60"
        >
          <Check className="h-3.5 w-3.5" /> Bestätigen
        </button>
        <button
          onClick={onReject}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-2 border border-forest/20 py-3 rounded-xl text-[11px] uppercase tracking-[0.2em] font-bold hover:border-red-500 hover:text-red-600 transition-colors disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" /> Ablehnen
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
