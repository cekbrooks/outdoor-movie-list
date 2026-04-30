// Pull venue metadata from existing seeded screenings, grouped by source name.
// Output: a JSON map of { source_name -> { address, neighbourhood, lat, lng,
// outdoor_type, dog_friendly, wheelchair_accessible, byo_food, host_org } }
// for use as defaults on the `sources` table.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1);
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [l.slice(0, i), v];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Active sources we want to map defaults for
const { data: sources } = await sb.from("sources").select("name, city").eq("active", true);

// Pull all seeded screenings (44 rows total)
const { data: rows } = await sb
  .from("screenings")
  .select("venue, host_org, address, neighbourhood, lat, lng, outdoor_type, dog_friendly, wheelchair_accessible, byo_food, city");

console.log(`Active sources: ${sources.length}`);
console.log(`Seeded screenings: ${rows.length}\n`);

// For each source, find the most common venue/metadata in the seeded data.
// Strategy: match by source name prefix (before " - ") against venue.
function venueMatchesSource(venue, sourceName) {
  if (!venue || !sourceName) return false;
  const v = venue.toLowerCase();
  const s = sourceName.toLowerCase();
  const prefix = s.split(" - ")[0];
  if (v.includes(prefix)) return true;
  if (s.includes(v) || v.includes(s)) return true;
  return false;
}

const result = {};
for (const src of sources) {
  const matches = rows.filter((r) => r.city === src.city && venueMatchesSource(r.venue, src.name));
  if (matches.length === 0) {
    result[src.name] = { _seeded: 0 };
    continue;
  }
  // Use the first match — they should be consistent for single-venue sources.
  const m = matches[0];
  result[src.name] = {
    _seeded: matches.length,
    venue_for_unique_sources: m.venue,
    host_org: m.host_org,
    address: m.address,
    neighbourhood: m.neighbourhood,
    lat: m.lat,
    lng: m.lng,
    outdoor_type: m.outdoor_type,
    dog_friendly: m.dog_friendly,
    wheelchair_accessible: m.wheelchair_accessible,
    byo_food: m.byo_food,
  };
}

console.log(JSON.stringify(result, null, 2));
