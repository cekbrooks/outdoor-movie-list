import type { Metadata } from "next";
import Link from "next/link";
import { fetchCities, fetchUpcomingScreenings } from "@/lib/data";
import { visibleUpcoming } from "@/lib/screening-utils";
import { venueSlug } from "@/lib/queries";
import { ogImageUrl, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Press & Data — ${SITE_NAME}`,
  description:
    "About Outdoor Movie List: the live database of outdoor cinema in New York and London. Coverage stats, data access, and press contact.",
  alternates: { canonical: "/press" },
  openGraph: {
    title: `Press & Data — ${SITE_NAME}`,
    description:
      "The live database of outdoor cinema in New York and London.",
    url: `${SITE_URL}/press`,
    images: [
      {
        url: ogImageUrl({
          title: "Press & data",
          subtitle: "The live database of outdoor cinema in NYC & London",
        }),
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
};

export default async function PressPage() {
  const [cities, all] = await Promise.all([
    fetchCities(),
    fetchUpcomingScreenings(),
  ]);
  const upcoming = visibleUpcoming(all);
  const venues = new Set(upcoming.map((s) => venueSlug(s.venue))).size;
  const films = new Set(upcoming.map((s) => s.film)).size;
  const freeCount = upcoming.filter((s) => s.isFree).length;

  return (
    <main className="flex-1">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
          <h1 className="font-display text-3xl font-semibold text-[#f0ede8] md:text-4xl">
            Press &amp; data
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/65">
            Outdoor Movie List is the live database of open-air cinema —
            every screening in parks, rooftops, gardens, and waterfronts,
            aggregated nightly from venue and organizer listings, de-duplicated,
            and enriched with film data. We currently cover New York and
            London, with more cities on the way.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <h2 className="font-display text-2xl font-semibold text-[#f0ede8]">
          Right now we&apos;re tracking
        </h2>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [String(upcoming.length), "upcoming screenings"],
            [String(venues), "venues"],
            [String(films), "films"],
            [String(freeCount), "free screenings"],
          ].map(([n, label]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-[#0d1428]/70 p-6"
            >
              <dt className="text-sm uppercase tracking-wider text-white/45">
                {label}
              </dt>
              <dd className="mt-2 font-display text-4xl font-semibold text-[#f5a623]">
                {n}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-white/40">
          Across {cities.map((c) => c.name).join(" and ")} · updated nightly.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <h2 className="font-display text-2xl font-semibold text-[#f0ede8]">
          For journalists &amp; listings editors
        </h2>
        <div className="mt-6 max-w-2xl space-y-4 text-white/65">
          <p>
            Writing a &ldquo;best outdoor movies this summer&rdquo; roundup?
            Our city pages are kept current every night and are free to
            reference:{" "}
            {cities.map((c, i) => (
              <span key={c.slug}>
                {i > 0 ? " · " : ""}
                <Link
                  href={`/${c.slug}`}
                  className="text-[#f5a623] hover:underline"
                >
                  outdoormovielist.com/{c.slug}
                </Link>
              </span>
            ))}
            .
          </p>
          <p>
            We can provide city-level datasets (this season&apos;s full
            schedule as CSV), embeddable widgets, and quotes about outdoor
            cinema trends. A machine-readable weekend digest is at{" "}
            <Link href="/api/digest" className="text-[#f5a623] hover:underline">
              /api/digest
            </Link>
            .
          </p>
          <p>
            Contact:{" "}
            <a
              href="mailto:press@outdoormovielist.com"
              className="text-[#f5a623] hover:underline"
            >
              press@outdoormovielist.com
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
