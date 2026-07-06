import type { MetadataRoute } from "next";
import { fetchCities, fetchScreenings } from "@/lib/data";
import { todayInCity } from "@/lib/dates";
import { allFilmSlugs, allVenueSlugs, venueSlug } from "@/lib/queries";
import { visiblePast, visibleUpcoming } from "@/lib/screening-utils";
import { MONTH_PERIODS, monthTargetYear } from "@/lib/time-period";

export const revalidate = 3600;

const ORIGIN = "https://outdoormovielist.com";

const PERIODS = [
  "today",
  "tonight",
  "this-week",
  "this-weekend",
  "this-month",
  "free",
] as const;

type ChangeFreq =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

type SitemapRow = {
  url: string;
  lastModified: Date;
  changeFrequency: ChangeFreq;
  priority: number;
};

function buildUrl(path: string): string {
  const t = path.trim();
  if (t === "" || t === "/") {
    return ORIGIN;
  }
  const segment = t.startsWith("/") ? t : `/${t}`;
  return `${ORIGIN}${segment}`.replace(/\/+$/, "");
}

function clampPriority(p: number): number {
  if (Number.isNaN(p)) return 0.5;
  return Math.min(1, Math.max(0, p));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cities, allScreenings] = await Promise.all([
    fetchCities(),
    fetchScreenings(),
  ]);

  // Phase 1.5/3.3 — only confirmed, deduped, in-radius rows feed the sitemap.
  // TBC and merged-away slugs never appear.
  const upcoming = visibleUpcoming(allScreenings);
  const past = visiblePast(allScreenings);
  const lastModified: Date = new Date();

  const raw: SitemapRow[] = [
    {
      url: buildUrl("/"),
      lastModified,
      changeFrequency: "daily",
      priority: clampPriority(1),
    },
  ];

  for (const city of cities) {
    const cityUpcoming = upcoming.filter((s) => s.city === city.slug);
    raw.push({
      url: buildUrl(`/${city.slug}`),
      lastModified,
      changeFrequency: "daily",
      priority: clampPriority(0.9),
    });
    for (const period of PERIODS) {
      raw.push({
        url: buildUrl(`/${city.slug}/${period}`),
        lastModified,
        changeFrequency: "daily",
        priority: clampPriority(0.85),
      });
    }
    // Month pages only where that month actually has screenings (Phase 3.2).
    for (const month of MONTH_PERIODS) {
      const year = monthTargetYear(month, city.slug);
      const mm = String(MONTH_PERIODS.indexOf(month) + 1).padStart(2, "0");
      const has = cityUpcoming.some((s) => s.date.startsWith(`${year}-${mm}`));
      if (has) {
        raw.push({
          url: buildUrl(`/${city.slug}/${month}`),
          lastModified,
          changeFrequency: "daily",
          priority: clampPriority(0.8),
        });
      }
    }
    // Archive page (Phase 2.3) once the city has any past screenings.
    if (past.some((s) => s.city === city.slug)) {
      raw.push({
        url: buildUrl(`/${city.slug}/archive`),
        lastModified,
        changeFrequency: "weekly",
        priority: clampPriority(0.4),
      });
    }
  }

  raw.push(
    {
      url: buildUrl("/near-me"),
      lastModified,
      changeFrequency: "weekly",
      priority: clampPriority(0.75),
    },
    {
      url: buildUrl("/suggest-a-city"),
      lastModified,
      changeFrequency: "monthly",
      priority: clampPriority(0.65),
    },
    {
      url: buildUrl("/cities"),
      lastModified,
      changeFrequency: "weekly",
      priority: clampPriority(0.7),
    },
    {
      url: buildUrl("/press"),
      lastModified,
      changeFrequency: "monthly",
      priority: clampPriority(0.5),
    }
  );

  // Venue pages: keep venues alive while they have upcoming OR recent past
  // screenings (long-tail value), with lastmod from their latest activity.
  const venueRows = [...upcoming, ...past];
  for (const slug of allVenueSlugs(venueRows)) {
    const dates = venueRows
      .filter((s) => venueSlug(s.venue) === slug)
      .map((s) => s.date)
      .sort();
    const latest = dates[dates.length - 1];
    raw.push({
      url: buildUrl(`/venues/${slug}`),
      lastModified: latest ? new Date(latest + "T12:00:00Z") : lastModified,
      changeFrequency: "weekly",
      priority: clampPriority(0.6),
    });
  }

  for (const slug of allFilmSlugs(upcoming)) {
    raw.push({
      url: buildUrl(`/movies/${slug}`),
      lastModified,
      changeFrequency: "weekly",
      priority: clampPriority(0.6),
    });
  }

  const today = todayInCity();
  const seen = new Set<string>();
  const deduped: MetadataRoute.Sitemap = [];
  for (const row of raw) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    deduped.push({
      url: row.url,
      lastModified:
        row.lastModified > new Date(today + "T23:59:59Z")
          ? lastModified
          : row.lastModified,
      changeFrequency: row.changeFrequency,
      priority: row.priority,
    });
  }

  return deduped;
}
