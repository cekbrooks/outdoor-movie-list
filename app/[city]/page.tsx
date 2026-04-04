import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CityBrowse } from "@/components/CityBrowse";
import { EmailCapture } from "@/components/EmailCapture";
import { JsonLd } from "@/components/JsonLd";
import { fetchCityBySlug, fetchScreeningsByCity } from "@/lib/data";
import { isUpcoming } from "@/lib/dates";
import { eventsJsonLdArray } from "@/lib/jsonld";
import { sortScreeningsByDate } from "@/lib/queries";
import { defaultOgImage, SITE_NAME, SITE_URL } from "@/lib/seo";
import { PERIOD_HEADING, TIME_PERIODS } from "@/lib/time-period";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  const city = await fetchCityBySlug(slug);
  if (!city) return { title: "Not found" };
  const title = `Outdoor Movies in ${city.name} 2026 — ${SITE_NAME}`;
  const description = `Outdoor cinema in ${city.name}: parks, rooftops, waterfronts, and gardens. Updated listings with booking links.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${slug}`,
      images: [
        { url: defaultOgImage, width: 1200, height: 630, alt: title },
      ],
    },
  };
}

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params;
  const city = await fetchCityBySlug(slug);
  if (!city) notFound();

  const now = new Date();
  const byCity = await fetchScreeningsByCity(slug);
  const screenings = byCity
    .filter((s) => isUpcoming(s.date))
    .sort(sortScreeningsByDate);

  const jsonLd = eventsJsonLdArray(screenings);

  return (
    <main className="flex-1">
      {screenings.length > 0 ? <JsonLd data={jsonLd} /> : null}
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
            {screenings.length} upcoming{" "}
            {screenings.length === 1 ? "screening" : "screenings"} — filter by
            date, price, vibe, and dog-friendly spots.
          </p>
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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <CityBrowse cityName={city.name} screenings={screenings} />
      </section>

      <section className="border-t border-white/10 bg-[#0d1428]/40 py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <EmailCapture variant="inline" defaultCity={slug} />
        </div>
      </section>
    </main>
  );
}
