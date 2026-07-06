/**
 * Title + venue normalization used for cross-source deduplication.
 *
 * Mirrors the SQL in lib/migrations/003-dedupe-normalization.sql — keep the
 * two in sync. The DB-side generated columns handle upsert-time collapse;
 * this TS layer handles render-time collapse and the hygiene cron's fuzzy
 * merge pass.
 */

/** Known UK/US (and variant) title pairs, applied AFTER basic normalization. */
export const TITLE_ALIASES: Record<string, string> = {
  zootropolis: "zootopia",
  "zootropolis 2": "zootopia 2",
  "harry potter and the sorcerers stone":
    "harry potter and the philosophers stone",
  moana: "moana",
  vaiana: "moana",
  "vaiana 2": "moana 2",
};

/**
 * Series/host prefixes that sources prepend to film titles
 * ("Movies With A View: Clueless" → "Clueless").
 */
export const SERIES_PREFIXES = [
  "movies with a view",
  "big screen at the battery",
  "brooklyn bridge park movies with a view",
  "movie nights",
  "movie night",
  "outdoor cinema",
  "open air cinema",
  "rooftop film club",
  "summer screen",
  "sunset cinema",
  "films on the green",
  "free summer movies",
  "syfy movies with a view",
];

const MONTHS =
  "january|february|march|april|may|june|july|august|september|october|november|december";

const DATE_LIKE = new RegExp(
  `^(${MONTHS})\\s+\\d{1,2}(\\s+\\d{4})?$|^\\d{1,2}\\s+(${MONTHS})(\\s+\\d{4})?$`,
  "i"
);

/**
 * Venue/series phrases that can make up an ENTIRE "title" when a source
 * lists the series rather than the film ("Brooklyn Bridge Park Movies With
 * A View presented by Persol"). Stripped when testing for placeholders.
 */
const SERIES_NOISE = [
  "brooklyn bridge park",
  "movies with a view",
  "big screen at the battery",
  "the battery",
  "bryant park",
  "pier 1",
  "films on the green",
  "summer movie nights",
  "movie nights",
  "movie night",
  "outdoor cinema",
  "open air cinema",
  "syfy",
];

/** True when a "title" is a placeholder or series name, not a real film. */
export function isTbcTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t) return true;
  if (/^(tbc|tba|tbd)\b/.test(t)) return true;
  if (/^to be (confirmed|announced|decided)/.test(t)) return true;
  if (/^(film |title |screening )?(tbc|tba|announced)/.test(t)) return true;
  if (DATE_LIKE.test(t)) return true;
  if (new RegExp(`announced(\\s+(${MONTHS}))?\\s*\\d{4}`, "i").test(t)) {
    return true;
  }
  if (/^various\b|^rolling\b/.test(t)) return true;

  // Series-only titles: normalize, drop "presented by …", series/venue
  // phrases, and years — if nothing film-like remains, it's a placeholder.
  let rest = normalizeTitle(title);
  rest = rest.replace(/\b(presented|sponsored)\s+by\s+\w+( \w+)?/g, " ");
  for (const phrase of SERIES_NOISE) {
    rest = rest.replace(new RegExp(phrase.replace(/ /g, "\\s+"), "g"), " ");
  }
  rest = rest.replace(/\b(19|20)\d{2}\b/g, " ").replace(/\s+/g, " ").trim();
  if (!rest || DATE_LIKE.test(rest)) return true;
  return false;
}

/**
 * Marketing fluff vocabulary: extra words that do NOT make two titles
 * different films ("By George — Documentary World Premiere" ≡ "By George").
 */
const FLUFF_WORDS = new Set([
  "documentary",
  "world",
  "premiere",
  "screening",
  "anniversary",
  "edition",
  "special",
  "event",
  "live",
  "outdoor",
  "cinema",
  "movie",
  "night",
  "presented",
  "sponsored",
  "by",
  "feat",
  "featuring",
  "the",
  "a",
  "an",
  "sing",
  "along",
  "quote",
]);

const SEQUEL_TOKEN = /^(\d+|ii|iii|iv|v|vi|vii|viii|ix|x)$/;

/** "superman 2" → { base: "superman", seq: "2" }; "superman" → seq "". */
function splitSequel(t: string): { base: string; seq: string } {
  const words = t.split(" ");
  const last = words[words.length - 1];
  if (words.length > 1 && SEQUEL_TOKEN.test(last)) {
    return { base: words.slice(0, -1).join(" "), seq: last };
  }
  return { base: t, seq: "" };
}

