import {
  formatRangeShortISO,
  isScreeningToday,
  isScreeningTonight,
  isThisCalendarMonth,
  isThisWeekend,
  isUpcoming,
  isWithinNextDays,
  todayInCity,
  weekendRangeISO,
} from "./dates";
import { SITE_NAME } from "./seo";
import type { Screening, TimePeriodSlug } from "./types";

export const TIME_PERIODS: TimePeriodSlug[] = [
  "today",
  "tonight",
  "this-week",
  "this-weekend",
  "this-month",
  "free",
];

/** Month slugs for programmatic /{city}/{month} pages (Phase 3.2). */
export const MONTH_PERIODS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

export type MonthPeriodSlug = (typeof MONTH_PERIODS)[number];
export type AnyPeriodSlug = TimePeriodSlug | MonthPeriodSlug;

export function isMonthPeriod(s: string): s is MonthPeriodSlug {
  return (MONTH_PERIODS as readonly string[]).includes(s);
}

export const PERIOD_HEADING: Record<TimePeriodSlug, string> = {
  today: "Today",
  tonight: "Tonight",
  "this-week": "This week",
  "this-weekend": "This weekend",
  "this-month": "This month",
  free: "Free screenings",
};

export function periodHeading(period: AnyPeriodSlug): string {
  if (isMonthPeriod(period)) {
    return period.charAt(0).toUpperCase() + period.slice(1);
  }
  return PERIOD_HEADING[period];
}

/**
 * The year a month page should target: the current year, unless that month
 * has fully passed in the city — then next year.
 */
export function monthTargetYear(month: MonthPeriodSlug, city: string): number {
  const idx = MONTH_PERIODS.indexOf(month) + 1;
  const today = todayInCity(city);
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  return idx < m ? y + 1 : y;
}

export function filterByPeriod(
  screenings: Screening[],
  period: AnyPeriodSlug,
  citySlug: string
): Screening[] {
  const upcoming = screenings.filter((s) =>
    isUpcoming(s.date, s.city || citySlug)
  );
  if (isMonthPeriod(period)) {
    const year = monthTargetYear(period, citySlug);
    const mm = String(MONTH_PERIODS.indexOf(period) + 1).padStart(2, "0");
    const prefix = `${year}-${mm}`;
    return upcoming.filter((s) => s.date.startsWith(prefix));
  }
  switch (period) {
    case "today":
      return upcoming.filter((s) => isScreeningToday(s.date, s.city || citySlug));
    case "tonight":
      return upcoming.filter((s) =>
        isScreeningTonight(s.date, s.city || citySlug)
      );
    case "this-week":
      return upcoming.filter((s) =>
        isWithinNextDays(s.date, 7, s.city || citySlug)
      );
    case "this-weekend":
      return upcoming.filter((s) => isThisWeekend(s.date, s.city || citySlug));
    case "this-month":
      return upcoming.filter((s) =>
        isThisCalendarMonth(s.date, s.city || citySlug)
      );
    case "free":
      return upcoming.filter((s) => s.isFree);
    default:
      return upcoming;
  }
}

function cityShortName(cityName: string): string {
  return cityName === "New York" ? "NYC" : cityName;
}

function longDateFor(citySlug: string): string {
  return new Date(todayInCity(citySlug) + "T12:00:00Z").toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
  );
}

function monthYearFor(citySlug: string): string {
  return new Date(todayInCity(citySlug) + "T12:00:00Z").toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric", timeZone: "UTC" }
  );
}

export function periodTitle(
  period: AnyPeriodSlug,
  cityName: string,
  citySlug: string
): string {
  const cityShort = cityShortName(cityName);
  const { fri, sun } = weekendRangeISO(citySlug);
  const range = formatRangeShortISO(fri, sun);

  if (isMonthPeriod(period)) {
    return `Outdoor Movies ${cityShort} ${periodHeading(period)} ${monthTargetYear(period, citySlug)} — Schedule`;
  }

  switch (period) {
    case "today":
      return `Outdoor Movies ${cityShort} Today (${longDateFor(citySlug)}) — ${SITE_NAME}`;
    case "tonight":
      return `Outdoor Movies ${cityShort} Tonight (${longDateFor(citySlug)}) — ${SITE_NAME}`;
    case "this-week":
      return `Outdoor Movies ${cityShort} This Week — ${SITE_NAME}`;
    case "this-weekend":
      return `Outdoor Movies ${cityShort} This Weekend (${range}) — ${SITE_NAME}`;
    case "this-month":
      return `Outdoor Movies ${cityShort} This Month (${monthYearFor(citySlug)}) — ${SITE_NAME}`;
    case "free":
      return `Free Outdoor Movies in ${cityName} — ${SITE_NAME}`;
    default:
      return SITE_NAME;
  }
}

export function periodDescription(
  period: AnyPeriodSlug,
  cityName: string,
  count: number,
  citySlug: string
): string {
  const { fri, sun } = weekendRangeISO(citySlug);
  const range = formatRangeShortISO(fri, sun);

  let when = "";
  if (isMonthPeriod(period)) {
    when = `in ${periodHeading(period)} ${monthTargetYear(period, citySlug)}`;
  } else if (period === "today" || period === "tonight") {
    when = `on ${longDateFor(citySlug)}`;
  } else if (period === "this-weekend") {
    when = `for the weekend of ${range}`;
  } else if (period === "this-week") {
    when = "over the next 7 days";
  } else if (period === "this-month") {
    when = `in ${monthYearFor(citySlug)}`;
  } else if (period === "free") {
    when = "with free admission";
  }
  return `${count} outdoor ${count === 1 ? "screening" : "screenings"} in ${cityName}${when ? ` ${when}` : ""}. Book tickets and find parks, rooftops, and waterfronts.`;
}

/** Unique intro copy per period page (Phase 3.2) — not just a filtered list. */
export function periodIntro(
  period: AnyPeriodSlug,
  cityName: string,
  citySlug: string
): string {
  if (isMonthPeriod(period)) {
    return `Every outdoor movie confirmed for ${periodHeading(period)} ${monthTargetYear(period, citySlug)} in ${cityName} — parks, rooftops, and waterfronts, updated nightly. Free park screenings are first-come, first-served (arrive 60–90 minutes early for a good spot); rooftop and garden venues usually sell timed tickets.`;
  }
  if (period === "free") {
    return `Every free outdoor screening currently scheduled in ${cityName}. Free series are typically first-come, first-served on the lawn — bring a blanket, arrive early, and check each listing for food rules.`;
  }
  return "";
}
