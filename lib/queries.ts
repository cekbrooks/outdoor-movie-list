import { SCREENINGS } from "./data";
import { slugify } from "./slug";
import type { Screening } from "./types";

export function venueSlug(venue: string): string {
  return slugify(venue);
}

export function filmSlug(film: string, year: number): string {
  return `${slugify(film)}-${year}`;
}

export function getScreeningsByVenueSlug(slug: string): Screening[] {
  return SCREENINGS.filter((s) => venueSlug(s.venue) === slug);
}

export function getScreeningsByFilmSlug(slug: string): Screening[] {
  return SCREENINGS.filter((s) => filmSlug(s.film, s.filmYear) === slug);
}

export function getVenueFromSlug(slug: string): Screening | undefined {
  return SCREENINGS.find((s) => venueSlug(s.venue) === slug);
}

export function getFilmMetaFromSlug(
  slug: string
): { film: string; filmYear: number } | undefined {
  const row = SCREENINGS.find((s) => filmSlug(s.film, s.filmYear) === slug);
  if (!row) return undefined;
  return { film: row.film, filmYear: row.filmYear };
}

export function allVenueSlugs(): string[] {
  const set = new Set(SCREENINGS.map((s) => venueSlug(s.venue)));
  return [...set];
}

export function allFilmSlugs(): string[] {
  const set = new Set(SCREENINGS.map((s) => filmSlug(s.film, s.filmYear)));
  return [...set];
}

export function sortScreeningsByDate(a: Screening, b: Screening): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.time.localeCompare(b.time);
}
