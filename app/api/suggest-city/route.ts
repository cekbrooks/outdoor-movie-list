import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Saves a city request as a "pending" row in city_suggestions. The n8n
 * "OML City Sweep" workflow polls for pending rows every 30 minutes, finds
 * outdoor cinema organisers for the city, adds them as sources, creates the
 * city page and runs the first scrape. No secret or webhook URL is needed on
 * the site side.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cityName = typeof body.cityName === "string" ? body.cityName.trim() : "";
    const submitterName = typeof body.submitterName === "string" ? body.submitterName.trim() : "";
    const submitterEmail =
      typeof body.submitterEmail === "string" && body.submitterEmail.trim()
        ? body.submitterEmail.trim()
        : null;

    if (!cityName || !submitterName) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }
    if (cityName.length > 80) {
      return NextResponse.json({ ok: false, error: "City name is too long" }, { status: 400 });
    }

    const { error } = await supabase.from("city_suggestions").insert({
      city_name: cityName,
      suggested_by_name: submitterName,
      suggested_by_email: submitterEmail,
      status: "pending",
    });

    if (error) {
      console.error("[api/suggest-city] Supabase error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
