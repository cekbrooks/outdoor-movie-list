import { slugify } from "./slug";
import type { Screening } from "./types";

export function venueSlug(venue: string): string {
  return slugify(venue);
}

export function filmSlug(film: string, year: number): string {
  return `${slugify(film)}-${year}`;
}

export function getScreeningsByVenueSlug(
  screenings: Screening[],
  slug: string
): Screening[] {
  return screenings.filter((s) => venueSlug(s.venue) === slug);
}

export function getScreeningsByFilmSlug(
  screenings: Screening[],
  slug: string
): Screening[] {
  return screenings.filter((s) => filmSlug(s.film, s.filmYear) === slug);
}

export function getVenueFromSlug(
  screenings: Screening[],
  slug: string
): Screening | undefined {
  return screenings.find((s) => venueSlug(s.venue) === slug);
}

export function getFilmMetaFromSlug(
  screenings: Screening[],
  slug: string
): { film: string; filmYear: number } | undefined {
  const row = screenings.find((s) => filmSlug(s.film, s.filmYear) === slug);
  if (!row) return undefined;
  return { film: row.film, filmYear: row.filmYear };
}

export function allVenueSlugs(screenings: Screening[]): string[] {
  const set = new Set(screenings.map((s) => venueSlug(s.venue)));
  return [...set];
}

export function allFilmSlugs(screenings: Screening[]): string[] {
  const set = new Set(screenings.map((s) => filmSlug(s.film, s.filmYear)));
  return [...set];
}

export function sortScreeningsByDate(a: Screening, b: Screening): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.time.localeCompare(b.time);
}
