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

export const defaultOgImage =
  "https://images.unsplash.com/photo-1489599849927-2ee91cedd3db?w=1200&h=630&fit=crop";
