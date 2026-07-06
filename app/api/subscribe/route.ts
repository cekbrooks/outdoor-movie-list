import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Newsletter signup → Beehiiv (Fix Brief 2.2).
 *
 * Env (add in Vercel):
 *   BEEHIIV_API_KEY          — API key from Beehiiv → Settings → API
 *   BEEHIIV_PUBLICATION_ID   — "pub_…" id of the publication
 *
 * City preference is stored as a Beehiiv custom field ("city") so digests
 * can be segmented per city. Fails gracefully when env is unset. Resend was
 * removed earlier after build failures — do not reintroduce it here.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { email?: string; cityPreference?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request." },
      { status: 400 }
    );
  }

  const email = (body.email || "").trim();
  const city = (body.cityPreference || "").trim();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, message: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  if (!apiKey || !pubId) {
    console.error("[api/subscribe] BEEHIIV_API_KEY / BEEHIIV_PUBLICATION_ID not set");
    return NextResponse.json(
      {
        ok: false,
        message: "Signups are momentarily offline — please try again soon.",
      },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          reactivate_existing: true,
          send_welcome_email: true,
          utm_source: "outdoormovielist.com",
          utm_medium: "site_form",
          ...(city
            ? { custom_fields: [{ name: "city", value: city }] }
            : {}),
        }),
      }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[api/subscribe] beehiiv error", res.status, detail);
      return NextResponse.json(
        { ok: false, message: "Something went wrong. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/subscribe] network error", e);
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Try again." },
      { status: 502 }
    );
  }
}
