import type { MetadataRoute } from "next";
import { filmSlug, venueSlug } from "@/lib/queries";
import { visiblePast, visibleUpcoming } from "@/lib/screening-utils";
import {
  type CrawlRow,
  fetchAllScreeningsForCrawlers,
  fetchCitiesForCrawlers,
} from "@/lib/seo-data";
import { MONTH_PERIODS, monthTargetYear } from "@/lib/time-period";
import type { Screening } from "@/lib/types";

/**
 * Rendered on request. The cached sitemap froze on the July 2026 build and
 * kept telling Google about summer pages for months. The query is cheap.
 */
export const dynamic = "force-dynamic";

const ORIGIN = "https://outdoormovielist.com";

const PERIODS = [
  "today",
  "tonight",
  "this-week",
  "this-weekend",
  "this-month",
  "free",
] as const;

type ChangeFreq = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

function buildUrl(path: string): string {
  const t = path.trim();
  if (t === "" || t === "/") return ORIGIN;
  const segment = t.startsWith("/") ? t : `/${t}`;
  return `${ORIGIN}${segment}`.replace(/\/+$/, "");
}

/**
 * When a page's content last changed: the newest of "a listing was added"
 * and "a listed screening moved into the past". Never in the future.
 */
function lastChanged(rows: CrawlRow[], now: Date): Date | undefined {
  let best: Date | undefined;
  for (const r of rows) {
    for (const d of [
      r.createdAt ? new Date(r.createdAt) : null,
      new Date(`${r.screening.date}T23:59:59Z`),
    ]) {
      // Skip invalid dates and future ones (a screening still to come hasn't
      // changed the page yet).
      if (!d || !Number.isFinite(d.getTime()) || d > now) continue;
      if (!best || d > best) best = d;
    }
  }
  return best;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [cities, rows] = await Promise.all([
    fetchCitiesForCrawlers(),
    fetchAllScreeningsForCrawlers(),
  ]);

  const byId = new Map<string, CrawlRow>();
  for (const r of rows) byId.set(r.screening.id, r);
  const all: Screening[] = rows.map((r) => r.screening);

  // Only confirmed, deduped, in-radius rows feed the sitemap (as on the pages).
  let upcoming: Screening[] = [];
  let past: Screening[] = [];
  try {
    upcoming = visibleUpcoming(all);
    past = visiblePast(all);
  } catch {
    /* fall back to the static pages below */
  }
  const upcomingIds = new Set(upcoming.map((s) => s.id));
  const visible = [...upcoming, ...past];
  const rowsFor = (list: Screening[]) =>
    list.map((s) => byId.get(s.id)).filter((r): r is CrawlRow => !!r);

  const out: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();
  const add = (
    path: string,
    changeFrequency: ChangeFreq,
    priority: number,
    lastModified?: Date
  ) => {
    const url = buildUrl(path);
    if (seen.has(url)) return;
    seen.add(url);
    out.push({
      url,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency,
      priority,
    });
  };

  const siteChanged = lastChanged(rowsFor(visible), now);
  add("/", "daily", 1, siteChanged);
  add("/cities", "weekly", 0.7, siteChanged);

  for (const city of cities) {
    const cityUpcoming = upcoming.filter((s) => s.city === city.slug);
    const cityPast = past.filter((s) => s.city === city.slug);
    const cityChanged = lastChanged(rowsFor([...cityUpcoming, ...cityPast]), now);

    add(`/${city.slug}`, "daily", 0.9, cityChanged);

    // Day and week pages are only worth crawling while the city has a season
    // on. Off-season they are empty and read as thin pages.
    if (cityUpcoming.length > 0) {
      for (const period of PERIODS) {
        add(`/${city.slug}/${period}`, "daily", 0.8, cityChanged);
      }
    }

    // Month pages only where that month actually has screenings.
    for (const month of MONTH_PERIODS) {
      let year: number;
      try {
        year = monthTargetYear(month, city.slug);
      } catch {
        continue;
      }
      const mm = String(MONTH_PERIODS.indexOf(month) + 1).padStart(2, "0");
      const inMonth = cityUpcoming.filter((s) => s.date.startsWith(`${year}-${mm}`));
      if (inMonth.length > 0) {
        add(`/${city.slug}/${month}`, "daily", 0.8, lastChanged(rowsFor(inMonth), now));
      }
    }

    if (cityPast.length > 0) {
      add(`/${city.slug}/archive`, "weekly", 0.5, lastChanged(rowsFor(cityPast), now));
    }
  }

  add("/near-me", "weekly", 0.6);
  add("/suggest-a-city", "monthly", 0.4);
  add("/press", "monthly", 0.4);

  // Venue and film pages: every one with a confirmed screening, past ones
  // included. Both page types list past screenings, so they stay useful
  // (and linkable) off-season.
  const group = (keyOf: (s: Screening) => string) => {
    const m = new Map<string, Screening[]>();
    for (const s of visible) {
      const k = keyOf(s);
      if (!k) continue;
      const list = m.get(k);
      if (list) list.push(s);
      else m.set(k, [s]);
    }
    return m;
  };

  for (const [slug, list] of group((s) => venueSlug(s.venue))) {
    const live = list.some((s) => upcomingIds.has(s.id));
    add(`/venues/${slug}`, "weekly", live ? 0.7 : 0.5, lastChanged(rowsFor(list), now));
  }

  for (const [slug, list] of group((s) => filmSlug(s.film, s.filmYear))) {
    if (/^(tbc|tba|tbd)(-|$)/.test(slug)) continue;
    const live = list.some((s) => upcomingIds.has(s.id));
    add(`/movies/${slug}`, "weekly", live ? 0.7 : 0.4, lastChanged(rowsFor(list), now));
  }

  return out;
}
