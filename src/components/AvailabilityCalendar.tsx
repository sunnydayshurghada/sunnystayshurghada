import { useEffect, useMemo, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { de, enUS, nl, ru, arSA } from "react-day-picker/locale";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  blockedNights,
  startOfToday,
  toISODate,
  parseISODate,
  type BlockedRange,
} from "@/lib/availability";

const LOCALES: Record<string, typeof de> = {
  de,
  en: enUS,
  nl,
  ru,
  ar: arSA,
  "ar-EG": arSA,
};

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date) {
  return toISODate(a) === toISODate(b);
}

export function AvailabilityCalendar({
  ranges,
  selected,
  onSelect,
  prices,
  currency = "EUR",
}: {
  ranges: BlockedRange[];
  selected: DateRange | undefined;
  onSelect: (range: DateRange | undefined) => void;
  /** Final nightly price per ISO date, in the smallest currency unit. */
  prices?: Record<string, number>;
  currency?: string;
}) {
  const { t, i18n } = useTranslation();
  const today = startOfToday();
  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [month, setMonth] = useState<Date>(firstMonth);
  const [months, setMonths] = useState(1);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setMonths(mq.matches ? 2 : 1);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const locale = LOCALES[i18n.language] ?? LOCALES[i18n.language.split("-")[0]] ?? de;
  const rtl = i18n.language.startsWith("ar");

  const blockedSet = useMemo(
    () => new Set(blockedNights(ranges).map(toISODate)),
    [ranges],
  );

  const from = selected?.from;
  const to = selected?.to;
  const picking = Boolean(from && !to);

  /** First blocked night strictly after the chosen check-in (max check-out). */
  const maxCheckout = useMemo(() => {
    if (!from) return undefined;
    let best: Date | undefined;
    for (const r of ranges) {
      const s = parseISODate(r.start_date);
      if (s > from && (!best || s < best)) best = s;
    }
    return best;
  }, [from, ranges]);

  const isDisabled = (day: Date) => {
    if (day < today) return true;
    if (picking && from) {
      if (day <= from) return true;
      if (maxCheckout) {
        if (day > maxCheckout) return true;
        if (sameDay(day, maxCheckout)) return false;
      }
    }
    return blockedSet.has(toISODate(day));
  };

  const handleDayClick = (day: Date) => {
    if (isDisabled(day)) return;
    if (!from || to) {
      onSelect({ from: day, to: undefined });
      return;
    }
    if (day <= from) {
      onSelect({ from: day, to: undefined });
      return;
    }
    onSelect({ from, to: day });
  };

  const canGoBack = month > firstMonth;
  const label = new Intl.DateTimeFormat(i18n.language, {
    month: "long",
    year: "numeric",
  });
  const caption =
    months === 2
      ? `${label.format(month)} – ${label.format(addMonths(month, 1))}`
      : label.format(month);

  const hasPrices = Boolean(prices && Object.keys(prices).length);
  const priceFmt = new Intl.NumberFormat(i18n.language, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-forest/10 bg-card p-3 sm:p-5 shadow-[0_10px_30px_-18px_rgb(23_59_99_/_0.35)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label={t("calendar.prev_month")}
          disabled={!canGoBack}
          onClick={() => setMonth(addMonths(month, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-forest/15 text-forest transition-colors hover:border-gold hover:bg-gold/10 hover:text-gold disabled:opacity-30 disabled:hover:border-forest/15 disabled:hover:bg-transparent disabled:hover:text-forest"
        >
          <Prev className="h-5 w-5" />
        </button>
        <span className="font-display text-base sm:text-lg font-semibold capitalize text-forest text-center">
          {caption}
        </span>
        <button
          type="button"
          aria-label={t("calendar.next_month")}
          onClick={() => setMonth(addMonths(month, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-forest/15 text-forest transition-colors hover:border-gold hover:bg-gold/10 hover:text-gold"
        >
          <Next className="h-5 w-5" />
        </button>
      </div>

      <DayPicker
        mode="range"
        locale={locale}
        dir={rtl ? "rtl" : "ltr"}
        month={month}
        onMonthChange={setMonth}
        numberOfMonths={months}
        selected={selected}
        onSelect={() => {}}
        onDayClick={handleDayClick}
        disabled={isDisabled}
        modifiers={{
          booked: (day: Date) => day >= today && blockedSet.has(toISODate(day)),
        }}
        modifiersClassNames={{
          booked:
            "[&_button]:bg-forest/15 [&_button]:text-forest/45 [&_button]:line-through [&_button]:font-medium [&_button]:hover:bg-forest/15 [&_button]:cursor-not-allowed",
        }}
        hideNavigation
        showOutsideDays={false}
        components={
          hasPrices
            ? {
                DayButton: ({ day, modifiers, ...buttonProps }) => {
                  const iso = toISODate(day.date);
                  const amount = prices?.[iso];
                  return (
                    <button {...buttonProps} type="button">
                      <span className="leading-none">{day.date.getDate()}</span>
                      {amount && !modifiers["disabled"] ? (
                        <span className="mt-0.5 block text-[9px] font-medium leading-none opacity-80">
                          {priceFmt.format(amount / 100)}
                        </span>
                      ) : null}
                    </button>
                  );
                },
              }
            : undefined
        }
        className="w-full text-forest"
        classNames={{
          months: "flex flex-col md:flex-row gap-4 md:gap-6 justify-center",
          month: "flex-1",
          month_caption:
            "mb-2 flex justify-center text-[11px] uppercase tracking-[0.25em] text-forest/50",
          month_grid: "w-full table-fixed border-collapse",
          weekdays: "",
          weekday:
            "pb-1.5 text-[10px] font-medium uppercase tracking-widest text-forest/40",
          day: "p-0.5 text-center",
          day_button: hasPrices
            ? "mx-auto flex h-10 w-10 sm:h-12 sm:w-12 flex-col items-center justify-center rounded-2xl text-xs sm:text-sm transition-colors hover:bg-gold/15"
            : "mx-auto flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-xs sm:text-sm transition-colors hover:bg-gold/15",
          today: "[&_button]:ring-1 [&_button]:ring-gold/60 [&_button]:font-semibold",
          selected: "",
          range_start:
            "[&_button]:bg-gold [&_button]:text-forest [&_button]:font-bold [&_button]:hover:bg-gold",
          range_end:
            "[&_button]:bg-gold [&_button]:text-forest [&_button]:font-bold [&_button]:hover:bg-gold",
          range_middle:
            "[&_button]:bg-gold/25 [&_button]:text-forest [&_button]:rounded-full",
          disabled:
            "[&_button]:text-forest/25 [&_button]:line-through [&_button]:hover:bg-transparent [&_button]:cursor-not-allowed",
          outside: "invisible",
        }}
      />

      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 border-t border-forest/10 pt-4 text-[10px] uppercase tracking-widest text-forest/55">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-forest/25" />
          {t("calendar.available")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gold" />
          {t("calendar.selected")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-forest/20" />
          {t("calendar.unavailable")}
        </span>
      </div>

      <p className="mt-3 text-center text-[11px] text-forest/60">
        {picking ? t("calendar.hint_checkout") : t("calendar.hint_checkin")}
      </p>
    </div>
  );
}

export { addDays };
