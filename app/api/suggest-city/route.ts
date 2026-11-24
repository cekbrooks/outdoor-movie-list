import { after, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Saves a city request, then hands it to the n8n "OML City Sweep" workflow,
 * which finds outdoor cinema organisers for the city, adds them as sources,
 * creates the city page and runs the first scrape.
 *
 * The sweep is only called when both CITY_SUGGESTION_WEBHOOK_URL and
 * CITY_SWEEP_SECRET are set. The webhook call runs in after(), so it is not
 * cut off when the response is sent (a fire-and-forget fetch can be).
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

    const webhookUrl = process.env.CITY_SUGGESTION_WEBHOOK_URL;
    const secret = process.env.CITY_SWEEP_SECRET;
    if (webhookUrl && secret) {
      after(async () => {
        try {
          await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-oml-sweep-secret": secret,
            },
            // Only the city goes to n8n; the requester's name and email stay
            // in the city_suggestions table.
            body: JSON.stringify({ cityName }),
            signal: AbortSignal.timeout(10_000),
          });
        } catch (e) {
          console.error("[api/suggest-city] sweep webhook failed:", e);
        }
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
