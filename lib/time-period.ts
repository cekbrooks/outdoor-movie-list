import {
  formatRangeShort,
  isScreeningToday,
  isScreeningTonight,
  isThisCalendarMonth,
  isThisWeekend,
  isUpcoming,
  isWithinNextDays,
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

export const PERIOD_HEADING: Record<TimePeriodSlug, string> = {
  today: "Today",
  tonight: "Tonight",
  "this-week": "This week",
  "this-weekend": "This weekend",
  "this-month": "This month",
  free: "Free screenings",
};

export function filterByPeriod(
  screenings: Screening[],
  period: TimePeriodSlug,
  now: Date
): Screening[] {
  const upcoming = screenings.filter((s) => isUpcoming(s.date));
  switch (period) {
    case "today":
      return upcoming.filter((s) => isScreeningToday(s.date));
    case "tonight":
      return upcoming.filter((s) => isScreeningTonight(s.date));
    case "this-week":
      return upcoming.filter((s) => isWithinNextDays(s.date, 7));
    case "this-weekend":
      return upcoming.filter((s) => isThisWeekend(s.date));
    case "this-month":
      return upcoming.filter((s) => isThisCalendarMonth(s.date));
    case "free":
      return upcoming.filter((s) => s.isFree);
    default:
      return upcoming;
  }
}

function weekendRange(now: Date): { fri: Date; sun: Date } {
  const dow = now.getDay();
  const fri = new Date(now);
  if (dow === 0) fri.setDate(fri.getDate() - 2);
  else if (dow === 6) fri.setDate(fri.getDate() - 1);
  else if (dow < 5) fri.setDate(fri.getDate() + (5 - dow));
  const sun = new Date(fri);
  sun.setDate(sun.getDate() + 2);
  return { fri, sun };
}

export function periodTitle(
  period: TimePeriodSlug,
  cityName: string,
  now: Date
): string {
  const { fri, sun } = weekendRange(now);
  const range = formatRangeShort(fri, sun);
  const cityShort = cityName === "New York" ? "NYC" : cityName;
  const longDate = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const monthYear = now.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  switch (period) {
    case "today":
      return `Outdoor Movies ${cityShort} Today (${longDate}) — ${SITE_NAME}`;
    case "tonight":
      return `Outdoor Movies ${cityShort} Tonight (${longDate}) — ${SITE_NAME}`;
    case "this-week":
      return `Outdoor Movies ${cityShort} This Week — ${SITE_NAME}`;
    case "this-weekend":
      return `Outdoor Movies ${cityShort} This Weekend (${range}) — ${SITE_NAME}`;
    case "this-month":
      return `Outdoor Movies ${cityShort} This Month (${monthYear}) — ${SITE_NAME}`;
    case "free":
      return `Free Outdoor Movies in ${cityName} — ${SITE_NAME}`;
    default:
      return SITE_NAME;
  }
}

export function periodDescription(
  period: TimePeriodSlug,
  cityName: string,
  count: number,
  now: Date
): string {
  const { fri, sun } = weekendRange(now);
  const range = formatRangeShort(fri, sun);
  const when =
    period === "today" || period === "tonight"
      ? `on ${now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
      : period === "this-weekend"
        ? `for the weekend of ${range}`
        : period === "this-week"
          ? "over the next 7 days"
          : period === "this-month"
            ? `in ${now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`
            : period === "free"
              ? "with free admission"
              : "";
  return `${count} outdoor ${count === 1 ? "screening" : "screenings"} in ${cityName}${when ? ` ${when}` : ""}. Book tickets and find parks, rooftops, and waterfronts.`;
}
