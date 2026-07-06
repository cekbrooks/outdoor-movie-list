"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { City, Screening } from "@/lib/types";
import { NoScreenings } from "./NoScreenings";
import { ScreeningCard } from "./ScreeningCard";

type Props = {
  cities: City[];
  /** Visible upcoming screenings, all cities, sorted by date. */
  screenings: Screening[];
};

const STORAGE_KEY = "oml-city";

/** Best-guess city from the browser timezone — no geolocation prompt. */
function guessCity(cities: City[]): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz === "Europe/London" && cities.some((c) => c.slug === "london")) {
      return "london";
    }
    if (tz.startsWith("America/") && cities.some((c) => c.slug === "new-york")) {
      return "new-york";
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Homepage screening list (Fix Brief 2.1): leads with "This week in {city}"
 * for the visitor's detected/remembered city instead of dumping 100+ mixed-
 * city rows. Selection persists in localStorage.
 */
export function HomeScreenings({ cities, screenings }: Props) {
  const [city, setCity] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let initial: string | null = null;
    try {
      initial = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (!initial || !cities.some((c) => c.slug === initial)) {
      initial = guessCity(cities) || cities[0]?.slug || null;
    }
    setCity(initial);
    setReady(true);
  }, [cities]);

  function choose(slug: string) {
    setCity(slug);
    try {
      window.localStorage.setItem(STORAGE_KEY, slug);
    } catch {
      /* ignore */
    }
  }

  const cityMeta = cities.find((c) => c.slug === city) || null;

  const { thisWeek, later } = useMemo(() => {
    const mine = screenings.filter((s) => s.city === city);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 7);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    return {
      thisWeek: mine.filter((s) => s.date <= cutoffISO),
      later: mine.filter((s) => s.date > cutoffISO),
    };
  }, [screenings, city]);

  if (!ready) {
    // Render nothing city-specific during hydration to avoid a flash.
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0d1428]/50 p-12 text-center text-white/50">
        Loading screenings…
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {cities.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => choose(c.slug)}
            aria-pressed={city === c.slug}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
              city === c.slug
                ? "bg-[#f5a623] text-[#0a0f1e]"
                : "bg-white/5 text-white/65 ring-1 ring-white/10 hover:bg-white/10"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <h3 className="mt-10 font-display text-xl font-semibold text-[#f0ede8] md:text-2xl">
        This week in {cityMeta?.name || "your city"}
      </h3>
      <div className="mt-6">
        {thisWeek.length === 0 ? (
          <NoScreenings />
        ) : (
          <ul className="grid list-none gap-6 p-0">
            {thisWeek.map((s) => (
              <li key={s.id}>
                <ScreeningCard screening={s} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {later.length > 0 ? (
        <div className="mt-12">
          <h3 className="font-display text-xl font-semibold text-[#f0ede8]/80">
            Coming up later
          </h3>
          <ul className="mt-6 grid list-none gap-6 p-0">
            {later.slice(0, 8).map((s) => (
              <li key={s.id}>
                <ScreeningCard screening={s} />
              </li>
            ))}
          </ul>
          {city ? (
            <p className="mt-8 text-center">
              <Link
                href={`/${city}`}
                className="inline-flex rounded-full border border-[#f5a623]/50 px-8 py-3 text-sm font-semibold text-[#f5a623] transition hover:bg-[#f5a623]/10"
              >
                See all {cityMeta?.name} screenings →
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
