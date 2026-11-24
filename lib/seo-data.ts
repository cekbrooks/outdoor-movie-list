import { fetchCities } from "@/lib/data";
import { screeningFromDb } from "@/lib/screening-from-db";
import { supabase } from "@/lib/supabase";
import type { City, Screening } from "@/lib/types";

/**
 * Data access for crawler-facing routes (sitemap.xml, llms.txt).
 *
 * Supabase/PostgREST caps a plain select at 1,000 rows, so a single query
 * silently drops older listings once the table grows. These helpers page
 * through the whole table, and never throw: a crawler route that 500s is
 * worse than one that is briefly incomplete.
 */

const PAGE = 1000;
const MAX_ROWS = 50_000;

export type CrawlRow = { screening: Screening; createdAt: string | null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True when `d` is a real YYYY-MM-DD calendar date. */
export function isValidIsoDate(d: string | null | undefined): d is string {
  if (!d || !ISO_DATE.test(d)) return false;
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isFinite(t);
}

/** Parse a timestamp, returning null instead of an Invalid Date. */
export function safeDate(raw: unknown): Date | null {
  if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? raw : null;
  if (typeof raw !== "string" || raw === "") return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function fetchAllScreeningsForCrawlers(): Promise<CrawlRow[]> {
  const out: CrawlRow[] = [];
  try {
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await supabase
        .from("screenings")
        .select("*")
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !data) break;
      for (const row of data as Record<string, unknown>[]) {
        try {
          const s = screeningFromDb(row);
          if (!isValidIsoDate(s.date)) continue;
          const created = safeDate(row.created_at);
          out.push({ screening: s, createdAt: created ? created.toISOString() : null });
        } catch {
          /* skip a malformed row rather than fail the whole route */
        }
      }
      if (data.length < PAGE) break;
    }
  } catch {
    /* network or client error: return what we have */
  }
  return out;
}

export async function fetchCitiesForCrawlers(): Promise<City[]> {
  try {
    return await fetchCities();
  } catch {
    return [];
  }
}
