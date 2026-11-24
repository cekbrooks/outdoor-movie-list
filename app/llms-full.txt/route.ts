import { buildLlmsFullTxt, TEXT_HEADERS } from "@/lib/llms";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(await buildLlmsFullTxt(), { headers: TEXT_HEADERS });
}
