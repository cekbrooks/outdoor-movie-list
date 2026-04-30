// Inspect the live screenings table columns by fetching one row.
// Also probes cities, sources, screenings_snapshot, email_subscribers,
// city_suggestions so we can write a faithful schema file.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1);
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i), v];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("missing supabase creds");
  process.exit(1);
}
const sb = createClient(url, key);

const tables = [
  "screenings",
  "cities",
  "sources",
  "screenings_snapshot",
  "email_subscribers",
  "city_suggestions",
];

for (const t of tables) {
  const { data, error } = await sb.from(t).select("*").limit(1);
  if (error) {
    console.log(`\n## ${t}\nERROR: ${error.message}`);
    continue;
  }
  if (!data || data.length === 0) {
    console.log(`\n## ${t}\n(empty — cannot infer columns)`);
    continue;
  }
  console.log(`\n## ${t}`);
  for (const [k, v] of Object.entries(data[0])) {
    const t = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
    const sample =
      v === null
        ? ""
        : ` :: ${JSON.stringify(v).slice(0, 60)}`;
    console.log(`  ${k} (${t})${sample}`);
  }
}
