const DEFAULT_SITE = "https://outdoormovielist.com";

function trim(s: string | undefined): string {
  return (s ?? "").trim();
}

/**
 * Canonical site URL for metadata, sitemap, and OG.
 * - Adds https:// when the env var is host-only (common Vercel misconfig).
 * - Falls back to VERCEL_URL on preview/production when the public URL is unset.
 * - Never returns an empty string (avoids `new URL("")` throwing in the root layout).
 */
function resolveSiteUrl(): string {
  const explicit = trim(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) {
    if (/^https?:\/\//i.test(explicit)) {
      return explicit.replace(/\/$/, "");
    }
    return `https://${explicit.replace(/^\/+/, "").replace(/\/$/, "")}`;
  }

  const vercel = trim(process.env.VERCEL_URL);
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    if (host) return `https://${host}`;
  }

  return DEFAULT_SITE;
}

export const SITE_NAME = "Outdoor Movie List";

export const SITE_URL = resolveSiteUrl();

/** Safe for `metadataBase` — never throws. */
export function getMetadataBase(): URL {
  try {
    const url = new URL(SITE_URL);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url;
    }
  } catch {
    /* fall through */
  }
  return new URL(DEFAULT_SITE);
}

/** Branded per-page OG image (Fix Brief 3.4) — served by /api/og. */
export function ogImageUrl(opts: {
  title: string;
  subtitle?: string;
  img?: string;
  badge?: string;
}): string {
  const params = new URLSearchParams();
  params.set("title", opts.title);
  if (opts.subtitle) params.set("subtitle", opts.subtitle);
  if (opts.img) params.set("img", opts.img);
  if (opts.badge) params.set("badge", opts.badge);
  return `${SITE_URL}/api/og?${params.toString()}`;
}

export const defaultOgImage = ogImageUrl({
  title: "Every outdoor movie. Every city.",
  subtitle: "Parks, rooftops, and waterfronts — updated nightly.",
});
