import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { z } from "zod";
import { createBookingRequest } from "@/lib/booking.functions";
import { getBlockedRanges } from "@/lib/availability.functions";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { toISODate, nightsBetween, rangeIsFree } from "@/lib/availability";
import { AIRBNB_LISTING_URL } from "@/lib/airbnb";

const schema = z.object({
  guest_name: z.string().trim().min(2).max(120),
  guest_email: z.string().trim().email().max(255),
  guest_phone: z.string().trim().max(40).optional().or(z.literal("")),
  guests: z.coerce.number().int().min(1).max(6),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

export function BookingWidget() {
  const { t, i18n } = useTranslation();
  const [pending, setPending] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const submitBooking = useServerFn(createBookingRequest);
  const loadRanges = useServerFn(getBlockedRanges);
  const queryClient = useQueryClient();

  const { data: blocked = [] } = useQuery({
    queryKey: ["blocked-ranges"],
    queryFn: () => loadRanges(),
    staleTime: 60_000,
  });

  const checkin = range?.from;
  const checkout = range?.to;
  const nights = checkin && checkout ? nightsBetween(checkin, checkout) : 0;

  const dateLabel = (d: Date | undefined) =>
    d ? d.toLocaleDateString(i18n.language, { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    if (!checkin || !checkout || nights < 1) {
      toast.error(t("booking.errors.invalid_range"));
      return;
    }
    if (!rangeIsFree(checkin, checkout, blocked)) {
      toast.error(t("booking.errors.dates_unavailable"));
      return;
    }

    const parsed = schema.safeParse({
      guest_name: fd.get("guest_name"),
      guest_email: fd.get("guest_email"),
      guest_phone: fd.get("guest_phone") || "",
      guests: fd.get("guests"),
      message: fd.get("message") || "",
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(
        t(`booking.errors.${first.message}` as const, { defaultValue: t("booking.errors.generic") }),
      );
      return;
    }

    setPending(true);
    let result;
    try {
      result = await submitBooking({
        data: {
          guest_name: parsed.data.guest_name,
          guest_email: parsed.data.guest_email,
          guest_phone: parsed.data.guest_phone || "",
          checkin: toISODate(checkin),
          checkout: toISODate(checkout),
          guests: parsed.data.guests,
          message: parsed.data.message || "",
        },
      });
    } catch {
      setPending(false);
      toast.error(t("booking.errors.generic"));
      return;
    }
    setPending(false);

    if (!result.ok) {
      toast.error(t(`booking.errors.${result.error}`, { defaultValue: t("booking.errors.generic") }));
      void queryClient.invalidateQueries({ queryKey: ["blocked-ranges"] });
      return;
    }
    toast.success(t("booking.submitted_title"), { description: t("booking.submitted_desc") });
    form.reset();
    setRange(undefined);
  };

  return (
    <div className="bg-card text-forest p-6 sm:p-8 md:p-10 rounded-2xl shadow-[0_10px_30px_-12px_rgb(23_59_99_/_0.15)] border border-forest/5">
      <div className="mb-8">
        <span className="block text-[10px] uppercase tracking-[0.3em] text-gold font-medium mb-2">
          {t("pricing.eyebrow", { defaultValue: "Availability" })}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-display italic text-forest/90">
            {t("pricing.starting_from", { defaultValue: "Starting from …" })}
          </span>
        </div>
        <p className="text-xs text-forest/60 mt-2 leading-relaxed">
          {t("pricing.note", {
            defaultValue: "Current prices available on Airbnb — rates vary by season.",
          })}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <AvailabilityCalendar ranges={blocked} selected={range} onSelect={setRange} />

        <div className="grid grid-cols-2 gap-px bg-forest/10 border border-forest/10">
          <div className="bg-card p-4">
            <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">
              {t("booking.checkin")}
            </span>
            <span className="text-sm font-medium">{dateLabel(checkin)}</span>
          </div>
          <div className="bg-card p-4">
            <span className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">
              {t("booking.checkout")}
            </span>
            <span className="text-sm font-medium">{dateLabel(checkout)}</span>
          </div>
        </div>
        {nights > 0 && (
          <p className="text-[11px] text-forest/55 text-center">
            {t("calendar.nights", { count: nights })}
          </p>
        )}

        <div className="bg-card p-4 border border-forest/10">
          <label className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">
            {t("booking.guests")}
          </label>
          <select
            name="guests"
            defaultValue="2"
            className="w-full text-sm font-medium focus:outline-none bg-transparent"
          >
            <option value="2">{t("booking.guests_options.two")}</option>
            <option value="4">{t("booking.guests_options.four")}</option>
            <option value="6">{t("booking.guests_options.family")}</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <input
            name="guest_name"
            required
            maxLength={120}
            placeholder={t("booking.name")}
            className="bg-card p-4 border border-forest/10 text-sm font-medium focus:outline-none focus:border-gold"
          />
          <input
            name="guest_email"
            type="email"
            required
            maxLength={255}
            placeholder={t("booking.email")}
            className="bg-card p-4 border border-forest/10 text-sm font-medium focus:outline-none focus:border-gold"
          />
          <input
            name="guest_phone"
            type="tel"
            maxLength={40}
            placeholder={t("booking.phone")}
            className="bg-card p-4 border border-forest/10 text-sm font-medium focus:outline-none focus:border-gold"
          />
          <textarea
            name="message"
            rows={2}
            maxLength={1000}
            placeholder={t("booking.message")}
            className="bg-card p-4 border border-forest/10 text-sm font-medium focus:outline-none focus:border-gold resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-forest text-sand py-5 text-sm uppercase tracking-[0.2em] font-bold hover:bg-gold hover:text-forest transition-colors mt-2 disabled:opacity-60"
        >
          {pending ? t("booking.sending") : t("booking.cta")}
        </button>
      </form>

      <p className="text-[10px] text-center text-forest/40 mt-6 uppercase tracking-widest">
        {t("calendar.request_hint")}
      </p>
      <p className="text-[10px] text-center text-forest/40 mt-2 uppercase tracking-widest">
        {t("booking.no_charge")}
      </p>

      <a
        href={AIRBNB_LISTING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest text-forest/70 hover:text-gold transition-colors border-t border-forest/10 pt-4"
      >
        <span className="text-[#FF385C] text-base leading-none">◈</span>
        {t("booking.airbnb_trust")}
      </a>
    </div>
  );
}
