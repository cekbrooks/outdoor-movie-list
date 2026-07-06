/**
 * Timezone-aware date helpers.
 *
 * Every "is this screening upcoming/today/this weekend" decision is made in
 * the SCREENING'S city timezone, not the server's (Vercel runs UTC). A
 * screening tonight in NYC must not disappear at 8pm ET just because it's
 * already tomorrow in UTC.
 *
 * All comparisons operate on ISO `YYYY-MM-DD` strings, which compare
 * correctly with plain string comparison — no Date parsing ambiguity.
 */

export const CITY_TIMEZONES: Record<string, string> = {
  "new-york": "America/New_York",
  london: "Europe/London",
};

export function cityTimeZone(city?: string): string {
  return (city && CITY_TIMEZONES[city]) || "UTC";
}

/** Today's date (YYYY-MM-DD) in the given city's timezone. */
export function todayInCity(city?: string): string {
  // en-CA locale formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: cityTimeZone(city),
  }).format(new Date());
}

/**
 * The earliest "today" across all supported timezones. Use as a coarse
 * `date >= X` filter at the database level; per-city exact filtering happens
 * in code afterwards.
 */
export function earliestToday(): string {
  const days = Object.keys(CITY_TIMEZONES).map((c) => todayInCity(c));
  days.push(todayInCity()); // UTC
  return days.sort()[0];
}

/** Day-of-week (0 = Sunday) of "now" in the city's timezone. */
function cityDayOfWeek(city?: string): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: cityTimeZone(city),
    weekday: "short",
  }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

/** Add days to an ISO date string, returning an ISO date string. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z"); // noon avoids DST edge cases
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isUpcoming(date: string, city?: string): boolean {
  return !!date && date >= todayInCity(city);
}

export function isScreeningToday(date: string, city?: string): boolean {
  return date === todayInCity(city);
}

export function isScreeningTonight(date: string, city?: string): boolean {
  return isScreeningToday(date, city);
}

/** Fri–Sun range containing (or next after) today, in the city's timezone. */
export function weekendRangeISO(city?: string): { fri: string; sun: string } {
  const today = todayInCity(city);
  const dow = cityDayOfWeek(city);
  let fri: string;
  if (dow === 0) fri = addDaysISO(today, -2);
  else if (dow === 6) fri = addDaysISO(today, -1);
  else fri = addDaysISO(today, 5 - dow);
  return { fri, sun: addDaysISO(fri, 2) };
}

export function isThisWeekend(date: string, city?: string): boolean {
  const { fri, sun } = weekendRangeISO(city);
  const today = todayInCity(city);
  return date >= (today > fri ? today : fri) && date <= sun;
}

export function isWithinNextDays(
  date: string,
  days: number,
  city?: string
): boolean {
  const today = todayInCity(city);
  return date >= today && date <= addDaysISO(today, days);
}

export function isThisCalendarMonth(date: string, city?: string): boolean {
  return date.slice(0, 7) === todayInCity(city).slice(0, 7);
}

export function formatRangeShort(from: Date, to: Date): string {
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return (
    from.toLocaleDateString("en-GB", o) + " - " + to.toLocaleDateString("en-GB", o)
  );
}

export function formatRangeShortISO(fromISO: string, toISO: string): string {
  return formatRangeShort(
    new Date(fromISO + "T12:00:00Z"),
    new Date(toISO + "T12:00:00Z")
  );
}

export function priceCurrencyForCity(city: string): string {
  return city === "london" ? "GBP" : "USD";
}

/** UTC offset (e.g. "-04:00") for the city's timezone on the given date. */
export function cityUtcOffset(city: string | undefined, date: string): string {
  try {
    const tz = cityTimeZone(city);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    }).formatToParts(new Date(date + "T12:00:00Z"));
    const raw = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
    const m = raw.match(/GMT([+-]\d{2}:\d{2})/);
    return m ? m[1] : "+00:00";
  } catch {
    return "+00:00";
  }
}

/**
 * ISO start datetime WITH timezone offset — required for valid schema.org
 * Event startDate values.
 */
export function screeningStartISO(
  date: string,
  time?: string,
  city?: string
): string {
  const t = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : "20:00";
  return `${date}T${t}:00${cityUtcOffset(city, date)}`;
}
