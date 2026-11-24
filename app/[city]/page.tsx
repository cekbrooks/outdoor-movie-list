import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CityBrowse } from "@/components/CityBrowse";
import { CityFAQ } from "@/components/CityFAQ";
import { EmailCapture } from "@/components/EmailCapture";
import { JsonLd } from "@/components/JsonLd";
import { buildCityFaq } from "@/lib/city-faq";
import {
  fetchCityBySlug,
  fetchPastScreeningsByCity,
  fetchUpcomingScreenings,
} from "@/lib/data";
import { visiblePast, visibleUpcoming } from "@/lib/screening-utils";
import { buildSeasonFaq, MIN_LISTINGS_TO_INDEX, seasonSummary } from "@/lib/season";
import {
  breadcrumbJsonLd,
  cityItemListJsonLd,
  eventsJsonLdArray,
  faqJsonLd,
} from "@/lib/jsonld";
import { sortScreeningsByDate } from "@/lib/queries";
import { ogImageUrl, SITE_NAME, SITE_URL } from "@/lib/seo";
import { PERIOD_HEADING, TIME_PERIODS } from "@/lib/time-period";

export const revalidate = 300;

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  const city = await fetchCityBySlug(slug);
  if (!city) return { title: "Not found" };
  const count = visibleUpcoming(await fetchUpcomingScreenings(slug)).length;
  const past = visiblePast(await fetchPastScreeningsByCity(slug));
  const season = count === 0 ? seasonSummary(past) : null;
  const year = new Date().getFullYear();
  const title = `Outdoor Movies in ${city.name} ${year} — ${SITE_NAME}`;
  const description =
    count > 0
      ? `Outdoor cinema in ${city.name}: parks, rooftops, waterfronts, and gardens. ${count} upcoming screenings with booking links, updated nightly.`
      : season
      ? `Outdoor cinema in ${city.name}: the season usually runs ${season.firstMonth} to ${season.lastMonth}. ${season.lastYearCount} screenings last season at venues like ${season.topVenues
          .slice(0, 3)
          .map((v) => v.name)
          .join(", ")}. New dates added as soon as they're announced.`
      : `Outdoor cinema in ${city.name}: parks, rooftops, waterfronts, and gardens. New screenings added as soon as organisers announce them.`;
  // A city with almost nothing on record reads as a thin doorway page.
  // Visitors still get it; search engines wait until it fills.
  const thin = count + past.length < MIN_LISTINGS_TO_INDEX;
  const og = ogImageUrl({
    title: `Outdoor movies in ${city.name}`,
    subtitle: `${count} outdoor screenings in ${city.name} this summer`,
  });
  return {
    title,
    description,
    ...(thin ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: `/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${slug}`,
      images: [{ url: og, width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params;
  const city = await fetchCityBySlug(slug);
  if (!city) notFound();

  const byCity = await fetchUpcomingScreenings(slug);
  const screenings = visibleUpcoming(byCity).sort(sortScreeningsByDate);
  const season =
    screenings.length === 0
      ? seasonSummary(visiblePast(await fetchPastScreeningsByCity(slug)))
      : null;

  const cityUrl = `${SITE_URL}/${slug}`;
  const itemList = cityItemListJsonLd(city.name, cityUrl, screenings);
  const eventsLd = eventsJsonLdArray(screenings);
  const faqs = season
    ? buildSeasonFaq(city.name, season)
    : buildCityFaq(city.name, screenings);
  const faqLd = faqJsonLd(faqs);
  const crumbs = breadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: city.name, url: cityUrl },
  ]);

  return (
    <main className="flex-1">
      {screenings.length > 0 ? <JsonLd data={itemList} /> : null}
      {screenings.length > 0 ? <JsonLd data={eventsLd} /> : null}
      {faqs.length > 0 ? <JsonLd data={faqLd} /> : null}
      <JsonLd data={crumbs} />
      <section className="relative overflow-hidden border-b border-white/10">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_80%_0%,rgba(245,166,35,0.12),transparent)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f5a623]/90">
            {city.country}
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-[#f0ede8] md:text-5xl">
            Outdoor movies in {city.name}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/55">
            {screenings.length > 0
              ? `${screenings.length} upcoming ${screenings.length === 1 ? "screening" : "screenings"}. Filter by date, price, vibe, and dog-friendly spots.`
              : season
              ? `The next season hasn't been announced yet. ${city.name}'s outdoor cinema season usually runs from ${season.firstMonth} to ${season.lastMonth}; new dates appear here the night they're published.`
              : `No screenings announced yet. We add new dates the night organisers publish them.`}
          </p>
          {screenings.length > 0 ? (
          <nav
            className="mt-8 flex flex-wrap gap-2"
            aria-label="Popular date filters"
          >
            {TIME_PERIODS.map((p) => (
              <Link
                key={p}
                href={`/${slug}/${p}`}
                className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-white/70 ring-1 ring-white/10 transition hover:bg-[#f5a623]/15 hover:text-[#f5a623]"
              >
                {PERIOD_HEADING[p]}
              </Link>
            ))}
          </nav>
          ) : null}
        </div>
      </section>

      {screenings.length > 0 || !season ? (
        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <CityBrowse cityName={city.name} screenings={screenings} />
        </section>
      ) : (
        <section
          aria-labelledby="season-guide"
          className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16"
        >
          <h2
            id="season-guide"
            className="font-display text-2xl font-semibold text-[#f0ede8]"
          >
            {city.name} outdoor cinema season guide
          </h2>
          <p className="mt-4 max-w-3xl text-white/60">
            Last season ({season.lastYear}) we listed {season.lastYearCount}{" "}
            outdoor {season.lastYearCount === 1 ? "screening" : "screenings"} in{" "}
            {city.name}, running from {season.firstMonth} to {season.lastMonth}.
            These are the venues to watch for {Number(season.lastYear) + 1}{" "}
            dates.
          </p>
          <div className="mt-10 grid gap-10 md:grid-cols-2">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#f0ede8]">
                Outdoor cinema venues in {city.name}
              </h3>
              <ul className="mt-4 list-none space-y-2 p-0 text-white/70">
                {season.topVenues.map((v) => (
                  <li key={v.slug}>
                    <Link
                      href={`/venues/${v.slug}`}
                      className="hover:text-[#f5a623] hover:underline"
                    >
                      {v.name}
                    </Link>{" "}
                    <span className="text-sm text-white/40">
                      ({v.count} past {v.count === 1 ? "screening" : "screenings"})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {season.topFilms.length > 0 ? (
              <div>
                <h3 className="font-display text-lg font-semibold text-[#f0ede8]">
                  Films that played outdoors last season
                </h3>
                <ul className="mt-4 list-none space-y-2 p-0 text-white/70">
                  {season.topFilms.map((f) => (
                    <li key={f.slug}>
                      <Link
                        href={`/movies/${f.slug}`}
                        className="hover:text-[#f5a623] hover:underline"
                      >
                        {f.film}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      )}

      <CityFAQ cityName={city.name} faqs={faqs} />

      <section className="mx-auto max-w-6xl px-4 pb-4 md:px-6">
        <p className="text-sm text-white/45">
          Looking for what already played?{" "}
          <Link
            href={`/${slug}/archive`}
            className="text-[#f5a623]/80 hover:underline"
          >
            Browse the {city.name} archive →
          </Link>
        </p>
      </section>

      <section className="border-t border-white/10 bg-[#0d1428]/40 py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <EmailCapture variant="inline" defaultCity={slug} />
        </div>
      </section>
    </main>
  );
}
