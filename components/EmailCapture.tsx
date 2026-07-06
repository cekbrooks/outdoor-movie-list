"use client";

import { useState } from "react";

type Props = {
  variant?: "hero" | "inline";
  defaultCity?: string;
};

export function EmailCapture({ variant = "inline", defaultCity = "" }: Props) {
  const [email, setEmail] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "err">(
    "idle"
  );
  const [errMsg, setErrMsg] = useState("Something went wrong. Try again.");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, cityPreference: city || null }),
      });
      if (!res.ok) {
        try {
          const data = (await res.json()) as { message?: string };
          if (data.message) setErrMsg(data.message);
        } catch {
          /* keep default message */
        }
        throw new Error("bad");
      }
      setStatus("done");
      setEmail("");
    } catch {
      setStatus("err");
    }
  }

  const box =
    variant === "hero"
      ? "rounded-3xl border border-white/10 bg-[#0d1428]/80 p-6 md:p-8"
      : "rounded-2xl border border-white/10 bg-[#0d1428]/60 p-5";

  return (
    <div className={box}>
      <h2 className="font-display text-xl font-semibold text-[#f0ede8] md:text-2xl">
        Get weekly outdoor movie picks for your city
      </h2>
      <p className="mt-2 max-w-xl text-sm text-white/60">
        One curated email. No spam — unsubscribe anytime.
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4 sm:flex-row">
        <label className="sr-only" htmlFor="oml-email">
          Email
        </label>
        <input
          id="oml-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-12 flex-1 rounded-full border border-white/15 bg-[#0a0f1e] px-5 text-[#f0ede8] placeholder:text-white/35 focus:border-[#f5a623]/60 focus:outline-none focus:ring-2 focus:ring-[#f5a623]/30"
        />
        <label className="sr-only" htmlFor="oml-city-pref">
          City preference
        </label>
        <select
          id="oml-city-pref"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="min-h-12 rounded-full border border-white/15 bg-[#0a0f1e] px-5 text-[#f0ede8] focus:border-[#f5a623]/60 focus:outline-none focus:ring-2 focus:ring-[#f5a623]/30"
        >
          <option value="">All cities</option>
          <option value="new-york">New York</option>
          <option value="london">London</option>
        </select>
        <button
          type="submit"
          disabled={status === "loading"}
          className="min-h-12 rounded-full bg-[#f5a623] px-8 text-sm font-semibold text-[#0a0f1e] transition hover:bg-[#ffc04d] disabled:opacity-60"
        >
          {status === "loading" ? "Subscribing…" : "Subscribe"}
        </button>
      </form>
      {status === "done" ? (
        <p className="mt-3 text-sm text-emerald-400">You are on the list.</p>
      ) : null}
      {status === "err" ? (
        <p className="mt-3 text-sm text-red-400">{errMsg}</p>
      ) : null}
    </div>
  );
}
