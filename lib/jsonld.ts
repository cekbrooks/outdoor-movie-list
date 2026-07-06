import type { Faq } from "./city-faq";
import { priceCurrencyForCity, screeningStartISO } from "./dates";
import { filmSlug, venueSlug } from "./queries";
import { SITE_NAME, SITE_URL } from "./seo";
import type { Screening } from "./types";

function offerPrice(s: Screening): string {
  if (s.isFree) return "0";
  const n = s.price.replace(/[^0-9.]/g, "");
  return n || "0";
}

function countryFor(city: string): string {
  return city === "london" ? "GB" : "US";
}

/**
 * schema.org ScreeningEvent with timezone-correct startDate, Place geo,
 * organizer, and a free/ticketed Offer (Phase 3.1).
 */
export function screeningToEventJsonLd(s: Screening) {
  const place: Record<string, unknown> = {
    "@type": "Place",
    name: s.venue,
    address: {
      "@type": "PostalAddress",
      streetAddress: s.address || undefined,
      addressLocality: s.cityName || undefined,
      addressCountry: countryFor(s.city),
    },
  };
  if (s.lat && s.lng) {
    place.geo = {
      "@type": "GeoCoordinates",
      latitude: s.lat,
      longitude: s.lng,
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "ScreeningEvent",
    name: `${s.film} at ${s.venue}`,
    startDate: screeningStartISO(s.date, s.time, s.city),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus:
      s.status === "tbc"
        ? "https://schema.org/EventScheduled"
        : "https://schema.org/EventScheduled",
    location: place,
    workPresented: {
      "@type": "Movie",
      name: s.film,
      ...(s.filmYear ? { dateCreated: String(s.filmYear) } : {}),
      ...(s.imageUrl ? { image: s.imageUrl } : {}),
    },
    organizer: s.hostOrg
      ? { "@type": "Organization", name: s.hostOrg }
      : { "@type": "Organization", name: s.venue },
    offers: {
      "@type": "Offer",
      price: offerPrice(s),
      priceCurrency: priceCurrencyForCity(s.city),
      url: s.bookingUrl || `${SITE_URL}/movies/${filmSlug(s.film, s.filmYear)}`,
      availability: "https://schema.org/InStock",
      validFrom: s.date,
    },
    ...(s.imageUrl ? { image: s.imageUrl } : {}),
    ...(s.description ? { description: s.description } : {}),
    url: `${SITE_URL}/venues/${venueSlug(s.venue)}`,
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

/** schema.org BreadcrumbList for nested pages (Phase 3.1). */
export function breadcrumbJsonLd(
  crumbs: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      "Every outdoor movie. Every city. All summer. Parks, rooftops, and waterfronts.",
  };
}
