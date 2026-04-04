import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-safe defaults are omitted on the server so RSC / Route Handlers
 * do not touch `localStorage`. Use this factory per request in server code.
 */
export function createSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** Same as {@link createSupabaseClient} but returns `null` if env vars are missing (no throw). */
export function tryCreateSupabaseClient(): SupabaseClient | null {
  try {
    return createSupabaseClient();
  } catch {
    return null;
  }
}
