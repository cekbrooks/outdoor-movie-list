// Probe whether n8n is actually writing to Supabase.
//
// Looks at three signals:
//   1. sources.last_scraped — when did each active source last get touched?
//   2. screenings.created_at — how many rows were inserted in the last 24h / 7d?
//   3. screenings_snapshot — has the daily-update cron been writing snapshots?
//
// No writes; safe to run anytime.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1);
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i), v];
    })
);

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const now = Date.now();
const hoursAgo = (iso) =>
  iso ? Math.round((now - new Date(iso).getTime()) / 3_600_000) : null;
const daysAgo = (iso) =>
  iso ? +((now - new Date(iso).getTime()) / 86_400_000).toFixed(1) : null;

// ---------- 1. sources.last_scraped ----------
console.log("# sources.last_scraped (active only)\n");
const { data: sources, error: sErr } = await sb
  .from("sources")
  .select("name, city, last_scraped, active")
  .eq("active", true)
  .order("city", { ascending: true })
  .order("name", { ascending: true });
if (sErr) {
  console.log(`  ERROR: ${sErr.message}\n`);
} else {
  let neverScraped = 0;
  let stale = 0; // > 36h
  for (const s of sources) {
    const h = hoursAgo(s.last_scraped);
    const flag =
      h == null
        ? "NEVER"
        : h > 36
        ? "STALE"
        : "OK";
    if (h == null) neverScraped++;
    else if (h > 36) stale++;
    const age = h == null ? "never" : `${h}h`;
    console.log(`  [${flag.padEnd(5)}] ${s.city.padEnd(9)} ${s.name.padEnd(50)} ${age}`);
  }
  console.log(
    `\n  ${sources.length} active sources · ${neverScraped} never scraped · ${stale} stale (>36h)\n`
  );
}

// ---------- 2. screenings.created_at recency ----------
console.log("# screenings.created_at — recent inserts\n");
const buckets = [
  { label: "last 24h", hours: 24 },
  { label: "last 7d", hours: 168 },
  { label: "last 30d", hours: 720 },
];
for (const b of buckets) {
  const cutoff = new Date(now - b.hours * 3_600_000).toISOString();
  const { count, error } = await sb
    .from("screenings")
    .select("*", { count: "exact", head: true })
    .gte("created_at", cutoff);
  if (error) {
    console.log(`  ${b.label.padEnd(10)}  ERROR: ${error.message}`);
  } else {
    console.log(`  ${b.label.padEnd(10)}  ${count ?? 0} rows`);
  }
}

// Most recent few inserts
const { data: recent, error: rErr } = await sb
  .from("screenings")
  .select("created_at, city, venue, film, date")
  .order("created_at", { ascending: false })
  .limit(5);
if (rErr) {
  console.log(`\n  recent rows ERROR: ${rErr.message}`);
} else if (recent.length === 0) {
  console.log("\n  no rows in screenings");
} else {
  console.log("\n  most recent inserts:");
  for (const r of recent) {
    console.log(
      `    ${r.created_at}  ${r.city.padEnd(9)} ${r.venue.padEnd(40)} ${r.date}  ${r.film.slice(0, 40)}`
    );
  }
}

// ---------- 3. screenings_snapshot history ----------
console.log("\n# screenings_snapshot — daily-update cron history\n");
const { data: snaps, error: snErr } = await sb
  .from("screenings_snapshot")
  .select("snapshot_date, row_count, created_at")
  .order("snapshot_date", { ascending: false })
  .limit(7);
if (snErr) {
  console.log(`  ERROR: ${snErr.message}`);
} else if (!snaps || snaps.length === 0) {
  console.log("  (no snapshots yet — cron has not produced one)");
} else {
  for (const s of snaps) {
    console.log(
      `  ${s.snapshot_date}  rows=${String(s.row_count).padStart(4)}  written ${daysAgo(s.created_at)}d ago`
    );
  }
}

console.log("\n# verdict\n");
const anyRecent = (await sb
  .from("screenings")
  .select("*", { count: "exact", head: true })
  .gte("created_at", new Date(now - 24 * 3_600_000).toISOString())).count ?? 0;
const anyScrapedRecently = (sources || []).some(
  (s) => hoursAgo(s.last_scraped) != null && hoursAgo(s.last_scraped) <= 36
);
if (anyRecent > 0 || anyScrapedRecently) {
  console.log(
    `  n8n appears ACTIVE (${anyRecent} screenings written in last 24h; ${
      (sources || []).filter((s) => hoursAgo(s.last_scraped) != null && hoursAgo(s.last_scraped) <= 36).length
    } sources scraped in last 36h)`
  );
} else {
  console.log(
    "  n8n appears IDLE — no recent screening inserts and no sources scraped in 36h"
  );
  console.log(
    "  Tomorrow's 07:00 UTC daily-update will email a 'no changes' diff unless n8n runs first."
  );
}
