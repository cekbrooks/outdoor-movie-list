import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Daily update cron.
//
// Flow:
//   1. Verify the request came from Vercel Cron (Bearer ${CRON_SECRET}).
//   2. (Optional) POST to N8N_TRIGGER_URL to kick the n8n scrape, then wait
//      N8N_WAIT_MS milliseconds for it to finish.
//   3. Load all upcoming screenings (date >= today) — call this "today".
//   4. Load yesterday's snapshot from `screenings_snapshot`.
//   5. Diff: NEW = today − yesterday, REMOVED = yesterday − today,
//             EDITED = same key, different details.
//      Key = (city, venue, date, film) — matches the unique constraint on the
//      screenings table.
//   6. Load each active source's row count + last_scraped age (health table).
//   7. Email summary to CRON_NOTIFY_EMAIL via Resend.
//   8. Upsert today's snapshot.
// ---------------------------------------------------------------------------

type ScreeningRow = {
  id: string;
  city: string | null;
  venue: string;
  film: string;
  date: string;
  time: string;
  status: string;
  listing_url: string | null;
};

type SnapshotEntry = {
  k: string; // composite key
  city: string;
  venue: string;
  date: string;
  film: string;
  time: string;
  status: string;
  url: string;
};

function key(s: { city: string; venue: string; date: string; film: string }) {
  return [s.city, s.venue, s.date, s.film].map((x) => (x || "").trim().toLowerCase()).join("|");
}

function toEntry(row: ScreeningRow): SnapshotEntry {
  const city = (row.city || "").trim();
  const venue = (row.venue || "").trim();
  const date = (row.date || "").slice(0, 10);
  const film = (row.film || "").trim();
  return {
    k: key({ city, venue, date, film }),
    city,
    venue,
    date,
    film,
    time: (row.time || "").trim(),
    status: row.status || "confirmed",
    url: row.listing_url || "",
  };
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return isoDate(d);
}