/** Same film? Handles fluff-suffix variants beyond plain similarity. */
export function sameTitle(normA: string, normB: string): boolean {
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  // Sequel guard: "superman" vs "superman 2" are different films, however
  // similar the strings are.
  const sa = splitSequel(normA);
  const sb = splitSequel(normB);
  if (sa.seq !== sb.seq && (sa.base === sb.base || titleSimilarity(sa.base, sb.base) >= 0.75)) {
    return false;
  }
  if (titleSimilarity(normA, normB) >= 0.75) return true;
  const [shorter, longer] =
    normA.length <= normB.length ? [normA, normB] : [normB, normA];
  if (shorter.length >= 4 && longer.startsWith(shorter + " ")) {
    const extra = longer.slice(shorter.length).trim().split(/\s+/);
    // Extra words must all be fluff (a digit like "2" means a sequel — keep).
    if (extra.every((w) => FLUFF_WORDS.has(w))) return true;
  }
  return false;
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Normalize a film title for comparison: lowercase, strip punctuation,
 * trailing years, and known series prefixes; apply alias mapping.
 */
export function normalizeTitle(raw: string): string {
  let t = stripDiacritics(raw.trim().toLowerCase());

  // Strip a known series prefix before a colon/dash separator.
  const sepMatch = t.match(/^(.{2,60}?)\s*[:–—-]\s+(.+)$/);
  if (sepMatch) {
    const prefix = sepMatch[1].replace(/[^a-z0-9 ]/g, "").trim();
    if (SERIES_PREFIXES.some((p) => prefix === p || prefix.endsWith(p))) {
      t = sepMatch[2];
    }
  }

  t = t
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  // Strip trailing "(YYYY)" remnants / bare trailing years.
  t = t.replace(/\s+(19|20)\d{2}$/, "").trim();

  // Strip sing-along/quote-along suffixes so variants collapse.
  t = t.replace(/\s+(sing a long|sing along|quote along)$/, "").trim();

  return TITLE_ALIASES[t] || t;
}

/**
 * Series phrase → the venue that series always runs at. Lets us recover the
 * real venue when a source lists the organizer ("NYC Parks") as the venue
 * but the listing title names the series (Fix Brief 1.6).
 */
export const SERIES_VENUE_MAP: Record<string, string> = {
  "big screen at the battery": "The Battery",
  "movies with a view": "Brooklyn Bridge Park",
  "bryant park movie nights": "Bryant Park",
};

/** Organizer names that are NOT real venues (umbrella orgs / touring hosts). */
export const GENERIC_VENUES = [
  "nyc parks",
  "nyc parks department",
  "new york city parks",
  "the luna cinema",
  "luna cinema",
  "adventure cinema",
  "backyard cinema",
  "various venues",
  "various",
  "multiple venues",
];

/** Venue aliases → canonical venue (lowercased normalized keys). */
export const VENUE_ALIASES: Record<string, string> = {
  "brooklyn bridge park pier 1": "brooklyn bridge park",
  "brooklyn bridge park - pier 1": "brooklyn bridge park",
  "pier 1 brooklyn bridge park": "brooklyn bridge park",
  "pier 1": "brooklyn bridge park",
  "the battery park": "the battery",
  "battery park": "the battery",
  "bryant park lawn": "bryant park",
  "vauxhall pleasure gardens london": "vauxhall pleasure gardens",
};

export function normalizeVenue(raw: string): string {
  let v = stripDiacritics(raw.trim().toLowerCase())
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (VENUE_ALIASES[v]) v = VENUE_ALIASES[v];
  return v;
}

export function isGenericVenue(raw: string): boolean {
  const v = normalizeVenue(raw);
  return GENERIC_VENUES.some((g) => v === normalizeVenue(g));
}

/** Sørensen–Dice bigram similarity, 0..1. */
export function titleSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) || 0) + 1);
    }
    return m;
  };
  const ma = bigrams(a);
  const mb = bigrams(b);
  let overlap = 0;
  for (const [bg, ca] of ma) overlap += Math.min(ca, mb.get(bg) || 0);
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

/** Venue compatibility for dedupe: equal, containment, generic org, or fuzzy. */
export function venuesCompatible(a: string, b: string): boolean {
  const va = normalizeVenue(a);
  const vb = normalizeVenue(b);
  if (!va || !vb) return true;
  if (va === vb) return true;
  if (isGenericVenue(a) || isGenericVenue(b)) return true;
  if (va.includes(vb) || vb.includes(va)) return true;
  return titleSimilarity(va, vb) >= 0.65;
}

/** Minutes between two "HH:MM" times; large number when unparseable. */
export function minutesBetween(t1: string, t2: string): number {
  const parse = (t: string) => {
    const m = t.match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  };
  const a = parse(t1);
  const b = parse(t2);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0; // unknown times → assume same
  return Math.abs(a - b);
}
