import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cityName, submitterName, submitterEmail } = body;

    if (!cityName || !submitterName) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const { error } = await supabase.from("city_suggestions").insert({
      city_name: cityName.trim(),
      suggested_by_name: submitterName.trim(),
      suggested_by_email: submitterEmail ? submitterEmail.trim() : null,
      status: "pending",
    });

    if (error) {
      console.error("[api/suggest-city] Supabase error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (process.env.CITY_SUGGESTION_WEBHOOK_URL) {
      fetch(process.env.CITY_SUGGESTION_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
