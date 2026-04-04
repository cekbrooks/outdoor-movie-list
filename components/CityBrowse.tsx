"use client";

import { useMemo, useState } from "react";
import type { Screening } from "@/lib/types";
import { OUTDOOR_TYPES } from "@/lib/constants";
import { ScreeningCard } from "./ScreeningCard";
import { ScreeningsMap } from "./ScreeningsMap";

type PriceFilter = "all" | "free" | "paid";

type Props = {
  cityName: string;
  screenings: Screening[];
};

function parseISODate(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function CityBrowse({ cityName, screenings }: Props) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [price, setPrice] = useState<PriceFilter>("all");
  const [outdoor, setOutdoor] = useState<string>("All");
  const [dogOnly, setDogOnly] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");

  const filtered = useMemo(() => {
    return screenings.filter((s) => {
      if (dogOnly && !s.dogFriendly) return false;
      if (outdoor !== "All" && s.outdoorType !== outdoor) return false;
      if (price === "free" && !s.isFree) return false;
      if (price === "paid" && s.isFree) return false;
      const t = parseISODate(s.date);
      if (dateFrom) {
        const from = parseISODate(dateFrom);
        if (t < from) return false;
      }
      if (dateTo) {
        const to = parseISODate(dateTo);
        if (t > to) return false;
      }
      return true;
    });
  }, [screenings, dateFrom, dateTo, price, outdoor, dogOnly]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0d1428]/50 p-4 md:flex-row md:flex-wrap md:items-end md:gap-6 md:p-6">
        <label className="flex min-w-[140px] flex-col gap-1 text-xs font-medium uppercase tracking-wider text-white/45">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-white/15 bg-[#0a0f1e] px-3 py-2 text-sm text-[#f0ede8] focus:border-[#f5a623]/50 focus:outline-none focus:ring-2 focus:ring-[#f5a623]/20"
          />
        </label>
        <label className="flex min-w-[140px] flex-col gap-1 text-xs font-medium uppercase tracking-wider text-white/45">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-white/15 bg-[#0a0f1e] px-3 py-2 text-sm text-[#f0ede8] focus:border-[#f5a623]/50 focus:outline-none focus:ring-2 focus:ring-[#f5a623]/20"
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-medium uppercase tracking-wider text-white/45">
            Price
          </legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["free", "Free"],
                ["paid", "Paid"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setPrice(v)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  price === v
                    ? "bg-[#f5a623] text-[#0a0f1e]"
                    : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium uppercase tracking-wider text-white/45">
          Outdoor type
          <select
            value={outdoor}
            onChange={(e) => setOutdoor(e.target.value)}
            className="rounded-xl border border-white/15 bg-[#0a0f1e] px-3 py-2 text-sm text-[#f0ede8] focus:border-[#f5a623]/50 focus:outline-none focus:ring-2 focus:ring-[#f5a623]/20"
          >
            {OUTDOOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#f0ede8]/80">
          <input
            type="checkbox"
            checked={dogOnly}
            onChange={(e) => setDogOnly(e.target.checked)}
            className="size-4 rounded border-white/30 bg-[#0a0f1e] text-[#f5a623] focus:ring-[#f5a623]/40"
          />
          Dog friendly only
        </label>
        <div className="ml-auto flex rounded-full bg-[#0a0f1e] p-1 ring-1 ring-white/10">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              view === "list"
                ? "bg-[#f5a623] text-[#0a0f1e]"
                : "text-white/60 hover:text-white"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView("map")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              view === "map"
                ? "bg-[#f5a623] text-[#0a0f1e]"
                : "text-white/60 hover:text-white"
            }`}
          >
            Map
          </button>
        </div>
      </div>

      <p className="text-sm text-white/50">
        Showing {filtered.length} of {screenings.length} upcoming screenings in{" "}
        {cityName}.
      </p>

      {view === "map" ? (
        <ScreeningsMap screenings={filtered} className="min-h-[480px]" />
      ) : (
        <ul className="grid list-none gap-6 p-0 md:grid-cols-1">
          {filtered.map((s) => (
            <li key={s.id}>
              <ScreeningCard screening={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
