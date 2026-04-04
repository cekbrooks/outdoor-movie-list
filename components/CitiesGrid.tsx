"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { City } from "@/lib/types";
import type { Screening } from "@/lib/types";
import { isUpcoming } from "@/lib/dates";

type SortMode = "screenings" | "recent" | "az";

type Row = City & { count: number };

type Props = {
  cities: City[];
  screenings: Screening[];
};

export function CitiesGrid({ cities, screenings }: Props) {
  const [sort, setSort] = useState<SortMode>("screenings");
  const now = useMemo(() => new Date(), []);

  const rows: Row[] = useMemo(() => {
    return cities.map((c) => ({
      ...c,
      count: screenings.filter(
        (s) => s.city === c.slug && isUpcoming(s, now)
      ).length,
    }));
  }, [cities, screenings, now]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === "screenings") {
      copy.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    } else if (sort === "recent") {
      copy.sort((a, b) => {
        const da = a.addedDate ?? "";
        const db = b.addedDate ?? "";
        return db.localeCompare(da) || a.name.localeCompare(b.name);
      });
    } else {
      copy.sort((a, b) => a.name.localeCompare(b.name));
    }
    return copy;
  }, [rows, sort]);

  const launchSlugs = new Set(["new-york", "london"]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["screenings", "Most screenings"],
            ["recent", "Most recent"],
            ["az", "A–Z"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              sort === key
                ? "bg-[#f5a623] text-[#0a0f1e]"
                : "bg-white/5 text-white/65 ring-1 ring-white/10 hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/${c.slug}`}
              className="group block h-full rounded-2xl border border-white/10 bg-[#0d1428]/70 p-6 transition hover:-translate-y-0.5 hover:border-[#f5a623]/35 hover:shadow-[0_0_40px_-14px_rgba(245,166,35,0.3)]"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-2xl font-semibold text-[#f0ede8] group-hover:text-[#f5a623]">
                  {c.name}
                </h2>
                <span className="shrink-0 rounded-full bg-[#f5a623]/15 px-3 py-1 text-xs font-bold text-[#f5a623] ring-1 ring-[#f5a623]/25">
                  {c.count} upcoming
                </span>
              </div>
              <p className="mt-2 text-sm text-white/45">{c.country}</p>
              {c.addedBy ? (
                <p className="mt-4 text-sm text-white/55">
                  Added by{" "}
                  <span className="text-[#f0ede8]/90">{c.addedBy}</span>
                </p>
              ) : null}
              {launchSlugs.has(c.slug) ? (
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-[#f5a623]/90">
                  Launch Cities 🚀
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
