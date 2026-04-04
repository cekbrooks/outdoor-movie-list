import type { MetadataRoute } from "next";
import { CITIES } from "@/lib/data";
import {
  allFilmSlugs,
  allVenueSlugs,
} from "@/lib/queries";
import { SITE_URL } from "@/lib/seo";
import { TIME_PERIODS } from "@/lib/time-period";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastMod = new Date();
  const base: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: lastMod, changeFrequency: "daily" },
    { url: `${SITE_URL}/near-me`, lastModified: lastMod },
    { url: `${SITE_URL}/suggest-a-city`, lastModified: lastMod },
    { url: `${SITE_URL}/cities`, lastModified: lastMod },
  ];

  for (const c of CITIES) {
    base.push({
      url: `${SITE_URL}/${c.slug}`,
      lastModified: lastMod,
      changeFrequency: "daily",
    });
    for (const p of TIME_PERIODS) {
      base.push({
        url: `${SITE_URL}/${c.slug}/${p}`,
        lastModified: lastMod,
        changeFrequency: "daily",
      });
    }
  }

  for (const slug of allVenueSlugs()) {
    base.push({ url: `${SITE_URL}/venues/${slug}`, lastModified: lastMod });
  }

  for (const slug of allFilmSlugs()) {
    base.push({ url: `${SITE_URL}/movies/${slug}`, lastModified: lastMod });
  }

  return base;
}
