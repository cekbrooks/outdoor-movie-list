import type { Metadata } from "next";
import { SuggestCityForm } from "@/components/SuggestCityForm";
import { defaultOgImage, SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: `Suggest a city — ${SITE_NAME}`,
  description:
    "Request Outdoor Movie List in your city. We save your note locally today and will plug in email + webhooks next.",
  alternates: { canonical: "/suggest-a-city" },
  openGraph: {
    title: `Add your city — ${SITE_NAME}`,
    description: "Help us launch outdoor movie listings where you live.",
    url: `${SITE_URL}/suggest-a-city`,
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: SITE_NAME }],
  },
};

export default function SuggestCityPage() {
  return (
    <main className="flex-1">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center md:px-6 md:py-16">
          <h1 className="font-display text-3xl font-semibold text-[#f0ede8] md:text-4xl">
            Add your city
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-white/55">
            Tell us where you want open-air listings next. We store this in your
            browser for now and ping our automation webhook when you submit.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:pb-24">
        <SuggestCityForm />
      </section>
    </main>
  );
}
