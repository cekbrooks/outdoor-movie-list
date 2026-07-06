import { cache } from "react";
import { earliestToday, todayInCity } from "@/lib/dates";
import { screeningFromDb } from "@/lib/screening-from-db";
import { supabase } from "@/lib/supabase";
import type { City, Screening } from "@/lib/types";

/**
 * ALL screenings, past included. Only for archive pages, sitemaps, and
 * diagnostics — upcoming lists must use {@link fetchUpcomingScreenings}.
 */
export const fetchScreenings = cache(async (city?: string): Promise<Screening[]> => {
  let query = supabase.from("screenings").select("*").order("date", { ascending: true });
  if (city) query = query.eq("city", city);
  const { data } = await query;
  return (data || []).map((row) => screeningFromDb(row as Record<string, unknown>));
});

/**
 * Upcoming screenings, filtered `date >= today` AT THE DATABASE so stale
 * rows never reach a page. Uses the earliest "today" across supported
 * timezones; exact per-city filtering happens in visibleUpcoming().
 */
export const fetchUpcomingScreenings = cache(
  async (city?: string): Promise<Screening[]> => {
    const floor = city ? todayInCity(city) : earliestToday();
    let query = supabase
      .from("screenings")
      .select("*")
      .gte("date", floor)
      .order("date", { ascending: true });
    if (city) query = query.eq("city", city);
    const { data } = await query;
    return (data || []).map((row) => screeningFromDb(row as Record<string, unknown>));
  }
);

/** Past screenings for a city (archive pages), newest first. */
export const fetchPastScreeningsByCity = cache(
  async (city: string, limit = 500): Promise<Screening[]> => {
    const { data } = await supabase
      .from("screenings")
      .select("*")
      .eq("city", city)
      .lt("date", todayInCity(city))
      .order("date", { ascending: false })
      .limit(limit);
    return (data || []).map((row) => screeningFromDb(row as Record<string, unknown>));
  }
);

export const fetchCities = cache(async (): Promise<City[]> => {
  const { data } = await supabase.from("cities").select("*").order("name", { ascending: true });
  return (data || []) as City[];
});

export const fetchCityBySlug = cache(async (slug: string): Promise<City | null> => {
  const { data } = await supabase.from("cities").select("*").eq("slug", slug).single();
  return (data || null) as City | null;
});

export const fetchScreeningsByCity = cache(async (city: string): Promise<Screening[]> => {
  const { data } = await supabase.from("screenings").select("*").eq("city", city).order("date", { ascending: true });
  return (data || []).map((row) => screeningFromDb(row as Record<string, unknown>));
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
