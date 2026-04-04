"use client";

import Link from "next/link";
import { useState } from "react";

const STORAGE_KEY = "oml-city-suggestions";

type Stored = {
  cityName: string;
  submitterName: string;
  submitterEmail?: string;
  createdAt: string;
};

function readStored(): Stored[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stored[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStored(rows: Stored[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function SuggestCityForm() {
  const [cityName, setCityName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"form" | "searching" | "done">("form");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("searching");

    const row: Stored = {
      cityName: cityName.trim(),
      submitterName: name.trim(),
      submitterEmail: email.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const next = [...readStored(), row];
    writeStored(next);

    try {
      await fetch("/api/suggest-city", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
    } catch {
      /* webhook is best-effort */
    }

    await new Promise((r) => setTimeout(r, 900));
    setPhase("done");
  }

  if (phase === "searching") {
    return (
      <p className="text-lg text-[#f0ede8] md:text-xl">
        <span aria-hidden>🎬 </span>
        We&apos;re searching for outdoor movies in{" "}
        <span className="text-[#f5a623]">{cityName.trim()}</span> now…
      </p>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 md:p-8">
        <p className="text-lg text-[#f0ede8] md:text-xl">
          You&apos;ll be the first person to bring Outdoor Movie List to{" "}
          <span className="font-semibold text-[#f5a623]">
            {cityName.trim()}
          </span>
          . We&apos;ll email you when it&apos;s live.
        </p>
        <Link
          href="/"
          className="inline-block text-sm font-medium text-[#f5a623] underline-offset-4 hover:underline"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-lg space-y-6 rounded-2xl border border-white/10 bg-[#0d1428]/60 p-6 md:p-8"
    >
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
          City name
        </span>
        <input
          required
          value={cityName}
          onChange={(e) => setCityName(e.target.value)}
          placeholder="e.g. Austin"
          className="mt-2 w-full rounded-xl border border-white/15 bg-[#0a0f1e] px-4 py-3 text-[#f0ede8] placeholder:text-white/30 focus:border-[#f5a623]/50 focus:outline-none focus:ring-2 focus:ring-[#f5a623]/20"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
          Your name
        </span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="mt-2 w-full rounded-xl border border-white/15 bg-[#0a0f1e] px-4 py-3 text-[#f0ede8] placeholder:text-white/30 focus:border-[#f5a623]/50 focus:outline-none focus:ring-2 focus:ring-[#f5a623]/20"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/45">
          Your email (optional)
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-2 w-full rounded-xl border border-white/15 bg-[#0a0f1e] px-4 py-3 text-[#f0ede8] placeholder:text-white/30 focus:border-[#f5a623]/50 focus:outline-none focus:ring-2 focus:ring-[#f5a623]/20"
        />
      </label>
      <button
        type="submit"
        className="w-full rounded-full bg-[#f5a623] py-3 text-sm font-bold text-[#0a0f1e] transition hover:bg-[#ffc04d]"
      >
        Request this city
      </button>
    </form>
  );
}
