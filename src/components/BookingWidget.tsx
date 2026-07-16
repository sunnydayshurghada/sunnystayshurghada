import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  checkin: z.string().min(1),
  checkout: z.string().min(1),
  guests: z.string().min(1),
});

export function BookingWidget() {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      checkin: fd.get("checkin"),
      checkout: fd.get("checkout"),
      guests: fd.get("guests"),
    });
    if (!parsed.success) {
      toast.error(t("booking.cta"));
      return;
    }
    setPending(true);
    // TODO: wire to backend booking endpoint once Lovable Cloud is enabled.
    await new Promise((r) => setTimeout(r, 600));
    setPending(false);
    toast.success(t("booking.submitted_title"), {
      description: t("booking.submitted_desc"),
    });
    (e.target as HTMLFormElement).reset();
  };

  return (
    <div className="bg-card text-forest p-8 md:p-10 shadow-2xl">
      <div className="flex justify-between items-baseline mb-8">
        <span className="text-3xl font-display">
          €450
          <span className="text-sm font-sans text-forest/50 ms-1 italic">
            {t("booking.per_night")}
          </span>
        </span>
        <span className="text-xs uppercase tracking-widest flex items-center gap-1">
          <span className="text-gold">★</span> {t("booking.rating")}
        </span>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-px bg-forest/10 border border-forest/10">
          <div className="bg-card p-4">
            <label className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">
              {t("booking.checkin")}
            </label>
            <input
              type="date"
              name="checkin"
              required
              className="w-full text-sm font-medium focus:outline-none bg-transparent"
            />
          </div>
          <div className="bg-card p-4">
            <label className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">
              {t("booking.checkout")}
            </label>
            <input
              type="date"
              name="checkout"
              required
              className="w-full text-sm font-medium focus:outline-none bg-transparent"
            />
          </div>
        </div>

        <div className="bg-card p-4 border border-forest/10">
          <label className="block text-[10px] uppercase tracking-widest text-forest/50 mb-1">
            {t("booking.guests")}
          </label>
          <select
            name="guests"
            className="w-full text-sm font-medium focus:outline-none bg-transparent"
          >
            <option value="2">{t("booking.guests_options.two")}</option>
            <option value="4">{t("booking.guests_options.four")}</option>
            <option value="family">{t("booking.guests_options.family")}</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-forest text-sand py-5 text-sm uppercase tracking-[0.2em] font-bold hover:bg-gold hover:text-forest transition-colors mt-4 disabled:opacity-60"
        >
          {t("booking.cta")}
        </button>
      </form>

      <p className="text-[10px] text-center text-forest/40 mt-6 uppercase tracking-widest">
        {t("booking.no_charge")}
      </p>
    </div>
  );
}
