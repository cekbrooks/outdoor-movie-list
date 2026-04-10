import { cache } from "react";
import { screeningFromDb } from "@/lib/screening-from-db";
import { supabase } from "@/lib/supabase";
import type { City, Screening } from "@/lib/types";

export const fetchScreenings = cache(async (city?: string): Promise<Screening[]> => {
  let query = supabase.from("screenings").select("*").order("date", { ascending: true });
  if (city) query = query.eq("city", city);
  const { data } = await query;
  return (data || []).map((row) => screeningFromDb(row as Record<string, unknown>));
});

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

export const getScreenings = fetchScreenings;
export const getCities = fetchCities;
