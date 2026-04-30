#!/usr/bin/env node
/**
 * Final pass: switch the three Rooftop venues to evergreen aggregator URLs
 * (Time Out for London, DoNYC for NYC). Verifies each via Jina before PATCH —
 * if any URL doesn't return schedule data, that PATCH is skipped and reported.
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

const FIXES = [
  {
    name: "Rooftop Cinema Club - Peckham (Bussey Building)",
    url: "https://www.timeout.com/london/film/rooftop-film-club-peckham-rye",
  },
  {
    name: "Rooftop Cinema Club - Stratford (Roof East)",
    url: "https://www.timeout.com/london/film/rooftop-film-club-stratford",
  },
  {
    name: "Rooftop Cinema Club NYC",
    url: "https://donyc.com/venues/rooftop-cinema-club-midtown",
  },
];

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
  if (!body || body.length < 400) return { tag: "BROKEN", dates: 0, films: 0 };
  if (/target url returned error \d{3}/i.test(body)) {
    const m = body.match(/target url returned error \d{3}/i);
    return { tag: "BROKEN", dates: 0, films: 0, why: m && m[0] };
  }
  const lower = body.toLowerCase();
  const films = ["film", "movie", "screening", "cinema"].filter((k) => lower.includes(k)).length;
  const monthRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}/gi;
  const dates = (body.match(monthRe) || []).length + (body.match(/\b\d{4}-\d{2}-\d{2}\b/g) || []).length;
  const has2026 = /\b2026\b/.test(body);
  let tag = "THIN";
  if (films >= 1 && dates >= 2 && has2026) tag = "GOOD";
  else if (films === 0 && dates < 2) tag = "BROKEN";
  return { tag, dates, films, has2026 };
}

console.log("Probing then patching three rooftop URLs...\n");
for (let i = 0; i < FIXES.length; i++) {
  const f = FIXES[i];
  console.log(`[${i + 1}/${FIXES.length}] ${f.name}`);
  console.log(`  candidate: ${f.url}`);
  const r = await fetchJina(f.url);
  if (r.error) { console.log(`  ✗ Jina error: ${r.error}\n`); continue; }
  const s = score(r.body);
  console.log(`  scored: ${s.tag} (HTTP ${r.status}, ${r.size}b, films=${s.films}, dates=${s.dates}, 2026=${s.has2026})`);
  if (s.tag === "GOOD") {
    const res = await fetch(`${REST}/sources?name=eq.${encodeURIComponent(f.name)}`, {
      method: "PATCH",
      headers: { ...HEADERS, Prefer: "return=representation" },
      body: JSON.stringify({ url: f.url }),
    });
    const t = await res.text();
    if (!res.ok) console.log(`  ✗ PATCH failed: ${res.status} ${t}\n`);
    else console.log(`  ✓ PATCHed; new url=${JSON.parse(t)[0]?.url}\n`);
  } else {
    console.log(`  ⊘ skipping PATCH — only apply when scored GOOD\n`);
  }
  await new Promise((r) => setTimeout(r, 600));
}

// Final state — confirm DB
console.log("=== Final URLs in DB ===");
for (const f of FIXES) {
  const res = await fetch(`${REST}/sources?select=name,url&name=eq.${encodeURIComponent(f.name)}`, { headers: HEADERS });
  const rows = await res.json();
  for (const row of rows) console.log(`  ${row.name}: ${row.url}`);
}
