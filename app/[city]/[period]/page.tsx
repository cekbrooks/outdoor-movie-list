import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { NoScreenings } from "@/components/NoScreenings";
import { ScreeningCard } from "@/components/ScreeningCard";
import { fetchCityBySlug, fetchUpcomingScreenings } from "@/lib/data";
import { breadcrumbJsonLd, eventsJsonLdArray } from "@/lib/jsonld";
import { sortScreeningsByDate } from "@/lib/queries";
import { visibleUpcoming } from "@/lib/screening-utils";
import { ogImageUrl, SITE_URL } from "@/lib/seo";
import type { TimePeriodSlug } from "@/lib/types";
import {
  type AnyPeriodSlug,
  filterByPeriod,
  isMonthPeriod,
  periodDescription,
  periodHeading,
  periodIntro,
  periodTitle,
  TIME_PERIODS,
} from "@/lib/time-period";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string; period: string }> };

function isPeriod(s: string): s is AnyPeriodSlug {
  return (
    (TIME_PERIODS as readonly string[]).includes(s as TimePeriodSlug) ||
    isMonthPeriod(s)
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug, period: periodRaw } = await params;
  const city = await fetchCityBySlug(slug);
  if (!city || !isPeriod(periodRaw)) return { title: "Not found" };
  const cityScreenings = visibleUpcoming(await fetchUpcomingScreenings(slug));
  const list = filterByPeriod(cityScreenings, periodRaw, slug).sort(
    sortScreeningsByDate
  );
  const title = periodTitle(periodRaw, city.name, slug);
  const description = periodDescription(periodRaw, city.name, list.length, slug);
  return {
    title,
    description,
    alternates: { canonical: `/${slug}/${periodRaw}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${slug}/${periodRaw}`,
      images: [
        {
          url: ogImageUrl({
            title: `${periodHeading(periodRaw)} in ${city.name}`,
            subtitle: `${list.length} outdoor screening${list.length === 1 ? "" : "s"}`,
          }),
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
  };
}

export default async function PeriodPage({ params }: Props) {
  const { city: slug, period: periodRaw } = await params;
  const city = await fetchCityBySlug(slug);
  if (!city || !isPeriod(periodRaw)) notFound();

  const cityScreenings = visibleUpcoming(await fetchUpcomingScreenings(slug));
  const screenings = filterByPeriod(cityScreenings, periodRaw, slug).sort(
    sortScreeningsByDate
  );

  const jsonLd = eventsJsonLdArray(screenings);
  const intro = periodIntro(periodRaw, city.name, slug);
  const crumbs = breadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: city.name, url: `${SITE_URL}/${slug}` },
    { name: periodHeading(periodRaw), url: `${SITE_URL}/${slug}/${periodRaw}` },
  ]);

  return (
    <main className="flex-1">
      {screenings.length > 0 ? <JsonLd data={jsonLd} /> : null}
      <JsonLd data={crumbs} />
      <section className="border-b border-white/10 bg-[#070b14]/50">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <Link
            href={`/${slug}`}
            className="text-sm font-medium text-[#f5a623] hover:underline"
          >
            ← {city.name}
          </Link>
          <h1 className="mt-6 font-display text-3xl font-semibold text-[#f0ede8] md:text-4xl">
            {periodHeading(periodRaw)} in {city.name}
          </h1>
          <p className="mt-4 max-w-2xl text-white/55">
            {screenings.length}{" "}
            {screenings.length === 1 ? "screening" : "screenings"} match this
            view.
          </p>
          {intro ? (
            <p className="mt-4 max-w-3xl text-white/65">{intro}</p>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        {screenings.length === 0 ? (
          <div className="space-y-4">
            <NoScreenings />
            <p className="text-center text-sm text-white/50">
              See all{" "}
              <Link
                href={`/${slug}`}
                className="text-[#f5a623] hover:underline"
              >
                {city.name} screenings
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="grid list-none gap-6 p-0">
            {screenings.map((s) => (
              <li key={s.id}>
                <ScreeningCard screening={s} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
