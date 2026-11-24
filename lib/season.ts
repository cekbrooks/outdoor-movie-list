import { venueSlug, filmSlug } from "./queries";
import type { Screening } from "./types";

/**
 * Evergreen "season" facts built from past listings. Used when a page has
 * nothing upcoming (off-season, or an event that already happened) so the
 * page still answers the searcher: when it usually runs, where, and what
 * played, plus where to go next. Keeps old pages indexed and useful instead
 * of sending people to a dead event.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthYearLabel(iso: string): string {
  const m = Number(iso.slice(5, 7)) - 1;
  return `${MONTHS[m] ?? ""} ${iso.slice(0, 4)}`.trim();
}

export function longDateLabel(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type SeasonSummary = {
  /** Year of the most recent season on record. */
  lastYear: string;
  /** Screenings in that year. */
  lastYearCount: number;
  /** Earliest and latest month seen across all seasons, e.g. "May" / "September". */
  firstMonth: string;
  lastMonth: string;
  /** Total past screenings on record. */
  total: number;
  topVenues: { name: string; slug: string; count: number }[];
  topFilms: { film: string; slug: string; count: number }[];
};

function topN<T>(m: Map<string, { item: T; count: number }>, n: number) {
  return [...m.values()].sort((a, b) => b.count - a.count).slice(0, n);
}

export function seasonSummary(past: Screening[]): SeasonSummary | null {
  if (past.length === 0) return null;
  const dates = past.map((s) => s.date).filter(Boolean).sort();
  const lastYear = dates[dates.length - 1].slice(0, 4);
  const monthsSeen = new Set(dates.map((d) => Number(d.slice(5, 7)) - 1));
  const sortedMonths = [...monthsSeen].sort((a, b) => a - b);

  const venues = new Map<string, { item: { name: string; slug: string }; count: number }>();
  const films = new Map<string, { item: { film: string; slug: string }; count: number }>();
  for (const s of past) {
    const vs = venueSlug(s.venue);
    if (vs) {
      const v = venues.get(vs);
      if (v) v.count += 1;
      else venues.set(vs, { item: { name: s.venue, slug: vs }, count: 1 });
    }
    if (s.film && s.filmYear) {
      const fs = filmSlug(s.film, s.filmYear);
      const f = films.get(fs);
      if (f) f.count += 1;
      else films.set(fs, { item: { film: s.film, slug: fs }, count: 1 });
    }
  }

  return {
    lastYear,
    lastYearCount: past.filter((s) => s.date.startsWith(lastYear)).length,
    firstMonth: MONTHS[sortedMonths[0]] ?? "",
    lastMonth: MONTHS[sortedMonths[sortedMonths.length - 1]] ?? "",
    total: past.length,
    topVenues: topN(venues, 8).map((x) => ({ ...x.item, count: x.count })),
    topFilms: topN(films, 8).map((x) => ({ ...x.item, count: x.count })),
  };
}

/**
 * A city page with fewer listings than this, ever, is too thin to index:
 * it would read as an empty doorway page. It is still served to visitors.
 */
export const MIN_LISTINGS_TO_INDEX = 3;

/**
 * Off-season Q&A for a city page, answering the questions people search
 * between seasons ("when does outdoor movie season start in X?").
 */
export function buildSeasonFaq(
  cityName: string,
  season: SeasonSummary
): { question: string; answer: string }[] {
  const venues = season.topVenues.slice(0, 4).map((v) => v.name);
  const venueList =
    venues.length <= 1
      ? venues.join("")
      : `${venues.slice(0, -1).join(", ")} and ${venues[venues.length - 1]}`;
  const next = Number(season.lastYear) + 1;
  const faqs = [
    {
      question: `When does outdoor movie season start in ${cityName}?`,
      answer: `Outdoor cinema in ${cityName} usually runs from ${season.firstMonth} to ${season.lastMonth}. Organisers publish dates in the weeks before; Outdoor Movie List adds them the night they appear.`,
    },
    {
      question: `Are there outdoor movies in ${cityName} right now?`,
      answer: `Not at the moment: no outdoor screenings are announced in ${cityName} yet. Last season (${season.lastYear}) had ${season.lastYearCount} listed screenings.`,
    },
  ];
  if (venueList) {
    faqs.push({
      question: `Where are outdoor movies shown in ${cityName}?`,
      answer: `Venues that hosted outdoor screenings in ${cityName} last season include ${venueList}. Their ${next} dates will be listed on outdoormovielist.com as soon as they're announced.`,
    });
  }
  return faqs;
}
