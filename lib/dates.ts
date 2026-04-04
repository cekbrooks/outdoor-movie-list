import type { Screening } from "./types";

function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isScreeningToday(s: Screening, now: Date): boolean {
  return s.date === toISODate(now);
}

/** Same calendar day as `today` (keyword variant for /tonight routes). */
export function isScreeningTonight(s: Screening, now: Date): boolean {
  return isScreeningToday(s, now);
}

export function isWithinNextDays(
  s: Screening,
  now: Date,
  days: number
): boolean {
  const end = startOfDay(now);
  end.setDate(end.getDate() + days);
  const sd = startOfDay(parseLocalDate(s.date));
  const today = startOfDay(now);
  return sd >= today && sd <= end;
}

export function isThisWeekend(s: Screening, now: Date): boolean {
  const today = startOfDay(now);
  const dow = today.getDay();
  const friday = new Date(today);
  if (dow === 0) {
    friday.setDate(friday.getDate() - 2);
  } else if (dow === 6) {
    friday.setDate(friday.getDate() - 1);
  } else if (dow < 5) {
    friday.setDate(friday.getDate() + (5 - dow));
  }
  const sun = new Date(friday);
  sun.setDate(sun.getDate() + 2);
  const sd = startOfDay(parseLocalDate(s.date));
  return sd >= friday && sd <= sun;
}

export function isThisCalendarMonth(s: Screening, now: Date): boolean {
  const sd = parseLocalDate(s.date);
  return sd.getMonth() === now.getMonth() && sd.getFullYear() === now.getFullYear();
}

export function isUpcoming(s: Screening, now: Date): boolean {
  const sd = startOfDay(parseLocalDate(s.date));
  return sd >= startOfDay(now);
}

export function formatRangeShort(
  start: Date,
  end: Date,
  locale = "en-GB"
): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  if (start.getFullYear() !== end.getFullYear()) {
    opts.year = "numeric";
  }
  const a = start.toLocaleDateString(locale, opts);
  const b = end.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${a}–${b}`;
}

export function screeningStartISO(s: Screening): string {
  const t = s.time.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  let hour = 20;
  let minute = 0;
  if (t) {
    hour = parseInt(t[1], 10);
    minute = parseInt(t[2], 10);
    const mer = t[3]?.toLowerCase();
    if (mer === "pm" && hour < 12) hour += 12;
    if (mer === "am" && hour === 12) hour = 0;
  }
  const offset = s.city === "london" ? "+01:00" : "-04:00";
  return `${s.date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${offset}`;
}

export function priceCurrencyForCity(city: string): string {
  return city === "london" ? "GBP" : "USD";
}
