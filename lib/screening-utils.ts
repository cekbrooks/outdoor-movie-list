import { isUpcoming } from "./dates";
import { haversineKm } from "./geo";
import {
  isGenericVenue,
  isTbcTitle,
  minutesBetween,
  normalizeTitle,
  normalizeVenue,
  sameTitle,
  venuesCompatible,
} from "./normalize";
import type { Screening } from "./types";

/** City centers + membership radius (km). Screenings with coordinates
 * outside the radius are excluded from that city's pages (Phase 1.6). */
export const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  "new-york": { lat: 40.7128, lng: -74.006 },
  london: { lat: 51.5074, lng: -0.1278 },
};

export const CITY_RADIUS_KM = Number(process.env.CITY_RADIUS_KM || 40);

/**
 * Known far-away venues that sources mislabel as city events (Adventure
 * Cinema's UK tour is listed as "London"). Used when a row has no
 * coordinates to check against the radius. Extend as new tours appear.
 */
const OUT_OF_CITY_VENUES: Record<string, RegExp> = {
  london:
    /alnwick|scone palace|helmingham|salisbury cathedral|leeds castle|blenheim|chatsworth|cardiff|edinburgh|glasgow|harewood|burghley|newstead abbey|tatton park|bolesworth|raby castle|knebworth|hever castle|arundel castle|sandringham|castle howard|beaulieu|longleat|powderham|caldicot|margam|bodelwyddan|lincoln|durham|exeter|plymouth|norwich|sheffield|manchester|liverpool|leeds|bristol(?! street)/i,
};

export function isTbcScreening(s: Screening): boolean {
  return s.status === "tbc" || isTbcTitle(s.film);
}

/** True when the screening is genuinely in/near its labeled city. */
export function inCityRadius(s: Screening): boolean {
  const center = CITY_CENTERS[s.city];
  if (!center) return true;
  if (s.lat && s.lng) {
    return haversineKm(s.lat, s.lng, center.lat, center.lng) <= CITY_RADIUS_KM;
  }
  // No coordinates: fall back to the known out-of-city venue list.
  const blocklist = OUT_OF_CITY_VENUES[s.city];
  if (blocklist) {
    const haystack = `${s.venue} ${s.address} ${s.neighbourhood}`;
    if (blocklist.test(haystack)) return false;
  }
  return true;
}

/** Rank: how "specific"/trustworthy a row is; higher wins a merge. */
function specificity(s: Screening): number {
  let score = 0;
  if (!isTbcScreening(s)) score += 8;
  if (!isGenericVenue(s.venue)) score += 4;
  if (s.imageUrl) score += 2;
  if (s.bookingUrl) score += 1;
  if (s.time) score += 1;
  if (s.address) score += 1;
  if (s.description) score += 1;
  return score;
}

function sameEvent(a: Screening, b: Screening): boolean {
  if (a.city !== b.city || a.date !== b.date) return false;
  if (minutesBetween(a.time, b.time) > 30) return false;
  if (!venuesCompatible(a.venue, b.venue)) return false;
  const aTbc = isTbcScreening(a);
  const bTbc = isTbcScreening(b);
  if (aTbc || bTbc) return true; // placeholder collapses into the real row
  return sameTitle(normalizeTitle(a.film), normalizeTitle(b.film));
}

/**
 * Render-time duplicate collapse (Phase 1.3). The DB merge pass is the
 * durable fix; this guarantees no page ever shows the same event twice even
 * before/between merge runs.
 */
export function dedupeScreenings(screenings: Screening[]): Screening[] {
  // Group by city+date to keep comparisons cheap.
  const groups = new Map<string, Screening[]>();
  for (const s of screenings) {
    const k = `${s.city}|${s.date}`;
    const g = groups.get(k);
    if (g) g.push(s);
    else groups.set(k, [s]);
  }

  const kept = new Set<string>();
  for (const group of groups.values()) {
    // Highest specificity first so winners are decided before losers arrive.
    const sorted = [...group].sort((x, y) => specificity(y) - specificity(x));
    const winners: Screening[] = [];
    for (const s of sorted) {
      if (winners.some((w) => sameEvent(w, s))) continue;
      winners.push(s);
      kept.add(s.id);
    }
  }
  return screenings.filter((s) => kept.has(s.id));
}

/**
 * The single gate every "upcoming" list must pass through:
 * future-dated (city timezone) + confirmed film + inside city radius + deduped.
 */
export function visibleUpcoming(screenings: Screening[]): Screening[] {
  return dedupeScreenings(
    screenings.filter(
      (s) => isUpcoming(s.date, s.city) && !isTbcScreening(s) && inCityRadius(s)
    )
  );
}

/** Past, confirmed screenings (for archive pages), newest first. */
export function visiblePast(screenings: Screening[]): Screening[] {
  return dedupeScreenings(
    screenings.filter(
      (s) =>
        !!s.date &&
        !isUpcoming(s.date, s.city) &&
        !isTbcScreening(s) &&
        inCityRadius(s)
    )
  ).sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time));
}

/** Venue-page teaser: rows at this venue with no confirmed film yet. */
export function tbcCountForVenue(
  screenings: Screening[],
  venueNorm: string
): number {
  return screenings.filter(
    (s) =>
      isTbcScreening(s) &&
      isUpcoming(s.date, s.city) &&
      normalizeVenue(s.venue) === venueNorm
  ).length;
}
