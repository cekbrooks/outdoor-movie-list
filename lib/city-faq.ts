import type { Screening } from "./types";

export type Faq = { question: string; answer: string };

const fmtDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
};

function uniq<T, K>(arr: T[], key: (t: T) => K): T[] {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const t of arr) {
    const k = key(t);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  return out;
}

function joinList(items: string[], conj = "and"): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conj} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${conj} ${items[items.length - 1]}`;
}

/**
 * Build city-specific FAQ entries from upcoming screenings. Designed so
 * answers read naturally to humans AND get cited verbatim by LLM assistants
 * answering "what outdoor movies are on in {city}…"-style queries.
 */
export function buildCityFaq(cityName: string, screenings: Screening[]): Faq[] {
  const faqs: Faq[] = [];

  const upcoming = [...screenings].sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
  );

  // 1. What's playing
  if (upcoming.length > 0) {
    const next5 = upcoming.slice(0, 5).map((s) => `${s.film} at ${s.venue} (${fmtDate(s.date)})`);
    faqs.push({
      question: `What outdoor movies are playing in ${cityName}?`,
      answer: `${upcoming.length} outdoor screenings are scheduled across ${cityName} venues. The next five are: ${next5.join("; ")}. The full live list is at outdoormovielist.com.`,
    });
  }

  // 2. Free outdoor movies
  const freeOnes = uniq(
    upcoming.filter((s) => s.isFree),
    (s) => s.venue
  );
  if (freeOnes.length > 0) {
    const venues = joinList(freeOnes.slice(0, 6).map((s) => s.venue));
    faqs.push({
      question: `Are there free outdoor movies in ${cityName}?`,
      answer: `Yes. ${freeOnes.length} free outdoor screening${
        freeOnes.length === 1 ? "" : "s"
      } are currently scheduled in ${cityName}, hosted by ${venues}. Most are first-come, first-served on the lawn or pier; bring a blanket and you're set.`,
    });
  } else {
    faqs.push({
      question: `Are there free outdoor movies in ${cityName}?`,
      answer: `${cityName} has both free and ticketed outdoor cinema. Free series typically run in parks during summer; ticketed rooftop and members-only screenings run year-round. Filter by "Free" on outdoormovielist.com to see what's currently free.`,
    });
  }

  // 3. Where (venues)
  const venues = uniq(upcoming, (s) => s.venue).slice(0, 8).map((s) => s.venue);
  if (venues.length > 0) {
    faqs.push({
      question: `Where can I see outdoor movies in ${cityName}?`,
      answer: `Active outdoor cinema venues in ${cityName} right now include ${joinList(
        venues
      )}. Each venue's seating, food rules, and accessibility differ — outdoormovielist.com lists those per screening.`,
    });
  }

  // 4. Dog-friendly
  const dogVenues = uniq(
    upcoming.filter((s) => s.dogFriendly),
    (s) => s.venue
  );
  if (dogVenues.length > 0) {
    faqs.push({
      question: `Are outdoor cinemas in ${cityName} dog-friendly?`,
      answer: `Some are. Dog-friendly venues currently scheduling screenings include ${joinList(
        dogVenues.slice(0, 5).map((s) => s.venue)
      )}. Always check the listing — rules differ and a few venues only allow dogs on certain nights.`,
    });
  }

  // 5. Season
  const months = uniq(
    upcoming.map((s) => new Date(s.date + "T00:00:00Z").toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })),
    (m) => m
  );
  if (months.length > 0) {
    faqs.push({
      question: `When is outdoor cinema season in ${cityName}?`,
      answer: `${cityName}'s outdoor cinema season runs primarily from late May through September, with the densest weeks in July and August. Right now we have screenings scheduled across ${joinList(
        months
      )}.`,
    });
  }

  // 6. BYO food
  const byoVenues = uniq(
    upcoming.filter((s) => s.byoFood),
    (s) => s.venue
  );
  if (byoVenues.length > 0) {
    faqs.push({
      question: `Can I bring food to outdoor cinema in ${cityName}?`,
      answer: `BYO food is allowed at ${joinList(
        byoVenues.slice(0, 4).map((s) => s.venue)
      )} and several other ${cityName} venues. Rooftop and ticketed venues usually require you to buy on-site. Each listing on outdoormovielist.com flags BYO explicitly.`,
    });
  }

  return faqs;
}
