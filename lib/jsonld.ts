import type { Faq } from "./city-faq";
import { priceCurrencyForCity, screeningStartISO } from "./dates";
import type { Screening } from "./types";

function offerPrice(s: Screening): string {
  if (s.isFree) return "0";
  const n = s.price.replace(/[^0-9.]/g, "");
  return n || "0";
}

export function screeningToEventJsonLd(s: Screening) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${s.film} at ${s.venue}`,
    startDate: screeningStartISO(s.date, s.time),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: s.venue,
      address: s.address,
    },
    offers: {
      "@type": "Offer",
      price: offerPrice(s),
      priceCurrency: priceCurrencyForCity(s.city),
      url: s.bookingUrl,
      availability: "https://schema.org/InStock",
    },
    image: s.imageUrl,
    description: s.description,
  };
}

export function eventsJsonLdArray(screenings: Screening[]) {
  return screenings.map(screeningToEventJsonLd);
}

/**
 * Wraps a city's upcoming screenings as a schema.org ItemList. Helps LLMs
 * and crawlers see the page as a single ranked answer set, not 100 unrelated
 * Event nodes.
 */
export function cityItemListJsonLd(
  cityName: string,
  cityUrl: string,
  screenings: Screening[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Outdoor movie screenings in ${cityName}`,
    description: `Upcoming outdoor cinema, drive-in, and open-air movie screenings in ${cityName}.`,
    numberOfItems: screenings.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    url: cityUrl,
    itemListElement: screenings.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: screeningToEventJsonLd(s),
    })),
  };
}

/**
 * Schema.org FAQPage for the visible Q&A block on city pages. Google rich
 * results no longer render FAQ snippets for most non-government sites, but
 * AI assistants (ChatGPT, Claude, Perplexity, Gemini) still parse and cite
 * FAQPage entries when answering long-tail "outdoor movies in {city}"
 * queries.
 */
export function faqJsonLd(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}
