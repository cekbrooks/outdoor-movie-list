import { NextRequest, NextResponse } from "next/server";
import { todayInCity } from "@/lib/dates";
import { isTbcTitle, normalizeTitle } from "@/lib/normalize";
import { filmSlug } from "@/lib/queries";
import { screeningFromDb } from "@/lib/screening-from-db";
import {
  CITY_CENTERS,
  CITY_RADIUS_KM,
  dedupeScreenings,
} from "@/lib/screening-utils";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { haversineKm } from "@/lib/geo";
import type { Screening } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// Daily data-hygiene cron (Fix Brief Phase 1.7). Runs after the nightly
// scrape + poster enrichment:
//   1. Fuzzy merge pass — same city+date, close start times, similar
//      normalized titles → keep the most specific row, delete the rest,
//      log to dedupe_log.
//   2. TBC pass — rows whose "film" is a placeholder get status 'film_tbc'.
//   3. TMDB canonicalization sweep — fixes invented release years; when a
//      year change alters the movie slug, records a 301 in slug_redirects.
//   4. Sanity checks — anomalies written to data_issues.
//   5. On-demand revalidation so pages reflect the cleaned data.
// Every step tolerates missing tables (pre-migration) and reports per-step
// results in the response JSON.
// ---------------------------------------------------------------------------

type StepResult = { ok: boolean; detail: unknown };

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET || "";
  const q = req.nextUrl.searchParams.get("secret");
  return !!secret && (auth === `Bearer ${secret}` || q === secret);
}

async function mergePass(): Promise<StepResult> {
  const supabase = getSupabaseAdmin();
  const floor = todayInCity(); // merge only current/future rows
  const { data, error } = await supabase
    .from("screenings")
    .select("*")
    .gte("date", floor);
  if (error) return { ok: false, detail: error.message };

  const rows: Screening[] = (data || []).map((r) =>
    screeningFromDb(r as Record<string, unknown>)
  );
  const winners = new Set(dedupeScreenings(rows).map((s) => s.id));
  const losers = rows.filter((s) => !winners.has(s.id));
  if (losers.length === 0) return { ok: true, detail: { merged: 0 } };

  // Pair each loser with its winner for the log (same city+date group).
  const logRows = losers.map((l) => {
    const w = rows.find(
      (s) => winners.has(s.id) && s.city === l.city && s.date === l.date
    );
    return {
      kept_id: w?.id || null,
      removed_id: l.id,
      kept_key: w ? `${w.venue} | ${w.film}` : null,
      removed_key: `${l.venue} | ${l.film}`,
      reason: "hygiene-cron fuzzy merge",
    };
  });
  try {
    await supabase.from("dedupe_log").insert(logRows);
  } catch {
    /* table may not exist yet */
  }
  const { error: delErr } = await supabase
    .from("screenings")
    .delete()
    .in(
      "id",
      losers.map((l) => l.id)
    );
  if (delErr) return { ok: false, detail: delErr.message };
  return {
    ok: true,
    detail: { merged: losers.length, removed: logRows.map((r) => r.removed_key) },
  };
}

async function tbcPass(): Promise<StepResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("screenings")
    .select("id, film, status")
    .neq("status", "film_tbc");
  if (error) return { ok: false, detail: error.message };
  const ids = (data || [])
    .filter((r) => isTbcTitle(String(r.film || "")))
    .map((r) => r.id);
  if (ids.length === 0) return { ok: true, detail: { flagged: 0 } };
  const { error: upErr } = await supabase
    .from("screenings")
    .update({ status: "film_tbc" })
    .in("id", ids);
  if (upErr) return { ok: false, detail: upErr.message };
  return { ok: true, detail: { flagged: ids.length } };
}

type TmdbMovie = {
  title: string;
  release_date?: string;
  popularity?: number;
};

