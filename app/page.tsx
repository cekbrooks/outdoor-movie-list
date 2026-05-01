import type { Metadata } from "next";
import Link from "next/link";
import { EmailCapture } from "@/components/EmailCapture";
import { NearMeButton } from "@/components/NearMeButton";
import { ScreeningsMapLoader } from "@/components/ScreeningsMapLoader";
import { NoScreenings } from "@/components/NoScreenings";
import { ScreeningCard } from "@/components/ScreeningCard";
import { fetchCities, fetchScreenings } from "@/lib/data";
import { isUpcoming } from "@/lib/dates";
import { sortScreeningsByDate } from "@/lib/queries";
import { defaultOgImage, SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${SITE_NAME} — Outdoor cinema worldwide`,
  description:
    "Every outdoor movie. Every city. All summer. Map of screenings, curated lists, and weekly email picks.",
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE_NAME} — Outdoor cinema worldwide`,
    description:
      "Every outdoor movie. Every city. All summer. Parks, rooftops, and waterfronts.",
    url: SITE_URL,
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: SITE_NAME }],
  },
};

export default async function HomePage() {
  const [cities, allScreenings] = await Promise.all([
    fetchCities(),
    fetchScreenings(),
  ]);

  const upcoming = allScreenings
    .filter((s) => isUpcoming(s.date))
    .sort(sortScreeningsByDate);

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden border-b border-white/10">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(245,166,35,0.18),transparent)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f5a623]/90">
            Open-air cinema
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-[#f0ede8] md:text-5xl lg:text-6xl">
            Every outdoor movie.
            <span className="text-[#f5a623]"> Every city.</span>
            <br />
            All summer.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/60">
            A curated map of screenings in parks, rooftops, gardens, and
            waterfronts — starting with New York and London.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <NearMeButton />
            <Link
              href="/suggest-a-city"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#f5a623]/50 px-8 text-center text-base font-semibold text-[#f5a623] transition hover:bg-[#f5a623]/10"
            >
              Add Your City
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
        <h2 className="font-display text-2xl font-semibold text-[#f0ede8] md:text-3xl">
          Choose a city
        </h2>
        {cities.length === 0 ? (
          <p
            role="status"
            className="mt-8 rounded-2xl border border-white/10 bg-[#0d1428]/50 px-6 py-10 text-center text-[#f0ede8]/80"
          >
            No cities listed yet. Check back soon or{" "}
            <Link href="/suggest-a-city" className="text-[#f5a623] hover:underline">
              suggest a city
            </Link>
            .
          </p>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {cities.map((c) => {
              const count = allScreenings.filter(
                (s) => s.city === c.slug && isUpcoming(s.date)
              ).length;
              return (
                <Link
                  key={c.slug}
                  href={`/${c.slug}`}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d1428]/80 p-8 transition duration-300 hover:-translate-y-0.5 hover:border-[#f5a623]/35 hover:shadow-[0_0_50px_-12px_rgba(245,166,35,0.35)]"
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.05]"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    }}
                  />
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-3xl font-semibold text-[#f0ede8] group-hover:text-[#f5a623]">
                        {c.name}
                      </h3>
                      <p className="mt-1 text-sm text-white/50">{c.country}</p>
                    </div>
                    <span className="rounded-full bg-[#f5a623]/15 px-4 py-2 text-sm font-bold text-[#f5a623] ring-1 ring-[#f5a623]/30">
                      {count} upcoming
                    </span>
                  </div>
                  <p className="relative mt-6 text-sm text-white/55">
                    Browse map, filters, and this week&apos;s open-air lineup →
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-y border-white/10 bg-[#070b14]/80 py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 className="font-display text-2xl font-semibold text-[#f0ede8] md:text-3xl">
            The map
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-white/55">
            Gold pins for New York, blue for London. Tap clusters to zoom in.
          </p>
          <div className="mt-8">
            {upcoming.length === 0 ? (
              <NoScreenings />
            ) : (
              <ScreeningsMapLoader screenings={upcoming} />
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
        <h2 className="font-display text-2xl font-semibold text-[#f0ede8] md:text-3xl">
          Upcoming screenings
        </h2>
        <p className="mt-2 text-sm text-white/55">Sorted by date, all cities.</p>
        <div className="mt-10">
          {upcoming.length === 0 ? (
            <NoScreenings />
          ) : (
            <ul className="grid list-none gap-6 p-0">
              {upcoming.map((s) => (
                <li key={s.id}>
                  <ScreeningCard screening={s} showCity />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0d1428]/40 py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <EmailCapture variant="hero" />
        </div>
      </section>
    </main>
  );
}
