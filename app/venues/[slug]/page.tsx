import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ScreeningCard } from "@/components/ScreeningCard";
import { EmailCapture } from "@/components/EmailCapture";
import { ScreeningsMapLoader } from "@/components/ScreeningsMapLoader";
import { fetchScreenings, fetchUpcomingScreenings } from "@/lib/data";
import { isUpcoming, todayInCity } from "@/lib/dates";
import { breadcrumbJsonLd, eventsJsonLdArray } from "@/lib/jsonld";
import { normalizeVenue } from "@/lib/normalize";
import {
  filmSlug,
  getScreeningsByVenueSlug,
  sortScreeningsByDate,
} from "@/lib/queries";
import {
  dedupeScreenings,
  inCityRadius,
  isTbcScreening,
  visibleUpcoming,
} from "@/lib/screening-utils";
import { longDateLabel, seasonSummary } from "@/lib/season";
import { ogImageUrl, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

async function venueRows(slug: string) {
  const screenings = await fetchScreenings();
  const raw = getScreeningsByVenueSlug(screenings, slug).filter((s) =>
    inCityRadius(s)
  );
  const confirmed = dedupeScreenings(raw.filter((s) => !isTbcScreening(s)));
  const upcoming = confirmed
    .filter((s) => isUpcoming(s.date, s.city))
    .sort(sortScreeningsByDate);
  const past = confirmed
    .filter((s) => !isUpcoming(s.date, s.city))
    .sort((a, b) => b.date.localeCompare(a.date));
  const tbcUpcoming = raw.filter(
    (s) => isTbcScreening(s) && isUpcoming(s.date, s.city)
  );
  return { upcoming, past, tbcUpcoming, any: confirmed[0] || raw[0] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { upcoming, past, any: v } = await venueRows(slug);
  if (!v) return { title: "Venue not found" };
  const year = todayInCity(v.city).slice(0, 4);
  const lastYear = past[0]?.date.slice(0, 4);
  const title =
    upcoming.length > 0 || !lastYear
      ? `${v.venue} Outdoor Movies ${year} — Full Schedule — ${SITE_NAME}`
      : `${v.venue} Outdoor Movies — ${lastYear} Films & Next Season — ${SITE_NAME}`;
  const description =
    upcoming.length > 0
      ? `${v.venue} outdoor movie schedule: ${upcoming.length} upcoming screening${upcoming.length === 1 ? "" : "s"}${v.neighbourhood ? ` in ${v.neighbourhood}` : ""}. Dates, films, and booking links, updated nightly.`
      : `Outdoor cinema at ${v.venue}${v.neighbourhood ? `, ${v.neighbourhood}` : ""}. ${past.length} past screening${past.length === 1 ? "" : "s"} on record — new dates appear here as soon as they're announced.`;
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
          url: ogImageUrl({
            title: v.venue,
            subtitle:
              upcoming.length > 0
                ? `${upcoming.length} upcoming outdoor screening${upcoming.length === 1 ? "" : "s"}${v.cityName ? ` · ${v.cityName}` : ""}`
                : `Outdoor cinema${v.cityName ? ` in ${v.cityName}` : ""}`,
            img: v.imageUrl || undefined,
          }),
          width: 1200,
          height: 630,
          alt: v.venue,
        },
      ],
    },
  };
}

