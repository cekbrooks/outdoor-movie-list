import { NextResponse } from "next/server";

const PLACEHOLDER =
  process.env.CITY_SUGGESTION_WEBHOOK_URL ??
  "https://hooks.example.com/placeholder-n8n";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[api/suggest-city]", body);

    if (process.env.CITY_SUGGESTION_WEBHOOK_URL) {
      await fetch(process.env.CITY_SUGGESTION_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
    } else {
      console.log("[api/suggest-city] webhook placeholder:", PLACEHOLDER);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
