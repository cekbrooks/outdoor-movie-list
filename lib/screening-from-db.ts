import { isGenericVenue, SERIES_VENUE_MAP } from "./normalize";
import type { Screening } from "./types";

type Row = Record<string, unknown>;

function str(row: Row, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== "") return String(v);
  }
  return "";
}

function num(row: Row, keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function bool(row: Row, keys: string[]): boolean {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "boolean") return v;
    if (v === "true" || v === 1) return true;
    if (v === "false" || v === 0) return false;
  }
  return false;
}

function isoDate(raw: unknown): string {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "string") return raw.slice(0, 10);
  return "";
}

function status(raw: unknown): "confirmed" | "tbc" {
  if (raw === "tbc") return "tbc";
  return "confirmed";
}

/**
 * Maps a Supabase `screenings` row to {@link Screening}. Supports both camelCase
 * (matching our TS type) and snake_case column names from Postgres.
 */
/**
 * Umbrella-org venues ("NYC Parks") get replaced with the real venue when
 * the listing title names a series with a fixed home (Fix Brief 1.6). The
 * organizer moves to hostOrg.
 */
function resolveVenue(venue: string, film: string, hostOrg: string) {
  if (!isGenericVenue(venue)) return { venue, hostOrg };
  const lower = film.toLowerCase();
  for (const [phrase, realVenue] of Object.entries(SERIES_VENUE_MAP)) {
    if (lower.includes(phrase)) {
      return { venue: realVenue, hostOrg: hostOrg || venue };
    }
  }
  return { venue, hostOrg };
}

export function screeningFromDb(row: Row): Screening {
  const resolved = resolveVenue(
    str(row, ["venue"]),
    str(row, ["film"]),
    str(row, ["hostOrg", "host_org"])
  );
  return {
    id: str(row, ["id"]),
    city: str(row, ["city", "city_slug"]),
    cityName: str(row, ["cityName", "city_name"]),
    venue: resolved.venue,
    hostOrg: resolved.hostOrg,
    address: str(row, ["address"]),
    neighbourhood: str(row, ["neighbourhood", "neighborhood"]),
    lat: num(row, ["lat"]),
    lng: num(row, ["lng"]),
    film: str(row, ["film"]),
    filmYear: Math.trunc(num(row, ["filmYear", "film_year"])),
    description: str(row, ["description"]),
    date: isoDate(row.date ?? row.screening_date),
    time: str(row, ["time", "screening_time"]),
    price: str(row, ["price"]),
    isFree: bool(row, ["isFree", "is_free"]),
    outdoorType: str(row, ["outdoorType", "outdoor_type"]),
    dogFriendly: bool(row, ["dogFriendly", "dog_friendly"]),
    wheelchairAccessible: bool(row, [
      "wheelchairAccessible",
      "wheelchair_accessible",
    ]),
    byoFood: bool(row, ["byoFood", "byo_food"]),
    bookingUrl: str(row, ["bookingUrl", "booking_url"]),
    listingUrl: str(row, ["listingUrl", "listing_url"]),
    imageUrl: str(row, ["imageUrl", "image_url"]),
    addedBy: str(row, ["addedBy", "added_by"]) || undefined,
    status: status(row.status),
  };
}