async function tmdbLookup(
  title: string,
  key: string
): Promise<TmdbMovie | null> {
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${encodeURIComponent(title)}&language=en-US&page=1`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: TmdbMovie[] };
  const target = normalizeTitle(title);
  // Exact normalized-title match only — low-confidence matches must never
  // invent a year (Fix Brief 1.4).
  const exact = (data.results || []).filter(
    (m) => normalizeTitle(m.title) === target && m.release_date
  );
  if (exact.length === 0) return null;
  exact.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  return exact[0];
}

async function tmdbYearSweep(limit = 40): Promise<StepResult> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return { ok: false, detail: "TMDB_API_KEY not set" };
  const supabase = getSupabaseAdmin();
  const floor = todayInCity();
  const { data, error } = await supabase
    .from("screenings")
    .select("id, film, film_year, date")
    .gte("date", floor)
    .neq("status", "film_tbc");
  if (error) return { ok: false, detail: error.message };

  // Suspect rows: film_year equals the screening year (the extractor's
  // default) — a real 2026 release will survive the exact-match check.
  const suspects = (data || []).filter(
    (r) =>
      r.film &&
      r.film_year &&
      String(r.film_year) === String(r.date || "").slice(0, 4)
  );

  const byTitle = new Map<string, { ids: string[]; year: number }>();
  for (const r of suspects) {
    const t = normalizeTitle(String(r.film));
    const entry = byTitle.get(t) || { ids: [], year: Number(r.film_year) };
    entry.ids.push(String(r.id));
    byTitle.set(t, entry);
  }

  const fixes: { title: string; from: number; to: number; rows: number }[] = [];
  const redirects: { from_slug: string; to_slug: string }[] = [];
  let checked = 0;

  for (const [, entry] of byTitle) {
    if (checked >= limit) break;
    checked++;
    const sample = suspects.find((r) => entry.ids.includes(String(r.id)));
    if (!sample) continue;
    const film = String(sample.film);
    const match = await tmdbLookup(film, key);
    await new Promise((r) => setTimeout(r, 150));
    if (!match?.release_date) continue;
    const realYear = Number(match.release_date.slice(0, 4));
    if (!realYear || realYear === entry.year || realYear > entry.year) continue;

    const { error: upErr } = await supabase
      .from("screenings")
      .update({ film_year: realYear })
      .in("id", entry.ids);
    if (upErr) continue;
    fixes.push({ title: film, from: entry.year, to: realYear, rows: entry.ids.length });
    redirects.push({
      from_slug: filmSlug(film, entry.year),
      to_slug: filmSlug(film, realYear),
    });
  }

  if (redirects.length > 0) {
    try {
      await supabase
        .from("slug_redirects")
        .upsert(redirects, { onConflict: "from_slug" });
    } catch {
      /* table may not exist yet */
    }
  }
  return { ok: true, detail: { checked, fixes } };
}

async function sanityChecks(): Promise<StepResult> {
  const supabase = getSupabaseAdmin();
  const floor = todayInCity();
  const { data, error } = await supabase
    .from("screenings")
    .select("*")
    .gte("date", floor);
  if (error) return { ok: false, detail: error.message };

  const issues: { screening_id: string; issue: string; detail: unknown }[] = [];
  for (const raw of data || []) {
    const s = screeningFromDb(raw as Record<string, unknown>);
    if (!s.venue) issues.push({ screening_id: s.id, issue: "missing_venue", detail: { film: s.film, date: s.date } });
    if (!s.date) issues.push({ screening_id: s.id, issue: "missing_date", detail: { film: s.film, venue: s.venue } });
    const hour = Number((s.time || "").slice(0, 2));
    if (s.time && (hour < 10 || hour > 23)) {
      issues.push({ screening_id: s.id, issue: "implausible_time", detail: { time: s.time, film: s.film, venue: s.venue } });
    }
    const center = CITY_CENTERS[s.city];
    if (center && s.lat && s.lng) {
      const km = haversineKm(s.lat, s.lng, center.lat, center.lng);
      if (km > CITY_RADIUS_KM) {
        issues.push({ screening_id: s.id, issue: "outside_city_radius", detail: { km: Math.round(km), venue: s.venue, city: s.city } });
      }
    }
    if (s.filmYear && s.date && s.filmYear > Number(s.date.slice(0, 4))) {
      issues.push({ screening_id: s.id, issue: "film_year_in_future", detail: { filmYear: s.filmYear, film: s.film } });
    }
  }
  let stored = false;
  if (issues.length > 0) {
    try {
      const { error: insErr } = await supabase.from("data_issues").insert(issues);
      stored = !insErr;
    } catch {
      stored = false;
    }
  }
  return { ok: true, detail: { found: issues.length, stored } };
}

async function bustCaches(origin: string): Promise<StepResult> {
  const secret = process.env.REVALIDATE_SECRET || process.env.CRON_SECRET;
  if (!secret) return { ok: false, detail: "no secret" };
  try {
    const res = await fetch(`${origin}/api/revalidate?secret=${secret}`, {
      method: "POST",
    });
    return { ok: res.ok, detail: await res.json() };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results: Record<string, StepResult> = {};
  results.merge = await mergePass();
  results.tbc = await tbcPass();
  results.tmdbYears = await tmdbYearSweep();
  results.sanity = await sanityChecks();
  results.revalidate = await bustCaches(req.nextUrl.origin);
  return NextResponse.json({ ok: true, at: new Date().toISOString(), results });
}

export const POST = GET;
