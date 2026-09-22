import { useMemo } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { de, enUS, nl, ru, arSA } from "react-day-picker/locale";
import { useTranslation } from "react-i18next";
import { blockedNights, startOfToday, type BlockedRange } from "@/lib/availability";

const LOCALES: Record<string, typeof de> = {
  de,
  en: enUS,
  nl,
  ru,
  ar: arSA,
  "ar-EG": arSA,
};

export function AvailabilityCalendar({
  ranges,
  selected,
  onSelect,
  numberOfMonths = 1,
}: {
  ranges: BlockedRange[];
  selected: DateRange | undefined;
  onSelect: (range: DateRange | undefined) => void;
  numberOfMonths?: number;
}) {
  const { t, i18n } = useTranslation();
  const today = startOfToday();
  const disabledDays = useMemo(() => blockedNights(ranges), [ranges]);
  const locale = LOCALES[i18n.language] ?? LOCALES[i18n.language.split("-")[0]] ?? de;
  const dir = i18n.language.startsWith("ar") ? "rtl" : "ltr";

  return (
    <div className="rounded-2xl border border-forest/10 bg-card p-3 sm:p-4">
      <DayPicker
        mode="range"
        locale={locale}
        dir={dir}
        numberOfMonths={numberOfMonths}
        selected={selected}
        onSelect={onSelect}
        disabled={[{ before: today }, ...disabledDays]}
        excludeDisabled
        showOutsideDays={false}
        className="w-full [--rdp-accent-color:var(--color-gold)] [--rdp-accent-background-color:color-mix(in_srgb,var(--color-gold)_18%,transparent)] [--rdp-day-height:2.3rem] [--rdp-day-width:2.3rem] text-forest"
        classNames={{
          month_caption:
            "flex justify-center py-2 text-sm font-display font-semibold text-forest capitalize",
          nav: "absolute end-1 top-1 flex gap-1",
          weekday: "text-[10px] uppercase tracking-widest text-forest/40 font-medium",
          day: "text-sm",
          today: "font-bold text-gold",
          disabled: "line-through opacity-35",
        }}
      />
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 border-t border-forest/10 pt-3 text-[10px] uppercase tracking-widest text-forest/55">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gold" />
          {t("calendar.available")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-forest/25" />
          {t("calendar.unavailable")}
        </span>
      </div>
    </div>
  );
}
