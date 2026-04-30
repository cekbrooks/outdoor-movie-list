#!/usr/bin/env node
/**
 * Apply the NYC Parks URL fix and verify the new URL via Jina.
 *
 *   old: https://www.nycgovparks.org/events/free-outdoor-movies   (403)
 *   new: https://www.nycgovparks.org/events/free_summer_movies
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = {};
  for (const raw of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[line.slice(0, eq).trim()] = v;
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const REST = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const HEADERS = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" };

const NEW_URL = "https://www.nycgovparks.org/events/free_summer_movies";
const SOURCE_NAME = "NYC Parks - Free Outdoor Movies";

console.log(`Updating "${SOURCE_NAME}" to: ${NEW_URL}`);
const patchRes = await fetch(`${REST}/sources?name=eq.${encodeURIComponent(SOURCE_NAME)}`, {
  method: "PATCH",
  headers: { ...HEADERS, Prefer: "return=representation" },
  body: JSON.stringify({ url: NEW_URL }),
});
const patchBody = await patchRes.text();
if (!patchRes.ok) {
  console.error(`Supabase PATCH failed: ${patchRes.status} ${patchRes.statusText}\n${patchBody}`);
  process.exit(1);
}
const rows = JSON.parse(patchBody);
console.log(`  rows updated: ${rows.length}`);
if (rows.length) console.log(`  new url in DB: ${rows[0].url}`);

console.log(`\nVerifying via Jina: https://r.jina.ai/${NEW_URL}`);
const ctrl = new AbortController();
const t = setTimeout(() => ctrl.abort(), 30_000);
let body = "", status = 0, size = 0;
try {
  const r = await fetch(`https://r.jina.ai/${NEW_URL}`, { signal: ctrl.signal });
  status = r.status;
  body = await r.text();
  size = body.length;
} catch (e) {
  console.error(`Jina fetch failed: ${e.message}`);
  process.exit(1);
} finally { clearTimeout(t); }

console.log(`  HTTP ${status}, ${size}b`);
const lower = body.toLowerCase();
const has403 = lower.includes("403") || lower.includes("forbidden");
const filmHits = ["film", "movie", "screening"].filter((k) => lower.includes(k)).length;
const monthRe = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi;
const dateMatches = (body.match(monthRe) || []).length;
const has2026 = /\b2026\b/.test(body);

console.log(`  403/forbidden in body: ${has403}`);
console.log(`  film/movie/screening keyword hits: ${filmHits}`);
console.log(`  month-day date matches: ${dateMatches}`);
console.log(`  2026 mentioned: ${has2026}`);

if (!has403 && filmHits >= 1 && dateMatches >= 2 && has2026) {
  console.log("\n✅ Looks healthy — NYC Parks source is now GOOD.");
} else if (has403) {
  console.log("\n❌ Still hitting 403 — try one of: /events/movies-under-the-stars, /events/free_summer_movies (with explicit https://www.). DB was still updated — revert or pick another URL.");
} else {
  console.log("\n⚠️  Page loads but signals are weak. Print the first 800 chars below for inspection:");
  console.log("---");
  console.log(body.slice(0, 800));
  console.log("---");
}