async function maybeTriggerN8n(): Promise<{ called: boolean; ok?: boolean; error?: string }> {
  const url = process.env.N8N_TRIGGER_URL;
  if (!url) return { called: false };
  const auth = process.env.N8N_TRIGGER_AUTH;
  const waitMs = Number(process.env.N8N_WAIT_MS || 0);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: auth ? { Authorization: auth } : {},
    });
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
    return { called: true, ok: res.ok };
  } catch (e: unknown) {
    return { called: true, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function diffSnapshots(today: SnapshotEntry[], yesterday: SnapshotEntry[]) {
  const yMap = new Map(yesterday.map((e) => [e.k, e]));
  const tMap = new Map(today.map((e) => [e.k, e]));

  const added: SnapshotEntry[] = [];
  const edited: { now: SnapshotEntry; before: SnapshotEntry }[] = [];
  for (const t of today) {
    const y = yMap.get(t.k);
    if (!y) {
      added.push(t);
    } else if (y.time !== t.time || y.status !== t.status || y.url !== t.url) {
      edited.push({ now: t, before: y });
    }
  }
  const removed: SnapshotEntry[] = [];
  for (const y of yesterday) if (!tMap.has(y.k)) removed.push(y);
  return { added, removed, edited };
}

type SourceHealth = {
  name: string;
  city: string | null;
  active: boolean;
  scraper_type: string;
  last_scraped: string | null;
  hours_since: number | null;
  screenings_count: number;
};

async function getSourceHealth(): Promise<SourceHealth[]> {
  const supabase = getSupabaseAdmin();
  const { data: sources, error } = await supabase
    .from("sources")
    .select("name, city, active, scraper_type, last_scraped")
    .eq("active", true)
    .order("city", { ascending: true });
  if (error) throw new Error(`sources query: ${error.message}`);

  // For each source we want the count of upcoming screenings *attributed* to
  // it. The screenings table doesn't have a source_id FK, so we approximate by
  // matching on venue substring of the source name. This is heuristic; if you
  // add a source_id column later, swap it for an exact join.
  const today = isoDate(new Date());
  const out: SourceHealth[] = [];
  for (const s of sources || []) {
    const { count } = await supabase
      .from("screenings")
      .select("*", { count: "exact", head: true })
      .gte("date", today)
      .ilike("venue", `%${(s.name || "").split(" - ")[0]}%`);
    const hours = s.last_scraped
      ? Math.round((Date.now() - new Date(s.last_scraped).getTime()) / 3_600_000)
      : null;
    out.push({
      name: s.name,
      city: s.city,
      active: s.active,
      scraper_type: s.scraper_type,
      last_scraped: s.last_scraped,
      hours_since: hours,
      screenings_count: count || 0,
    });
  }
  return out;
}

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function escapeHtml(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmail(opts: {
  runDate: string;
  added: SnapshotEntry[];
  removed: SnapshotEntry[];
  edited: { now: SnapshotEntry; before: SnapshotEntry }[];
  health: SourceHealth[];
  n8n: { called: boolean; ok?: boolean; error?: string };
}) {
  const { runDate, added, removed, edited, health, n8n } = opts;

  const renderRow = (e: SnapshotEntry) =>
    `<li><strong>${escapeHtml(e.film)}</strong> — ${escapeHtml(fmtDate(e.date))}` +
    (e.time ? `, ${escapeHtml(e.time)}` : "") +
    ` · ${escapeHtml(e.venue)} (${escapeHtml(e.city)})</li>`;

  const renderEditRow = (e: { now: SnapshotEntry; before: SnapshotEntry }) => {
    const diffs: string[] = [];
    if (e.now.time !== e.before.time)
      diffs.push(`time ${escapeHtml(e.before.time)} → ${escapeHtml(e.now.time)}`);
    if (e.now.status !== e.before.status)
      diffs.push(`status ${escapeHtml(e.before.status)} → ${escapeHtml(e.now.status)}`);
    if (e.now.url !== e.before.url) diffs.push(`url changed`);
    return `<li><strong>${escapeHtml(e.now.film)}</strong> — ${escapeHtml(fmtDate(e.now.date))} · ${escapeHtml(e.now.venue)}<br/><span style="color:#666">${diffs.join(" · ")}</span></li>`;
  };

  const section = (title: string, count: number, body: string) =>
    count === 0
      ? `<h3 style="margin:24px 0 8px">${title} (0)</h3><p style="color:#888;margin:0">No changes today.</p>`
      : `<h3 style="margin:24px 0 8px">${title} (${count})</h3><ul style="margin:0;padding-left:20px">${body}</ul>`;

  const healthRows = health
    .map(
      (h) =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #eee">${escapeHtml(h.name)}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #eee">${escapeHtml(h.city || "")}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${h.screenings_count}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;color:${
            h.hours_since == null
              ? "#c00"
              : h.hours_since > 36
              ? "#c80"
              : "#666"
          }">${h.hours_since == null ? "never" : `${h.hours_since}h ago`}</td>
        </tr>`
    )
    .join("");

  const n8nLine = n8n.called
    ? `<p style="color:#666;margin:4px 0">n8n trigger: ${n8n.ok ? "OK" : `FAILED${n8n.error ? ` — ${escapeHtml(n8n.error)}` : ""}`}</p>`
    : `<p style="color:#888;margin:4px 0">n8n not triggered (N8N_TRIGGER_URL not set — relying on its own schedule)</p>`;

  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;padding:20px;color:#222">
  <h1 style="margin:0 0 4px">Outdoor Movie List — daily update</h1>
  <p style="color:#666;margin:0">Run for ${escapeHtml(runDate)} · <strong>${added.length}</strong> new · <strong>${removed.length}</strong> removed · <strong>${edited.length}</strong> edited</p>
  ${n8nLine}

  ${section("New screenings", added.length, added.map(renderRow).join(""))}
  ${section("Removed screenings", removed.length, removed.map(renderRow).join(""))}
  ${section("Edited screenings", edited.length, edited.map(renderEditRow).join(""))}

  <h3 style="margin:32px 0 8px">Source health</h3>
  <table style="border-collapse:collapse;width:100%;font-size:14px">
    <thead><tr style="text-align:left;border-bottom:2px solid #222">
      <th style="padding:6px 12px">Source</th>
      <th style="padding:6px 12px">City</th>
      <th style="padding:6px 12px;text-align:right">Upcoming</th>
      <th style="padding:6px 12px;text-align:right">Last scrape</th>
    </tr></thead>
    <tbody>${healthRows}</tbody>
  </table>

  <p style="color:#999;font-size:12px;margin-top:32px">Cron: /api/cron/daily-update — outdoormovielist.com</p>
</body></html>`;
}

async function sendEmail(html: string, subject: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CRON_NOTIFY_EMAIL;
  const from = process.env.CRON_FROM_EMAIL || "Outdoor Movie List <noreply@outdoormovielist.com>";
  if (!apiKey || !to) {
    return { sent: false, reason: "missing RESEND_API_KEY or CRON_NOTIFY_EMAIL" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const body = await res.text();
  if (!res.ok) return { sent: false, reason: `Resend ${res.status}: ${body}` };
  return { sent: true };
}

export async function GET(req: NextRequest) {
  // ---- 1. Auth ----
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const runDate = isoDate(new Date());
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  // ---- 2. Optional n8n trigger ----
  const n8n = await maybeTriggerN8n();

  // ---- 3. Today's screenings (upcoming) ----
  const { data: rows, error: rowsErr } = await supabase
    .from("screenings")
    .select("id, city, venue, film, date, time, status, listing_url")
    .gte("date", runDate);
  if (rowsErr) {
    return NextResponse.json({ error: `screenings query: ${rowsErr.message}` }, { status: 500 });
  }
  const today: SnapshotEntry[] = (rows || []).map(toEntry);

  // ---- 4. Yesterday's snapshot ----
  const yesterdayDate = daysAgo(1);
  const { data: snap, error: snapErr } = await supabase
    .from("screenings_snapshot")
    .select("snapshot_date, payload")
    .lte("snapshot_date", yesterdayDate)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (snapErr) {
    return NextResponse.json({ error: `snapshot query: ${snapErr.message}` }, { status: 500 });
  }
  const yesterday: SnapshotEntry[] = snap?.payload ? (snap.payload as SnapshotEntry[]) : [];
  const isFirstRun = !snap;

  // ---- 5. Diff ----
  const { added, removed, edited } = diffSnapshots(today, yesterday);

  // ---- 6. Source health ----
  let health: SourceHealth[] = [];
  try {
    health = await getSourceHealth();
  } catch (e: unknown) {
    // non-fatal
    console.error("source health failed:", e);
  }

  // ---- 7. Email ----
  const subject = isFirstRun
    ? `Outdoor Movie List — first daily run (${today.length} upcoming screenings tracked)`
    : `Outdoor Movie List — ${added.length} new · ${removed.length} removed · ${edited.length} edited`;
  const html = renderEmail({ runDate, added, removed, edited, health, n8n });
  const emailResult = await sendEmail(html, subject);

  // ---- 8. Save today's snapshot ----
  const { error: upErr } = await supabase
    .from("screenings_snapshot")
    .upsert({ snapshot_date: runDate, payload: today, row_count: today.length });
  if (upErr) {
    return NextResponse.json(
      { error: `snapshot upsert: ${upErr.message}`, emailResult },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    runDate,
    counts: {
      today: today.length,
      yesterday: yesterday.length,
      added: added.length,
      removed: removed.length,
      edited: edited.length,
    },
    n8n,
    isFirstRun,
    emailResult,
    sourcesChecked: health.length,
  });
}

// Allow POST for manual testing via curl with the same auth
export const POST = GET;
