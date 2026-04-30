#!/usr/bin/env node
/**
 * Apply the 5 remaining BROKEN-source URL fixes and re-verify each via Jina.
 *
 * For each fix:
 *   1. PATCH the row in Supabase (matched on the original `name`).
 *   2. Fetch the NEW url through https://r.jina.ai/{url} with a 30s timeout.
 *   3. Classify and report.
 *
 * Idempotent: if the row was already updated in a previous run, the PATCH still
 * returns the row(s) and the verify step still runs. Re-running is safe.
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

// ----- the fixes -----
// `match` is the existing source name to PATCH against.
// `patch` is the JSON body of fields to update (url + optionally name).
const FIXES = [
  {
    match: "SummerScreen - Prospect Park",
    patch: { url: "https://www.summerscreen.org/home", name: "SummerScreen - McCarren Park" },
  },
  {
    match: "Vauxhall Summer Screens",
    patch: { url: "https://www.timeout.com/london/things-to-do/vauxhall-summer-screens" },
  },
  {
    match: "Rooftop Cinema Club - Peckham (Bussey Building)",
    patch: { url: "https://rooftopfilmclub.com/london/venue/peckham/" },
  },
  {
    match: "Rooftop Cinema Club - Stratford (Roof East)",
    patch: { url: "https://rooftopfilmclub.com/london/venue/stratford/" },
  },
  {
    match: "Rooftop Cinema Club NYC",
    patch: { url: "https://rooftopcinemaclub.com/new-york/venue/midtown/" },
  },
];

// ----- jina classifier (same heuristic as verify-sources.mjs, simplified) -----
function classify(body) {
  if (!body) return { tag: "BROKEN", note: "empty body" };
  const lower = body.toLowerCase();

  for (const sig of [
    "access denied",
    "404 not found",
    "page not found",
    "this page could not be found",
    "captcha",
    "503 service",
    "502 bad gateway",
  ]) {
    if (lower.includes(sig)) return { tag: "BROKEN", note: `signal: "${sig}"` };
  }
  if (/target url returned error 4\d\d|target url returned error 5\d\d/i.test(body)) {
    const m = body.match(/target url returned error \d{3}/i);
    return { tag: "BROKEN", note: m ? m[0] : "upstream error" };
  }
  if (body.length < 400) return { tag: "BROKEN", note: `tiny response (${body.length} chars)` };

  const filmHits = ["film", "movie", "screening", "cinema"].filter((k) => lower.includes(k)).length;
  const monthRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}/gi;
  const dates = (body.match(monthRe) || []).length;
  const isoDates = (body.match(/\b\d{4}-\d{2}-\d{2}\b/g) || []).length;
  const totalDates = dates + isoDates;
  const times = (body.match(/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/gi) || []).length;
  const has2026 = /\b2026\b/.test(body);
  const has2025 = /\b2025\b/.test(body);

  if (filmHits >= 1 && totalDates >= 2 && times >= 1 && (has2025 || has2026)) {
    return { tag: "GOOD", note: `films=${filmHits} dates=${totalDates} times=${times} ${has2026 ? "2026" : "2025"}` };
  }
  if (filmHits === 0 && totalDates < 2) {
    return { tag: "BROKEN", note: `no film/date signals (films=${filmHits} dates=${totalDates})` };
  }
  let why = `films=${filmHits} dates=${totalDates} times=${times}`;
  if (!has2025 && !has2026) why += " no recent year";
  return { tag: "THIN", note: why };
}

async function fetchJina(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const r = await fetch(`https://r.jina.ai/${url}`, { signal: ctrl.signal });
    const body = await r.text();
    return { ok: r.ok, status: r.status, size: body.length, body };
  } catch (e) {
    return { ok: false, status: 0, size: 0, body: "", error: e.name === "AbortError" ? "timeout (30s)" : e.message };
  } finally { clearTimeout(t); }
}

async function patch(name, patchBody) {
  const res = await fetch(`${REST}/sources?name=eq.${encodeURIComponent(name)}`, {
    method: "PATCH",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify(patchBody),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PATCH ${name} → ${res.status} ${res.statusText}: ${text}`);
  return JSON.parse(text);
}

// ----- main -----
console.log(`Applying ${FIXES.length} fixes...\n`);

const results = [];
for (let i = 0; i < FIXES.length; i++) {
  const f = FIXES[i];
  console.log(`[${i + 1}/${FIXES.length}] ${f.match}`);
  console.log(`  PATCH → ${JSON.stringify(f.patch)}`);
  let rows;
  try {
    rows = await patch(f.match, f.patch);
  } catch (e) {
    console.log(`  ✗ ${e.message}\n`);
    results.push({ name: f.match, status: "PATCH_FAILED", note: e.message, http: 0, size: 0 });
    continue;
  }
  if (rows.length === 0) {
    console.log(`  ⚠ no rows matched name="${f.match}" — was it already renamed?\n`);
    results.push({ name: f.match, status: "NO_MATCH", note: "no row matched name", http: 0, size: 0 });
    continue;
  }
  console.log(`  ✓ ${rows.length} row(s) updated; new url=${rows[0].url}${rows[0].name !== f.match ? `, new name=${rows[0].name}` : ""}`);
  console.log(`  Fetching via Jina...`);
  const j = await fetchJina(f.patch.url);
  if (j.error) {
    console.log(`  ✗ Jina: ${j.error}\n`);
    results.push({ name: rows[0].name, status: "FETCH_ERROR", note: j.error, http: 0, size: 0 });
    continue;
  }
  const c = classify(j.body);
  console.log(`  Result: ${c.tag} (HTTP ${j.status}, ${j.size}b) — ${c.note}\n`);
  results.push({ name: rows[0].name, status: c.tag, note: c.note, http: j.status, size: j.size });
  await new Promise((r) => setTimeout(r, 750));
}

// summary table
console.log("=== Summary ===");
console.log("Name | Status | HTTP | Size | Notes");
for (const r of results) {
  console.log(`${r.name} | ${r.status} | ${r.http} | ${r.size} | ${r.note}`);
}
const counts = results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {});
console.log(`\nCounts:`, counts);
