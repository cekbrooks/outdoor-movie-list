#!/usr/bin/env node
/**
 * 1. Probe several candidate URLs for SummerScreen + the three Rooftop venues
 *    via Jina to find one whose plaintext output actually contains schedule
 *    dates.
 * 2. For SummerScreen, if any candidate is GOOD/THIN-with-dates, PATCH the row
 *    in Supabase to that URL.
 * 3. For the rooftop venues, just *report* findings — those URLs are
 *    correct-but-JS-rendered, and we don't want to swap them blindly.
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
const REST = `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const HEADERS = {
  apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

async function fetchJina(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const r = await fetch(`https://r.jina.ai/${url}`, { signal: ctrl.signal });
    const body = await r.text();
    return { ok: r.ok, status: r.status, size: body.length, body };
  } catch (e) {
    return { ok: false, status: 0, size: 0, body: "", error: e.name === "AbortError" ? "timeout" : e.message };
  } finally { clearTimeout(t); }
}

function score(body) {
  if (!body) return { tag: "EMPTY", dates: 0, films: 0, has2026: false, blocked: false };
  if (/target url returned error 4\d\d/i.test(body)) {
    const m = body.match(/target url returned error \d{3}/i);
    return { tag: "BLOCKED", dates: 0, films: 0, has2026: false, blocked: true, why: m && m[0] };
  }
  const lower = body.toLowerCase();
  const films = ["film", "movie", "screening", "cinema"].filter((k) => lower.includes(k)).length;
  const monthRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}/gi;
  const dates = (body.match(monthRe) || []).length + (body.match(/\b\d{4}-\d{2}-\d{2}\b/g) || []).length;
  const has2026 = /\b2026\b/.test(body);
  let tag;
  if (films >= 1 && dates >= 2 && has2026) tag = "GOOD";
  else if (films === 0 && dates < 2) tag = "BROKEN";
  else tag = "THIN";
  return { tag, dates, films, has2026, blocked: false };
}

async function probe(label, candidates) {
  console.log(`\n=== ${label} ===`);
  const results = [];
  for (const url of candidates) {
    process.stdout.write(`  ${url} ... `);
    const r = await fetchJina(url);
    if (r.error) { console.log(`error: ${r.error}`); results.push({ url, ...r, score: null }); continue; }
    const s = score(r.body);
    console.log(`${s.tag} (${r.status}, ${r.size}b, films=${s.films}, dates=${s.dates}, 2026=${s.has2026}${s.blocked ? `, ${s.why}` : ""})`);
    results.push({ url, ...r, score: s });
    await new Promise((r) => setTimeout(r, 600));
  }
  return results;
}

// ---- candidate URL lists ----
const summerScreenCandidates = [
  "http://www.summerscreen.org/home",
  "https://www.summerscreen.org/home",
  "https://www.summerscreen.org",
  "https://summerscreen.org",
  "http://summerscreen.org",
  "https://www.summerscreen.org/2026",
  "https://donyc.com/summer-screen",
  "https://www.nyctourism.com/events/summerscreen/",
];
const peckhamCandidates = [
  "https://rooftopfilmclub.com/london/venue/peckham/",
  "https://rooftopfilmclub.com/london/",
  "https://www.flicks.co.uk/cinema/rooftop-film-club-peckham-bussey-building/",
  "https://www.timeout.com/london/film/rooftop-film-club-peckham-rye",
];
const stratfordCandidates = [
  "https://rooftopfilmclub.com/london/venue/stratford/",
  "https://rooftopfilmclub.com/london/",
  "https://www.flicks.co.uk/cinema/rooftop-film-club-stratford-roof-east/",
  "https://www.designmynight.com/london/blog/roof-east-stratford-reopening",
];
const nycCandidates = [
  "https://rooftopcinemaclub.com/new-york/venue/midtown/",
  "https://rooftopcinemaclub.com/new-york/",
  "https://donyc.com/venues/rooftop-cinema-club-midtown",
  "https://www.timeout.com/newyork/things-to-do/rooftop-cinema-club",
];

const summer = await probe("SummerScreen (will PATCH if winner found)", summerScreenCandidates);
const peckham = await probe("Rooftop Film Club Peckham (probe only)", peckhamCandidates);
const stratford = await probe("Rooftop Film Club Stratford (probe only)", stratfordCandidates);
const nyc = await probe("Rooftop Cinema Club NYC (probe only)", nycCandidates);

// pick winner per group: GOOD > THIN-with-dates > else nothing
function pickWinner(results) {
  const ok = results.filter((r) => r.score && r.score.tag === "GOOD");
  if (ok.length) return ok[0];
  const thinWithDates = results.filter((r) => r.score && r.score.tag === "THIN" && r.score.dates >= 2 && r.score.has2026);
  if (thinWithDates.length) return thinWithDates[0];
  return null;
}

const summerWinner = pickWinner(summer);
console.log("\n=== Decisions ===");
if (summerWinner) {
  console.log(`SummerScreen: PATCH to ${summerWinner.url}`);
  const res = await fetch(`${REST}/sources?name=eq.${encodeURIComponent("SummerScreen - McCarren Park")}`, {
    method: "PATCH",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ url: summerWinner.url }),
  });
  const t = await res.text();
  if (!res.ok) console.log(`  PATCH failed: ${res.status} ${t}`);
  else console.log(`  ✓ updated: ${JSON.parse(t)[0]?.url}`);
} else {
  console.log("SummerScreen: no candidate scored GOOD/THIN+dates — leaving DB at /home (404). Suggest manually deactivating until July or finding an alternate.");
}

console.log("\nPeckham/Stratford/NYC rooftop probes:");
for (const [name, results] of [["Peckham", peckham], ["Stratford", stratford], ["NYC", nyc]]) {
  const w = pickWinner(results);
  if (w) console.log(`  ${name}: better candidate found → ${w.url} (${w.score.tag}, dates=${w.score.dates})`);
  else console.log(`  ${name}: every probed URL was THIN-without-dates or BROKEN. Schedule is JS-rendered; n8n parser will need a different strategy (API, sitemap, or third-party feed).`);
}
