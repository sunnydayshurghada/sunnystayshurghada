export type BlockedRange = { start_date: string; end_date: string };

/** Format a Date as a local YYYY-MM-DD string (no UTC shifting). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/**
 * Expand [start, end) ranges into the individual nights that are taken.
 * Check-out day is NOT included, so it stays selectable as a new check-in.
 */
export function blockedNights(ranges: BlockedRange[]): Date[] {
  const days: Date[] = [];
  for (const r of ranges) {
    const start = parseISODate(r.start_date);
    const end = parseISODate(r.end_date);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
  }
  return days;
}

/** true when [checkin, checkout) does not touch any blocked night */
export function rangeIsFree(checkin: Date, checkout: Date, ranges: BlockedRange[]): boolean {
  return !ranges.some((r) => {
    const s = parseISODate(r.start_date);
    const e = parseISODate(r.end_date);
    return checkin < e && s < checkout;
  });
}

export function nightsBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
