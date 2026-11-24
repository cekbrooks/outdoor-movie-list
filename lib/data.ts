import { cache } from "react";
import { earliestToday, registerCityZones, todayInCity } from "@/lib/dates";
import { CITY_COUNTRY_CODES } from "@/lib/jsonld";
import { registerCityCenters } from "@/lib/screening-utils";
import { screeningFromDb } from "@/lib/screening-from-db";
import { supabase } from "@/lib/supabase";
import type { City, Screening } from "@/lib/types";

/** Display names by slug, filled from the cities table. */
const CITY_NAMES: Record<string, string> = {};

/**
 * Map a DB row, fixing city_name for swept cities: the nightly scraper only
 * knows "New York" and "London" and writes the slug (e.g. "glasgow") for
 * any other city.
 */
function fromDb(row: Record<string, unknown>): Screening {
  const s = screeningFromDb(row);
  const name = CITY_NAMES[s.city];
  if (name && (!s.cityName || s.cityName === s.city)) s.cityName = name;
  return s;
}

/**
 * PostgREST returns at most 1,000 rows per request, so a plain select silently
 * drops rows once the table grows (film and venue pages for the newest
 * listings would 404). Page through with .range() until a short page.
 */
const PAGE_SIZE = 1000;
const MAX_ROWS = 50_000;

type RangeQuery = {
  range: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
};

async function selectAll(build: () => RangeQuery): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    out.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) break;
  }
  return out;
}

/**
 * ALL screenings, past included. Only for archive pages, sitemaps, and
 * diagnostics — upcoming lists must use {@link fetchUpcomingScreenings}.
 */
export const fetchScreenings = cache(async (city?: string): Promise<Screening[]> => {
  await ensureCityRegistry();
  const rows = await selectAll(() => {
    let query = supabase
      .from("screenings")
      .select("*")
      .order("date", { ascending: true })
      .order("id", { ascending: true });
    if (city) query = query.eq("city", city);
    return query;
  });
  return rows.map(fromDb);
});

/**
 * Upcoming screenings, filtered `date >= today` AT THE DATABASE so stale
 * rows never reach a page. Uses the earliest "today" across supported
 * timezones; exact per-city filtering happens in visibleUpcoming().
 */
export const fetchUpcomingScreenings = cache(
  async (city?: string): Promise<Screening[]> => {
    await ensureCityRegistry();
    const floor = city ? todayInCity(city) : earliestToday();
    const rows = await selectAll(() => {
      let query = supabase
        .from("screenings")
        .select("*")
        .gte("date", floor)
        .order("date", { ascending: true })
        .order("id", { ascending: true });
      if (city) query = query.eq("city", city);
      return query;
    });
    return rows.map(fromDb);
  }
);

/** Past screenings for a city (archive pages), newest first. */
export const fetchPastScreeningsByCity = cache(
  async (city: string, limit = 500): Promise<Screening[]> => {
    await ensureCityRegistry();
    const { data } = await supabase
      .from("screenings")
      .select("*")
      .eq("city", city)
      .lt("date", todayInCity(city))
      .order("date", { ascending: false })
      .limit(limit);
    return (data || []).map((row) => fromDb(row as Record<string, unknown>));
  }
);

export const fetchCities = cache(async (): Promise<City[]> => {
  const { data } = await supabase.from("cities").select("*").order("name", { ascending: true });
  const cities = (data || []) as City[];
  registerCities(cities);
  return cities;
});

/**
 * Cities added by the add-a-city sweep carry their own time zone, currency,
 * country and centre on the row. Register them so the date, radius and
 * JSON-LD helpers (which are keyed by slug) know about them.
 */
function registerCities(cities: City[]): void {
  registerCityZones(cities);
  registerCityCenters(cities);
  for (const c of cities) {
    CITY_NAMES[c.slug] = c.name;
    if (c.country_code) CITY_COUNTRY_CODES[c.slug] = c.country_code.toUpperCase();
  }
}

/** Load the city list once per request before any date maths. */
const ensureCityRegistry = cache(async (): Promise<void> => {
  await fetchCities();
});

export const fetchCityBySlug = cache(async (slug: string): Promise<City | null> => {
  const { data } = await supabase.from("cities").select("*").eq("slug", slug).single();
  const city = (data || null) as City | null;
  if (city) registerCities([city]);
  return city;
});

export const fetchScreeningsByCity = cache(async (city: string): Promise<Screening[]> => {
  await ensureCityRegistry();
  const rows = await selectAll(() =>
    supabase
      .from("screenings")
      .select("*")
      .eq("city", city)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
  );
  return rows.map(fromDb);
});

/**
 * Movie-slug 301 lookup, driven by the `slug_redirects` table so merged
 * films redirect without code changes. Returns null when there is no
 * redirect (or the table doesn't exist yet).
 */
export const fetchSlugRedirect = cache(
  async (fromSlug: string): Promise<string | null> => {
    try {
      const { data } = await supabase
        .from("slug_redirects")
        .select("to_slug")
        .eq("from_slug", fromSlug)
        .maybeSingle();
      return (data?.to_slug as string) || null;
    } catch {
      return null;
    }
  }
);

export const getScreenings = fetchScreenings;
export const getCities = fetchCities;
