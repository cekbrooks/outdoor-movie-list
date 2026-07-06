import type { Metadata } from "next";
import { Suspense } from "react";
import { NearMeClient } from "@/components/NearMeClient";
import { fetchUpcomingScreenings } from "@/lib/data";
import { visibleUpcoming } from "@/lib/screening-utils";
import { defaultOgImage, SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: `Near Me — Outdoor movies within 40 km — ${SITE_NAME}`,
  description:
    "Use your location to see outdoor movie screenings within about 25 miles. Fallback city picker if location is off.",
  alternates: { canonical: "/near-me" },
  openGraph: {
    title: `Near Me — ${SITE_NAME}`,
    description: "Outdoor screenings near you, sorted by distance.",
    url: `${SITE_URL}/near-me`,
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: SITE_NAME }],
  },
};

export default async function NearMePage() {
  const allScreenings = visibleUpcoming(await fetchUpcomingScreenings());

  return (
    <main className="flex-1">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <h1 className="font-display text-3xl font-semibold text-[#f0ede8] md:text-4xl">
            Near me
          </h1>
          <p className="mt-4 max-w-2xl text-white/55">
            We&apos;ll ask for your location once. Screenings within 40 km (~25
            miles), closest first.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:pb-20">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-white/10 bg-[#0d1428]/50 p-12 text-center text-white/60">
              Loading…
            </div>
          }
        >
          <NearMeClient allScreenings={allScreenings} />
        </Suspense>
      </section>
    </main>
  );
}