export default async function VenuePage({ params }: Props) {
  const { slug } = await params;
  const { upcoming, past, tbcUpcoming, any: v } = await venueRows(slug);
  if (!v) notFound();

  const year = todayInCity(v.city).slice(0, 4);
  const jsonLd = eventsJsonLdArray(upcoming);

  // Nothing announced here yet: summarise last season and point to what's
  // on elsewhere in the city, so a visitor never lands on a dead end.
  const lastSeason = upcoming.length === 0 ? seasonSummary(past) : null;
  const elsewhere =
    upcoming.length === 0
      ? visibleUpcoming(await fetchUpcomingScreenings(v.city))
          .filter((s) => s.venue !== v.venue)
          .sort(sortScreeningsByDate)
          .slice(0, 6)
      : [];
  const crumbs = breadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    ...(v.cityName
      ? [{ name: v.cityName, url: `${SITE_URL}/${v.city}` }]
      : []),
    { name: v.venue, url: `${SITE_URL}/venues/${slug}` },
  ]);
  const freeCount = upcoming.filter((s) => s.isFree).length;
  const tbcNote =
    tbcUpcoming.filter(
      (s) => normalizeVenue(s.venue) === normalizeVenue(v.venue)
    ).length > 0;

  return (
    <main className="flex-1">
      {upcoming.length > 0 ? <JsonLd data={jsonLd} /> : null}
      <JsonLd data={crumbs} />
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <Link
            href={`/${v.city}`}
            className="text-sm text-[#f5a623] hover:underline"
          >
            ← {v.cityName}
          </Link>
          <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
            <div>
              <h1 className="font-display text-3xl font-semibold text-[#f0ede8] md:text-4xl">
                {upcoming.length > 0 || past.length === 0
                  ? `${v.venue} outdoor movies ${year}: full schedule`
                  : `${v.venue} outdoor movies: past films and next season`}
              </h1>
              <p className="mt-2 text-sm text-[#f5a623]/90">{v.hostOrg}</p>
              <p className="mt-4 max-w-2xl text-white/65">
                {upcoming.length > 0
                  ? `${upcoming.length} upcoming screening${upcoming.length === 1 ? "" : "s"} at ${v.venue}${v.neighbourhood ? ` in ${v.neighbourhood}` : ""}${freeCount > 0 ? `, ${freeCount === upcoming.length ? "all free" : `${freeCount} free`}` : ""}. ${freeCount > 0 ? "Free nights are first-come, first-served — arrive 60–90 minutes early for a good spot, and bring a blanket or low chairs. " : ""}Check each listing for food rules, accessibility, and booking links.`
                  : `No upcoming screenings announced at ${v.venue} right now. New dates appear here as soon as they're published.`}
              </p>
              {lastSeason ? (
                <p className="mt-4 max-w-2xl text-white/55">
                  Last season {v.venue} showed {lastSeason.lastYearCount} outdoor
                  film{lastSeason.lastYearCount === 1 ? "" : "s"} in{" "}
                  {lastSeason.lastYear}
                  {lastSeason.firstMonth && lastSeason.lastMonth
                    ? `, between ${lastSeason.firstMonth} and ${lastSeason.lastMonth}`
                    : ""}
                  . The most recent was {past[0].film} on{" "}
                  {longDateLabel(past[0].date)}.
                </p>
              ) : null}
              <p className="mt-4 text-sm text-white/50">{v.address}</p>
              {v.bookingUrl ? (
                <a
                  href={v.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex rounded-full bg-[#f5a623] px-6 py-3 text-sm font-semibold text-[#0a0f1e] hover:bg-[#ffc04d]"
                >
                  Book via host
                </a>
              ) : null}
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

      {upcoming.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <h2 className="font-display text-xl font-semibold text-[#f0ede8]">
            {year} schedule at a glance
          </h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#0d1428]/60 text-xs uppercase tracking-wider text-white/45">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Film</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Price</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 text-white/75">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(s.date)}</td>
                    <td className="px-4 py-3">{s.film}</td>
                    <td className="px-4 py-3">{s.time || "TBC"}</td>
                    <td className="px-4 py-3">{s.isFree ? "Free" : s.price || "Ticketed"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tbcNote ? (
            <p className="mt-3 text-sm text-white/40">
              More dates at this venue are still to be announced — check back
              soon.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <h2 className="font-display text-xl font-semibold text-[#f0ede8]">
          Map
        </h2>
        <div className="mt-4">
          <ScreeningsMapLoader
            screenings={upcoming.length > 0 ? upcoming : past.slice(0, 1)}
            className="min-h-[360px]"
          />
        </div>
      </section>

      {upcoming.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <h2 className="font-display text-xl font-semibold text-[#f0ede8]">
            Screenings
          </h2>
          <ul className="mt-8 grid list-none gap-6 p-0">
            {upcoming.map((s) => (
              <li key={s.id}>
                <ScreeningCard screening={s} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {upcoming.length === 0 && elsewhere.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <h2 className="font-display text-xl font-semibold text-[#f0ede8]">
            Coming up elsewhere in {v.cityName}
          </h2>
          <ul className="mt-8 grid list-none gap-6 p-0">
            {elsewhere.map((s) => (
              <li key={s.id}>
                <ScreeningCard screening={s} showCity={false} />
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm">
            <Link href={`/${v.city}`} className="text-[#f5a623] hover:underline">
              All outdoor movies in {v.cityName} →
            </Link>
          </p>
        </section>
      ) : null}

      {upcoming.length === 0 && elsewhere.length === 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <h2 className="font-display text-xl font-semibold text-[#f0ede8]">
            Hear when {v.venue} announces dates
          </h2>
          <div className="mt-6">
            <EmailCapture variant="inline" defaultCity={v.city} />
          </div>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:pb-20">
          <h2 className="font-display text-xl font-semibold text-white/60">
            Previously screened here
          </h2>
          <ul className="mt-6 list-none space-y-2 p-0 text-sm text-white/45">
            {past.slice(0, 30).map((s) => (
              <li key={s.id}>
                {fmtDate(s.date)} {s.date.slice(0, 4)} —{" "}
                {s.filmYear ? (
                  <Link
                    href={`/movies/${filmSlug(s.film, s.filmYear)}`}
                    className="hover:text-[#f5a623] hover:underline"
                  >
                    {s.film}
                  </Link>
                ) : (
                  s.film
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
