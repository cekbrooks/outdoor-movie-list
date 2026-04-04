import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: `Page not found — ${SITE_NAME}`,
  description: "This page does not exist or has moved.",
};

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f5a623]/90">
        404
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-[#f0ede8] md:text-4xl">
        Lost in the dark
      </h1>
      <p className="mt-4 max-w-md text-white/55">
        No screening here — the reel ended early. Head back to the lobby.
      </p>
      <Link
        href="/"
        className="mt-10 inline-flex rounded-full bg-[#f5a623] px-8 py-3 text-sm font-bold text-[#0a0f1e] transition hover:bg-[#ffc04d]"
      >
        Home
      </Link>
    </main>
  );
}
