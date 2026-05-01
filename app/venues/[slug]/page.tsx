import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ScreeningCard } from "@/components/ScreeningCard";
import { ScreeningsMapLoader } from "@/components/ScreeningsMapLoader";
import { fetchScreenings } from "@/lib/data";
import { getScreeningsByVenueSlug, sortScreeningsByDate } from "@/lib/queries";
import { eventsJsonLdArray } from "@/lib/jsonld";
import { defaultOgImage, SITE_NAME, SITE_URL } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const screenings = await fetchScreenings();
  const rows = getScreeningsByVenueSlug(screenings, slug);
  const first = rows[0];
  if (!first) return { title: "Venue not found" };
  const title = `${first.venue} — Outdoor movies — ${SITE_NAME}`;
  const description = `Outdoor screenings at ${first.venue}, ${first.neighbourhood}. ${rows.length} listing${rows.length === 1 ? "" : "s"}.`;
  return {
    title,
    description,
    alternates: { canonical: `/venues/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/venues/${slug}`,
      images: [
        {
          url: first.imageUrl || defaultOgImage,
          width: 1200,
          height: 630,
          alt: first.venue,
        },
      ],
    },
  };
}

export default async function VenuePage({ params }: Props) {
  const { slug } = await params;
  const screenings = await fetchScreenings();
  const rows = getScreeningsByVenueSlug(screenings, slug).sort(
    sortScreeningsByDate
  );
  if (rows.length === 0) notFound();

  const v = rows[0];
  const jsonLd = eventsJsonLdArray(rows);

  return (
    <main className="flex-1">
      <JsonLd data={jsonLd} />
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <Link href={`/${v.city}`} className="text-sm text-[#f5a623] hover:underline">
            ← {v.cityName}
          </Link>
          <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
            <div>
              <h1 className="font-display text-3xl font-semibold text-[#f0ede8] md:text-4xl">
                {v.venue}
              </h1>
              <p className="mt-2 text-sm text-[#f5a623]/90">{v.hostOrg}</p>
              <p className="mt-4 max-w-2xl text-white/65">
                Outdoor cinema at {v.venue} in {v.neighbourhood}. Hosted by{" "}
                {v.hostOrg}. Check individual listings for dates, accessibility,
                and what you can bring.
              </p>
              <p className="mt-4 text-sm text-white/50">{v.address}</p>
              <a
                href={v.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex rounded-full bg-[#f5a623] px-6 py-3 text-sm font-semibold text-[#0a0f1e] hover:bg-[#ffc04d]"
              >
                Book via host
              </a>
            </div>
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/10">
              <Image
                src={v.imageUrl || "/placeholder-poster.svg"}
                alt=""
                fill
                className="object-cover"
                sizes="280px"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <h2 className="font-display text-xl font-semibold text-[#f0ede8]">
          Map
        </h2>
        <div className="mt-4">
          <ScreeningsMapLoader screenings={rows} className="min-h-[360px]" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:pb-20">
        <h2 className="font-display text-xl font-semibold text-[#f0ede8]">
          Screenings
        </h2>
        <ul className="mt-8 grid list-none gap-6 p-0">
          {rows.map((s) => (
            <li key={s.id}>
              <ScreeningCard screening={s} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
