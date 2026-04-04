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
    startDate: screeningStartISO(s),
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
