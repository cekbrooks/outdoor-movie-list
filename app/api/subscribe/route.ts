import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      cityPreference?: string | null;
    };
    console.log("[api/subscribe]", {
      email: body.email,
      cityPreference: body.cityPreference,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
