import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ScreeningCard } from "@/components/ScreeningCard";
import {
  fetchScreenings,
  fetchSlugRedirect,
} from "@/lib/data";
import { isUpcoming } from "@/lib/dates";
import { isTbcTitle } from "@/lib/normalize";
import {
  getFilmMetaFromSlug,
  getScreeningsByFilmSlug,
  sortScreeningsByDate,
} from "@/lib/queries";
import { dedupeScreenings, inCityRadius, isTbcScreening } from "@/lib/screening-utils";
import { breadcrumbJsonLd, eventsJsonLdArray } from "@/lib/jsonld";
import { ogImageUrl, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

/** True for placeholder slugs like `tbc-2026`, `tbc-announced-may-2026`. */
function isTbcSlug(slug: string): boolean {
  return /^(tbc|tba|tbd)(-|$)/.test(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (isTbcSlug(slug)) return { title: "Not found" };
  const screenings = await fetchScreenings();
  const meta = getFilmMetaFromSlug(screenings, slug);
  const rows = dedupeScreenings(
    getScreeningsByFilmSlug(screenings, slug).filter(
      (s) => !isTbcScreening(s) && inCityRadius(s)
    )
  );
  const first = rows[0];
  if (!meta || !first || isTbcTitle(meta.film)) return { title: "Film not found" };
  const upcoming = rows.filter((s) => isUpcoming(s.date, s.city));
  const showYear = meta.filmYear && String(meta.filmYear) !== first.date.slice(0, 4);
  const yearPart = showYear ? ` (${meta.filmYear})` : "";
  const title = `${meta.film}${yearPart} Outdoor Screenings — Dates & Tickets`;
  const cityNames = Array.from(
    new Set(upcoming.map((r) => r.cityName).filter(Boolean))
  );
  const cityList =
    cityNames.length === 0
      ? "outdoor venues"
      : cityNames.length === 1
      ? cityNames[0]
      : cityNames.length === 2
      ? `${cityNames[0]} and ${cityNames[1]}`
      : `${cityNames.slice(0, -1).join(", ")}, and ${cityNames[cityNames.length - 1]}`;
  const screeningWord = upcoming.length === 1 ? "screening" : "screenings";
  const fallback = `${upcoming.length} outdoor ${screeningWord} of ${meta.film} in ${cityList}. Find showtimes, venues, and book tickets.`;
  const description = first.description.trim() || fallback;
  const og = ogImageUrl({
    title: meta.film,
    subtitle: `${upcoming.length} outdoor ${screeningWord} in ${cityList}`,
    img: first.imageUrl || undefined,
    badge: upcoming.some((s) => s.isFree) ? "Free screenings" : undefined,
  });
  return {
    title,
    description,
    alternates: { canonical: `/movies/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/movies/${slug}`,
      images: [{ url: og, width: 1200, height: 630, alt: meta.film }],
    },
  };
}

export default async function FilmPage({ params }: Props) {
  const { slug } = await params;

  // Phase 1.5 — placeholder film pages are gone for good.
  if (isTbcSlug(slug)) permanentRedirect("/");

  const screenings = await fetchScreenings();
  const all = dedupeScreenings(
    getScreeningsByFilmSlug(screenings, slug).filter(
      (s) => !isTbcScreening(s) && inCityRadius(s)
    )
  ).sort(sortScreeningsByDate);

  if (all.length === 0) {
    // Phase 1.4 — merged slugs 301 to their canonical page.
    const target = await fetchSlugRedirect(slug);
    if (target) permanentRedirect(`/movies/${target}`);
    notFound();
  }

  const meta = getFilmMetaFromSlug(screenings, slug)!;
  if (isTbcTitle(meta.film)) permanentRedirect("/");

  const upcoming = all.filter((s) => isUpcoming(s.date, s.city));
  const past = all
    .filter((s) => !isUpcoming(s.date, s.city))
    .sort((a, b) => b.date.localeCompare(a.date));
  const first = upcoming[0] || all[0];
  const showYear =
    meta.filmYear && String(meta.filmYear) !== first.date.slice(0, 4);
  const jsonLd = eventsJsonLdArray(upcoming);
  const crumbs = breadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: meta.film, url: `${SITE_URL}/movies/${slug}` },
  ]);

  return (
    <main className="flex-1">
      {upcoming.length > 0 ? <JsonLd data={jsonLd} /> : null}
      <JsonLd data={crumbs} />
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <Link href="/" className="text-sm text-[#f5a623] hover:underline">
            ← Home
          </Link>
          <div className="mt-6 flex flex-col gap-8 md:flex-row md:items-start">
            <div className="relative mx-auto aspect-[2/3] w-full max-w-[240px] shrink-0 overflow-hidden rounded-2xl border border-white/10 md:mx-0">
              <Image
                src={first.imageUrl || "/placeholder-poster.svg"}
                alt={`${meta.film} poster`}
                fill
                className="object-cover"
                sizes="240px"
                priority
              />
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold text-[#f0ede8] md:text-4xl">
                {meta.film}{" "}
                {showYear ? (
                  <span className="text-xl font-normal text-white/45">
                    ({meta.filmYear})
                  </span>
                ) : null}
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-white/65">
                {first.description}
              </p>
              <p className="mt-6 text-sm text-white/45">
                {upcoming.length} upcoming outdoor{" "}
                {upcoming.length === 1 ? "screening" : "screenings"} across our
                cities.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:pb-20">
        <h2 className="font-display text-xl font-semibold text-[#f0ede8]">
          Where it&apos;s playing
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-6 text-white/55">
            No upcoming outdoor screenings right now — check back soon or browse{" "}
            <Link href="/cities" className="text-[#f5a623] hover:underline">
              what&apos;s on in your city
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-8 grid list-none gap-6 p-0">
            {upcoming.map((s) => (
              <li key={s.id}>
                <ScreeningCard screening={s} showCity />
              </li>
            ))}
          </ul>
        )}

        {past.length > 0 ? (
          <div className="mt-14">
            <h2 className="font-display text-xl font-semibold text-white/60">
              Past outdoor screenings
            </h2>
            <ul className="mt-6 list-none space-y-2 p-0 text-sm text-white/45">
              {past.slice(0, 20).map((s) => (
                <li key={s.id}>
                  {new Date(s.date + "T12:00:00Z").toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}{" "}
                  — {s.venue}
                  {s.cityName ? `, ${s.cityName}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}
