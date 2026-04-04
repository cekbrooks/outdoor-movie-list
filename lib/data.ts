import { cache } from "react";
import { tryCreateSupabaseClient } from "@/lib/supabase";
import type { City, Screening } from "@/lib/types";

type CityRow = {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  added_by: string | null;
  added_date: string | null;
};

type ScreeningRow = {
  id: string;
  city_slug: string;
  city_name: string;
  venue: string;
  host_org: string;
  address: string;
  neighbourhood: string;
  lat: number;
  lng: number;
  film: string;
  film_year: number;
  description: string;
  screening_date: string;
  screening_time: string;
  price: string;
  is_free: boolean;
  outdoor_type: string;
  dog_friendly: boolean;
  wheelchair_accessible: boolean;
  byo_food: boolean;
  booking_url: string;
  listing_url: string;
  image_url: string;
  added_by: string | null;
  status: string;
};

function mapCity(row: CityRow): City {
  return {
    slug: row.slug,
    name: row.name,
    country: row.country,
    lat: Number(row.lat),
    lng: Number(row.lng),
    addedBy: row.added_by ?? undefined,
    addedDate: row.added_date ?? undefined,
  };
}

function mapScreening(row: ScreeningRow): Screening | null {
  if (!row?.id || !row.city_slug) return null;

  const status = row.status === "tbc" ? "tbc" : "confirmed";
  const date =
    row.screening_date != null
      ? String(row.screening_date).slice(0, 10)
      : "";

  if (!date) return null;

  return {
    id: String(row.id),
    city: String(row.city_slug),
    cityName: String(row.city_name ?? ""),
    venue: String(row.venue ?? ""),
    hostOrg: String(row.host_org ?? ""),
    address: String(row.address ?? ""),
    neighbourhood: String(row.neighbourhood ?? ""),
    lat: Number(row.lat) || 0,
    lng: Number(row.lng) || 0,
    film: String(row.film ?? ""),
    filmYear: Number(row.film_year) || 0,
    description: String(row.description ?? ""),
    date,
    time: String(row.screening_time ?? ""),
    price: String(row.price ?? ""),
    isFree: Boolean(row.is_free),
    outdoorType: String(row.outdoor_type ?? ""),
    dogFriendly: Boolean(row.dog_friendly),
    wheelchairAccessible: Boolean(row.wheelchair_accessible),
    byoFood: Boolean(row.byo_food),
    bookingUrl: String(row.booking_url ?? ""),
    listingUrl: String(row.listing_url ?? ""),
    imageUrl: String(row.image_url ?? ""),
    addedBy: row.added_by ?? undefined,
    status,
  };
}

export const fetchCities = cache(async (): Promise<City[]> => {
  const supabase = tryCreateSupabaseClient();
  if (!supabase) {
    console.warn("[Supabase] Skipping fetchCities: client not configured");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("cities")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("[Supabase] fetchCities:", error.message);
      return [];
    }

    return ((data ?? []) as CityRow[]).map(mapCity);
  } catch (e) {
    console.error("[Supabase] fetchCities:", e);
    return [];
  }
});

export const fetchScreenings = cache(async (): Promise<Screening[]> => {
  const supabase = tryCreateSupabaseClient();
  if (!supabase) {
    console.warn("[Supabase] Skipping fetchScreenings: client not configured");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("screenings")
      .select("*")
      .order("screening_date", { ascending: true })
      .order("screening_time", { ascending: true });

    if (error) {
      console.error("[Supabase] fetchScreenings:", error.message);
      return [];
    }

    return ((data ?? []) as ScreeningRow[])
      .map(mapScreening)
      .filter((s): s is Screening => s !== null);
  } catch (e) {
    console.error("[Supabase] fetchScreenings:", e);
    return [];
  }
});

export async function fetchCityBySlug(
  slug: string
): Promise<City | undefined> {
  const cities = await fetchCities();
  return cities.find((c) => c.slug === slug);
}

export async function fetchScreeningsByCity(
  citySlug: string
): Promise<Screening[]> {
  const screenings = await fetchScreenings();
  return screenings.filter((s) => s.city === citySlug);
}
