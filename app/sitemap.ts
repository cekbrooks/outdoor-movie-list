import type { MetadataRoute } from "next";
import { allFilmSlugs, allVenueSlugs } from "@/lib/queries";

const ORIGIN = "https://outdoormovielist.com";

const CITY_SLUGS = ["new-york", "london"] as const;

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

/** Absolute URL under ORIGIN, never with a trailing slash (except scheme slashes). */
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

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified: Date = new Date();

  const raw: SitemapRow[] = [
    {
      url: buildUrl("/"),
      lastModified,
      changeFrequency: "daily",
      priority: clampPriority(1),
    },
  ];

  for (const city of CITY_SLUGS) {
    raw.push({
      url: buildUrl(`/${city}`),
      lastModified,
      changeFrequency: "daily",
      priority: clampPriority(0.9),
    });
    for (const period of PERIODS) {
      raw.push({
        url: buildUrl(`/${city}/${period}`),
        lastModified,
        changeFrequency: "daily",
        priority: clampPriority(0.85),
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
    }
  );

  for (const slug of allVenueSlugs()) {
    raw.push({
      url: buildUrl(`/venues/${slug}`),
      lastModified,
      changeFrequency: "weekly",
      priority: clampPriority(0.6),
    });
  }

  for (const slug of allFilmSlugs()) {
    raw.push({
      url: buildUrl(`/movies/${slug}`),
      lastModified,
      changeFrequency: "weekly",
      priority: clampPriority(0.6),
    });
  }

  const seen = new Set<string>();
  const deduped: MetadataRoute.Sitemap = [];
  for (const row of raw) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    deduped.push({
      url: row.url,
      lastModified: row.lastModified,
      changeFrequency: row.changeFrequency,
      priority: row.priority,
    });
  }

  return deduped;
}
