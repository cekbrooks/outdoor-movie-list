import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * On-demand revalidation (Phase 1.2).
 *
 * POST/GET /api/revalidate?secret=…            → busts every page + sitemap
 * POST/GET /api/revalidate?secret=…&path=/new-york → busts one path
 *
 * Auth: REVALIDATE_SECRET (falls back to CRON_SECRET). The n8n nightly
 * scrape should call this as its final step; the Vercel crons call it after
 * data-mutating runs.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.REVALIDATE_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const q = req.nextUrl.searchParams.get("secret");
  const h = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return q === secret || h === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const path = req.nextUrl.searchParams.get("path");
  const revalidated: string[] = [];
  if (path) {
    revalidatePath(path);
    revalidated.push(path);
  } else {
    // Layout-level bust cascades to every route in the app.
    revalidatePath("/", "layout");
    revalidated.push("/ (layout — all routes)");
  }
  return NextResponse.json({ ok: true, revalidated, at: new Date().toISOString() });
}

export const GET = handle;
export const POST = handle;
