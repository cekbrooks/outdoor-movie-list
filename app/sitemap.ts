import type { MetadataRoute } from "next";

/** Used when `NEXT_PUBLIC_SITE_URL` is unset or invalid (no `new URL()`). */
const FALLBACK_ORIGIN = "https://outdoormovielist.com";

const CITY_SLUGS = ["new-york", "london"] as const;

const PERIODS = [
  "today",
  "tonight",
  "this-week",
  "this-weekend",
  "this-month",
  "free",
] as const;

function getSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";

  if (raw && /:\/\//.test(raw) && !/^https?:\/\//i.test(raw)) {
    return FALLBACK_ORIGIN;
  }

  let origin: string;
  if (!raw) {
    origin = FALLBACK_ORIGIN;
  } else if (/^https?:\/\//i.test(raw)) {
    origin = raw.replace(/\/+$/, "");
  } else {
    origin = `https://${raw.replace(/^\/+/, "").replace(/\/+$/, "")}`;
  }

  const rest = origin.replace(/^https?:\/\//i, "");
  if (!rest || /^[/\s]/.test(rest)) {
    return FALLBACK_ORIGIN;
  }

  return origin;
}

/** Build absolute URLs with string concat only. Home = origin with no trailing slash. */
function absoluteUrl(path: string): string {
  const origin = getSiteOrigin();
  if (path === "/" || path === "") {
    return origin;
  }
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [];

  entries.push({
    url: absoluteUrl("/"),
    lastModified,
    changeFrequency: "daily",
    priority: 1,
  });

  for (const city of CITY_SLUGS) {
    entries.push({
      url: absoluteUrl(`/${city}`),
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    });

    for (const period of PERIODS) {
      entries.push({
        url: absoluteUrl(`/${city}/${period}`),
        lastModified,
        changeFrequency: "daily",
        priority: 0.85,
      });
    }
  }

  entries.push(
    {
      url: absoluteUrl("/near-me"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: absoluteUrl("/suggest-a-city"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: absoluteUrl("/cities"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    }
  );

  return entries;
}
