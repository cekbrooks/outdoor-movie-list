#!/usr/bin/env node
/**
 * Verify all active scraping sources end-to-end.
 *
 * 1. Apply pending data fixes (3 DELETEs + 3 URL UPDATEs).
 * 2. Fetch every active source through https://r.jina.ai/{url} with a 30s timeout.
 * 3. Classify each source as GOOD / THIN / BROKEN based on response content.
 * 4. Write a markdown report to verification-report.md in repo root.
 *
 * Usage:  node scripts/verify-sources.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------- env ----------
function loadEnvLocal() {
  const env = {};
  const text = readFileSync(join(ROOT, ".env.local"), "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

const env = loadEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const REST = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const HEADERS = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const url = `${REST}${path}`;
  const res = await fetch(url, { ...init, headers: { ...HEADERS, ...(init.headers || {}) } });
  const text = await res.text();
  let body = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    throw new Error(`Supabase ${init.method || "GET"} ${path} → ${res.status} ${res.statusText}: ${text}`);
  }
  return body;
}

// ---------- step 1: apply fixes ----------
async function applyFixes() {
  console.log("\n=== Step 1: applying data fixes ===");

  const deletes = ["Eltham Park", "Screen on the Green", "Fulham Palace"];
  for (const name of deletes) {
    const q = `name=eq.${encodeURIComponent(name)}`;
    try {
      const result = await rest(`/sources?${q}`, {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      });
      const n = Array.isArray(result) ? result.length : 0;
      console.log(`  DELETE name=${name}: ${n} row(s)`);
    } catch (e) {
      console.log(`  DELETE name=${name}: ERROR ${e.message}`);
    }
  }

  const updates = [
    { name: "Vauxhall Summer Screens", url: "https://beinvauxhall.com/article/vauxhall-summer-2025/" },
    { name: "Hudson River Park", url: "https://hudsonriverpark.org/visit/events/" },
    { name: "Movies with a View - Brooklyn Bridge Park", url: "https://brooklynbridgepark.org/events/movies-with-a-view/" },
  ];
  for (const u of updates) {
    const q = `name=eq.${encodeURIComponent(u.name)}`;
    try {
      const result = await rest(`/sources?${q}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ url: u.url }),
      });
      const n = Array.isArray(result) ? result.length : 0;
      console.log(`  UPDATE name=${u.name} → ${u.url}: ${n} row(s)`);
    } catch (e) {
      console.log(`  UPDATE name=${u.name}: ERROR ${e.message}`);
    }
  }
}

// ---------- step 2: query active sources ----------
async function getActiveSources() {
  console.log("\n=== Step 2: fetching active sources ===");
  const rows = await rest(
    `/sources?select=id,city,name,url,scraper_type,active,last_scraped,notes&active=eq.true&order=city.asc,name.asc`
  );
  console.log(`  Found ${rows.length} active sources`);
  return rows;
}

// ---------- step 3: fetch each via Jina ----------
function classify(text) {
  if (!text) return { tag: "BROKEN", note: "empty body" };
  const len = text.length;
  const lower = text.toLowerCase();

  // Strong "broken" signals
  const blockedSignals = [
    "access denied",
    "404 not found",
    "page not found",
    "this page could not be found",
    "doesn't exist",
    "checking your browser",
    "captcha",
    "cloudflare",
    "503 service",
    "502 bad gateway",
    "this site can’t be reached",
  ];
  for (const sig of blockedSignals) {
    if (lower.includes(sig)) return { tag: "BROKEN", note: `blocked/error signal: "${sig}"` };
  }
  if (len < 400) return { tag: "BROKEN", note: `tiny response (${len} chars)` };

  // Screening signals
  const filmKeywords = ["film", "movie", "screening", "cinema", "outdoor cinema", "drive-in", "rooftop"];
  const filmHits = filmKeywords.filter((k) => lower.includes(k)).length;

  // Date signals: month names with day numbers, e.g. "May 12", "August 3rd", "12 June"
  const monthWord = "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)";
  const dateRe = new RegExp(`(\\b${monthWord}\\s+\\d{1,2}(st|nd|rd|th)?\\b)|(\\b\\d{1,2}\\s+${monthWord}\\b)|(\\b\\d{4}-\\d{2}-\\d{2}\\b)|(\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b)`, "gi");
  const dateMatches = text.match(dateRe) || [];

  // Time signals: 7pm, 8:30pm, 19:00, doors at 7
  const timeRe = /\b(\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2}:\d{2})\b/gi;
  const timeMatches = text.match(timeRe) || [];

  // Year signals (2025, 2026)
  const has2026 = /\b2026\b/.test(text);
  const has2025 = /\b2025\b/.test(text);

  // Off-season language
  const offSeasonHits = [
    "season has ended",
    "see you next",
    "coming soon",
    "stay tuned",
    "schedule will be announced",
    "to be announced",
    "tba",
    "check back",
    "summer 2026 schedule",
    "schedule coming",
  ].filter((k) => lower.includes(k));

  // Decision tree
  const meaningfulDates = dateMatches.length;
  const meaningfulTimes = timeMatches.length;

  if (filmHits >= 1 && meaningfulDates >= 2 && meaningfulTimes >= 1 && (has2025 || has2026)) {
    return {
      tag: "GOOD",
      note: `films=${filmHits} dates=${meaningfulDates} times=${meaningfulTimes} ${has2026 ? "2026" : has2025 ? "2025" : ""}`.trim(),
    };
  }

  if (filmHits === 0 && meaningfulDates < 2) {
    return {
      tag: "BROKEN",
      note: `no film/date signals (films=${filmHits} dates=${meaningfulDates})`,
    };
  }

  // Otherwise THIN
  let why = `films=${filmHits} dates=${meaningfulDates} times=${meaningfulTimes}`;
  if (offSeasonHits.length) why += ` off-season:"${offSeasonHits[0]}"`;
  if (!has2025 && !has2026) why += " no recent year";
  return { tag: "THIN", note: why };
}

async function fetchViaJina(url) {
  const target = `https://r.jina.ai/${url}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(target, {
      signal: ctrl.signal,
      headers: { Accept: "text/plain" },
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, size: body.length, body };
  } catch (e) {
    return { ok: false, status: 0, size: 0, body: "", error: e.name === "AbortError" ? "timeout (30s)" : e.message };
  } finally {
    clearTimeout(t);
  }
}

async function testSources(sources) {
  console.log("\n=== Step 3: testing each source via Jina ===");
  const results = [];
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    process.stdout.write(`  [${i + 1}/${sources.length}] ${s.city} / ${s.name} ... `);
    const r = await fetchViaJina(s.url);
    let status, note;
    if (r.error) {
      status = "BROKEN";
      note = `fetch error: ${r.error}`;
    } else if (!r.ok) {
      status = "BROKEN";
      note = `HTTP ${r.status}`;
    } else {
      const c = classify(r.body);
      status = c.tag;
      note = c.note;
    }
    console.log(`${status} (${r.status}, ${r.size}b) — ${note}`);
    results.push({
      name: s.name,
      city: s.city,
      url: s.url,
      scraper_type: s.scraper_type,
      http: r.status,
      size: r.size,
      status,
      note,
      bodySample: r.body ? r.body.slice(0, 600) : "",
    });
    // small delay to be polite to Jina
    await new Promise((r) => setTimeout(r, 750));
  }
  return results;
}

// ---------- step 4: write report ----------
function fmtBytes(n) {
  if (!n) return "0";
  if (n < 1024) return `${n}b`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}kb`;
  return `${(n / 1024 / 1024).toFixed(1)}mb`;
}

function writeReport(results) {
  const counts = { GOOD: 0, THIN: 0, BROKEN: 0 };
  for (const r of results) counts[r.status]++;

  const lines = [];
  lines.push("# Source verification report");
  lines.push("");
  lines.push(`Generated ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`**Totals:** ${results.length} active sources — ${counts.GOOD} GOOD · ${counts.THIN} THIN · ${counts.BROKEN} BROKEN`);
  lines.push("");
  lines.push("| Name | City | Status | HTTP | Size | Notes | Suggested Action |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const r of results) {
    let action = "";
    if (r.status === "GOOD") action = "Keep — ready for n8n parse.";
    else if (r.status === "THIN") action = "Recheck closer to season; consider deactivating until schedule posts.";
    else action = "Manual web search needed (script does not auto-fix BROKEN URLs).";
    const cells = [
      r.name,
      r.city,
      r.status,
      String(r.http || "—"),
      fmtBytes(r.size),
      (r.note || "").replace(/\|/g, "/"),
      action,
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }

  lines.push("");
  lines.push("## Source URL reference");
  lines.push("");
  for (const r of results) {
    lines.push(`- **${r.name}** (${r.city}, ${r.scraper_type}) → ${r.url}`);
  }

  lines.push("");
  lines.push("## Body samples (first 600 chars per BROKEN/THIN source)");
  for (const r of results) {
    if (r.status === "GOOD") continue;
    lines.push("");
    lines.push(`### ${r.name} — ${r.status}`);
    lines.push("```");
    lines.push((r.bodySample || "(empty)").slice(0, 600));
    lines.push("```");
  }

  const out = join(ROOT, "verification-report.md");
  writeFileSync(out, lines.join("\n"));
  console.log(`\nReport written to ${out}`);
  console.log(`Summary: ${counts.GOOD} GOOD · ${counts.THIN} THIN · ${counts.BROKEN} BROKEN`);
}

// ---------- main ----------
try {
  await applyFixes();
  const sources = await getActiveSources();
  const results = await testSources(sources);
  writeReport(results);
} catch (e) {
  console.error("\nFATAL:", e.message);
  process.exit(1);
}
