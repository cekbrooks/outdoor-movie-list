import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { fetchCityBySlug, fetchPastScreeningsByCity } from "@/lib/data";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { venueSlug } from "@/lib/queries";
import { visiblePast } from "@/lib/screening-utils";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import type { Screening } from "@/lib/types";

export const revalidate = 86400; // past data changes at most once a day

type Props = { params: Promise<{ city: string }> };

function monthLabel(iso: string): string {
  return new Date(iso.slice(0, 7) + "-15T12:00:00Z").toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric", timeZone: "UTC" }
  );
}

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  const city = await fetchCityBySlug(slug);
  if (!city) return { title: "Not found" };
  const title = `Past Outdoor Movies in ${city.name} — Archive — ${SITE_NAME}`;
  const description = `Archive of past outdoor cinema screenings in ${city.name}: what played, where, and when. Browse venues to see what's coming next.`;
  return {
    title,
    description,
    alternates: { canonical: `/${slug}/archive` },
    openGraph: { title, description, url: `${SITE_URL}/${slug}/archive` },
  };
}

export default async function ArchivePage({ params }: Props) {
  const { city: slug } = await params;
  const city = await fetchCityBySlug(slug);
  if (!city) notFound();

  const past = visiblePast(await fetchPastScreeningsByCity(slug));

  // Group by month, newest month first.
  const byMonth = new Map<string, Screening[]>();
  for (const s of past) {
    const k = s.date.slice(0, 7);
    const g = byMonth.get(k);
    if (g) g.push(s);
    else byMonth.set(k, [s]);
  }
  const months = [...byMonth.keys()].sort().reverse();

  const crumbs = breadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: city.name, url: `${SITE_URL}/${slug}` },
    { name: "Archive", url: `${SITE_URL}/${slug}/archive` },
  ]);

  return (
    <main className="flex-1">
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
            Past outdoor movies in {city.name}
          </h1>
          <p className="mt-4 max-w-2xl text-white/55">
            {past.length} past screening{past.length === 1 ? "" : "s"} on
            record. These dates have already happened — for what&apos;s next,
            see the{" "}
            <Link href={`/${slug}`} className="text-[#f5a623] hover:underline">
              live {city.name} listings
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:pb-20">
        {months.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-[#0d1428]/50 px-6 py-10 text-center text-white/60">
            No past screenings recorded yet — the archive fills up as the
            season rolls on.
          </p>
        ) : (
          months.map((m) => (
            <div key={m} className="mb-12">
              <h2 className="font-display text-xl font-semibold text-[#f0ede8]">
                {monthLabel(m + "-01")}
              </h2>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-[#0d1428]/60 text-xs uppercase tracking-wider text-white/45">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Film</th>
                      <th className="px-4 py-3">Venue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(byMonth.get(m) || []).map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-white/5 text-white/65"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {fmtDate(s.date)}
                        </td>
                        <td className="px-4 py-3">{s.film}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/venues/${venueSlug(s.venue)}`}
                            className="text-[#f5a623]/90 hover:underline"
                          >
                            {s.venue}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
