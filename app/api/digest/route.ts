import { NextRequest, NextResponse } from "next/server";
import { fetchCities, fetchUpcomingScreenings } from "@/lib/data";
import { isThisWeekend, isWithinNextDays, todayInCity } from "@/lib/dates";
import { filmSlug, venueSlug } from "@/lib/queries";
import { visibleUpcoming } from "@/lib/screening-utils";
import { SITE_URL } from "@/lib/seo";
import type { Screening } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * "This weekend in {city}" digest (Fix Brief Phase 4), as markdown.
 *
 *   /api/digest                 → all cities
 *   /api/digest?city=new-york   → one city
 *   /api/digest?days=7          → next-7-days window instead of the weekend
 *
 * Feeds the Beehiiv weekly email and Reddit drafts (posting stays manual).
 */

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function lines(city: { slug: string; name: string }, rows: Screening[]): string {
  const out: string[] = [];
  out.push(`## This weekend in ${city.name}`);
  out.push("");
  if (rows.length === 0) {
    out.push("_No outdoor screenings this weekend — check the full list for what's next._");
  } else {
    const byDate = new Map<string, Screening[]>();
    for (const s of rows) {
      const g = byDate.get(s.date);
      if (g) g.push(s);
      else byDate.set(s.date, [s]);
    }
    for (const date of [...byDate.keys()].sort()) {
      out.push(`### ${fmtDate(date)}`);
      out.push("");
      for (const s of byDate.get(date) || []) {
        const time = s.time ? ` at ${s.time}` : "";
        const price = s.isFree ? "Free" : s.price || "Ticketed";
        const movieUrl = `${SITE_URL}/movies/${filmSlug(s.film, s.filmYear)}`;
        const venueUrl = `${SITE_URL}/venues/${venueSlug(s.venue)}`;
        out.push(
          `- **[${s.film}](${movieUrl})** — [${s.venue}](${venueUrl})${time} · ${price}${s.bookingUrl ? ` · [Book](${s.bookingUrl})` : ""}`
        );
      }
      out.push("");
    }
  }
  out.push(`[All ${city.name} listings →](${SITE_URL}/${city.slug})`);
  out.push("");
  return out.join("\n");
}

export async function GET(req: NextRequest) {
  const cityParam = req.nextUrl.searchParams.get("city");
  const days = Number(req.nextUrl.searchParams.get("days") || 0);

  const [cities, all] = await Promise.all([
    fetchCities(),
    fetchUpcomingScreenings(cityParam || undefined),
  ]);
  const targets = cities.filter((c) => !cityParam || c.slug === cityParam);
  if (targets.length === 0) {
    return NextResponse.json({ error: "unknown city" }, { status: 404 });
  }

  const visible = visibleUpcoming(all);
  const sections: string[] = [];
  sections.push(`# Outdoor Movie List — weekend digest`);
  sections.push("");
  sections.push(`_Generated ${todayInCity()} · ${SITE_URL}_`);
  sections.push("");
  for (const c of targets) {
    const rows = visible
      .filter((s) => s.city === c.slug)
      .filter((s) =>
        days > 0 ? isWithinNextDays(s.date, days, s.city) : isThisWeekend(s.date, s.city)
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    sections.push(lines(c, rows));
  }

  return new NextResponse(sections.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
}
