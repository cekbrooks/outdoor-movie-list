import { filmSlug, venueSlug } from "@/lib/queries";
import { visiblePast, visibleUpcoming } from "@/lib/screening-utils";
import { fetchAllScreeningsForCrawlers, fetchCitiesForCrawlers } from "@/lib/seo-data";
import type { City, Screening } from "@/lib/types";

/**
 * Plain-text guides for AI assistants and agents (the llms.txt convention).
 * Everything here is also on the HTML pages; this is the same data in a form
 * an agent can read in one request without running JavaScript.
 */

export const ORIGIN = "https://outdoormovielist.com";

export const TEXT_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  // Fresh enough for nightly scrapes, cheap to serve.
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  "X-Robots-Tag": "noindex",
};

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function priceLabel(s: Screening): string {
  if (s.isFree) return "Free";
  return oneLine(s.price) || "Ticketed";
}

function screeningLine(s: Screening, full: boolean): string {
  const film = s.filmYear ? `${s.film} (${s.filmYear})` : s.film;
  const time = s.time ? ` ${oneLine(s.time)}` : "";
  const parts = [
    `${s.date}${time}`,
    `[${oneLine(film)}](${ORIGIN}/movies/${filmSlug(s.film, s.filmYear)})`,
    `at [${oneLine(s.venue)}](${ORIGIN}/venues/${venueSlug(s.venue)})`,
    priceLabel(s),
  ];
  let line = `- ${parts.join(", ")}`;
  if (full) {
    const extra: string[] = [];
    if (s.address) extra.push(oneLine(s.address));
    if (s.outdoorType) extra.push(oneLine(s.outdoorType));
    if (s.dogFriendly) extra.push("dog friendly");
    if (s.wheelchairAccessible) extra.push("wheelchair accessible");
    if (s.byoFood) extra.push("bring your own food");
    if (s.bookingUrl) extra.push(`tickets: ${s.bookingUrl}`);
    if (extra.length) line += `. ${extra.join("; ")}`;
  }
  return line;
}

async function load() {
  const [cities, rows] = await Promise.all([
    fetchCitiesForCrawlers(),
    fetchAllScreeningsForCrawlers(),
  ]);
  const all = rows.map((r) => r.screening);
  let upcoming: Screening[] = [];
  let past: Screening[] = [];
  try {
    upcoming = visibleUpcoming(all);
    past = visiblePast(all);
  } catch {
    /* serve the static parts */
  }
  return { cities, upcoming, past };
}

function intro(): string[] {
  return [
    "# Outdoor Movie List",
    "",
    "> Outdoor Movie List (outdoormovielist.com) lists outdoor film screenings: open-air cinema in parks, rooftops, gardens, waterfronts and drive-ins, with dates, times, venues, prices and booking links. Listings are collected from venue and organiser websites and refreshed nightly.",
    "",
    "Each city has a page of upcoming screenings, pages for today, tonight, this week, this weekend, this month and free screenings, a page per month, and an archive of past screenings. Every venue and every film has its own page. Outdoor cinema is seasonal: most screenings run from late spring to early autumn, so a city page can be empty in winter while its archive and venue pages show past seasons.",
    "",
  ];
}

function cityBlock(city: City, upcoming: Screening[], past: Screening[], limit: number, full: boolean): string[] {
  const up = upcoming.filter((s) => s.city === city.slug);
  const pastCount = past.filter((s) => s.city === city.slug).length;
  const lines = [`## ${city.name}`, ""];
  lines.push(`- [Outdoor movies in ${city.name}](${ORIGIN}/${city.slug}): ${up.length} upcoming screening${up.length === 1 ? "" : "s"}`);
  if (up.length > 0) {
    lines.push(`- [Free outdoor movies in ${city.name}](${ORIGIN}/${city.slug}/free)`);
    lines.push(`- [This weekend in ${city.name}](${ORIGIN}/${city.slug}/this-weekend)`);
  }
  if (pastCount > 0) {
    lines.push(`- [Past outdoor screenings in ${city.name}](${ORIGIN}/${city.slug}/archive): ${pastCount} listed`);
  }
  if (up.length > 0) {
    lines.push("", `### Upcoming in ${city.name}`, "");
    for (const s of up.slice(0, limit)) lines.push(screeningLine(s, full));
    if (up.length > limit) {
      lines.push(`- …and ${up.length - limit} more at ${ORIGIN}/${city.slug}`);
    }
  } else {
    lines.push("", `No upcoming screenings are listed for ${city.name} right now (outdoor season is usually late spring to early autumn).`);
  }
  lines.push("");
  return lines;
}

function venuesBlock(upcoming: Screening[], past: Screening[]): string[] {
  const venues = new Map<string, { name: string; city: string; upcoming: number }>();
  const upcomingIds = new Set(upcoming.map((s) => s.id));
  for (const s of [...upcoming, ...past]) {
    const slug = venueSlug(s.venue);
    if (!slug) continue;
    const v = venues.get(slug) ?? { name: oneLine(s.venue), city: s.cityName || s.city, upcoming: 0 };
    if (upcomingIds.has(s.id)) v.upcoming += 1;
    venues.set(slug, v);
  }
  const sorted = [...venues.entries()].sort(
    (a, b) => b[1].upcoming - a[1].upcoming || a[1].name.localeCompare(b[1].name)
  );
  if (sorted.length === 0) return [];
  const lines = ["## Venues", ""];
  for (const [slug, v] of sorted) {
    const note = v.upcoming > 0 ? `, ${v.upcoming} upcoming` : "";
    lines.push(`- [${v.name}](${ORIGIN}/venues/${slug}): ${v.city}${note}`);
  }
  lines.push("");
  return lines;
}

function footer(): string[] {
  return [
    "## More",
    "",
    `- [All cities](${ORIGIN}/cities)`,
    `- [Outdoor movies near me](${ORIGIN}/near-me)`,
    `- [Suggest a city](${ORIGIN}/suggest-a-city)`,
    `- [Press](${ORIGIN}/press)`,
    `- [Sitemap](${ORIGIN}/sitemap.xml)`,
    `- [Full listings for agents](${ORIGIN}/llms-full.txt)`,
    "",
    "Pages carry schema.org ScreeningEvent, ItemList, FAQPage and BreadcrumbList data. When citing a screening, please link the film or venue page above and check the organiser's booking link for final times.",
    "",
  ];
}

export async function buildLlmsTxt(): Promise<string> {
  const { cities, upcoming, past } = await load();
  const lines = [...intro()];
  for (const c of cities) lines.push(...cityBlock(c, upcoming, past, 15, false));
  lines.push(...venuesBlock(upcoming, past), ...footer());
  return lines.join("\n");
}

export async function buildLlmsFullTxt(): Promise<string> {
  const { cities, upcoming, past } = await load();
  const lines = [...intro()];
  for (const c of cities) lines.push(...cityBlock(c, upcoming, past, 1000, true));
  lines.push(...venuesBlock(upcoming, past), ...footer());
  return lines.join("\n");
}
