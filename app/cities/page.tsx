import type { Metadata } from "next";
import { CitiesGrid } from "@/components/CitiesGrid";
import { CITIES, SCREENINGS } from "@/lib/data";
import { defaultOgImage, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: `Cities — ${SITE_NAME}`,
  description:
    "Cities on Outdoor Movie List, sorted by screenings, recency, or A–Z. Launch cities: New York and London.",
  openGraph: {
    title: `Cities — ${SITE_NAME}`,
    description: "Explore cities with outdoor movie listings.",
    url: `${SITE_URL}/cities`,
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: SITE_NAME }],
  },
};

export default function CitiesPage() {
  return (
    <main className="flex-1">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <h1 className="font-display text-3xl font-semibold text-[#f0ede8] md:text-4xl">
            Cities
          </h1>
          <p className="mt-4 max-w-2xl text-white/55">
            Every city with open-air listings. New York and London are live;
            more arrive as communities request them.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:pb-20">
        <CitiesGrid cities={CITIES} screenings={SCREENINGS} />
      </section>
    </main>
  );
}
