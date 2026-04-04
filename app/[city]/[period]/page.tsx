import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ScreeningCard } from "@/components/ScreeningCard";
import { getCityBySlug, getScreeningsByCity } from "@/lib/data";
import { eventsJsonLdArray } from "@/lib/jsonld";
import { sortScreeningsByDate } from "@/lib/queries";
import { defaultOgImage, SITE_URL } from "@/lib/seo";
import type { TimePeriodSlug } from "@/lib/types";
import {
  filterByPeriod,
  PERIOD_HEADING,
  periodDescription,
  periodTitle,
  TIME_PERIODS,
} from "@/lib/time-period";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ city: string; period: string }> };

function isPeriod(s: string): s is TimePeriodSlug {
  return (TIME_PERIODS as readonly string[]).includes(s);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug, period: periodRaw } = await params;
  const city = getCityBySlug(slug);
  if (!city || !isPeriod(periodRaw)) return { title: "Not found" };
  const now = new Date();
  const list = filterByPeriod(getScreeningsByCity(slug), periodRaw, now).sort(
    sortScreeningsByDate
  );
  const title = periodTitle(periodRaw, city.name, now);
  const description = periodDescription(
    periodRaw,
    city.name,
    list.length,
    now
  );
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${slug}/${periodRaw}`,
      images: [
        { url: defaultOgImage, width: 1200, height: 630, alt: title },
      ],
    },
  };
}

export default async function PeriodPage({ params }: Props) {
  const { city: slug, period: periodRaw } = await params;
  const city = getCityBySlug(slug);
  if (!city || !isPeriod(periodRaw)) notFound();

  const now = new Date();
  const screenings = filterByPeriod(
    getScreeningsByCity(slug),
    periodRaw,
    now
  ).sort(sortScreeningsByDate);

  const jsonLd = eventsJsonLdArray(screenings);

  return (
    <main className="flex-1">
      <JsonLd data={jsonLd} />
      <section className="border-b border-white/10 bg-[#070b14]/50">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <Link
            href={`/${slug}`}
            className="text-sm font-medium text-[#f5a623] hover:underline"
          >
            ← {city.name}
          </Link>
          <h1 className="mt-6 font-display text-3xl font-semibold text-[#f0ede8] md:text-4xl">
            {PERIOD_HEADING[periodRaw]} in {city.name}
          </h1>
          <p className="mt-4 max-w-2xl text-white/55">
            {screenings.length}{" "}
            {screenings.length === 1 ? "screening" : "screenings"} match this
            view.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <ul className="grid list-none gap-6 p-0">
          {screenings.map((s) => (
            <li key={s.id}>
              <ScreeningCard screening={s} />
            </li>
          ))}
        </ul>
        {screenings.length === 0 ? (
          <p className="text-white/50">
            Nothing here yet. See all{" "}
            <Link href={`/${slug}`} className="text-[#f5a623] hover:underline">
              {city.name} screenings
            </Link>
            .
          </p>
        ) : null}
      </section>
    </main>
  );
}
