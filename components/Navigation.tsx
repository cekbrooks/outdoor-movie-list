"use client";

import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/new-york", label: "New York" },
  { href: "/london", label: "London" },
  { href: "/near-me", label: "Near Me" },
  { href: "/suggest-a-city", label: "Add Your City" },
];

export function Navigation() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0f1e]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-[#f0ede8] transition hover:text-[#f5a623] md:text-xl"
        >
          <span aria-hidden>🎬 </span>
          Outdoor Movie List
        </Link>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-white/70 transition hover:text-[#f5a623]"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/cities"
            className="text-sm font-medium text-white/70 transition hover:text-[#f5a623]"
          >
            Cities
          </Link>
        </nav>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-white/15 p-2 text-white md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="sr-only">Menu</span>
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {open ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>
      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-white/10 bg-[#0a0f1e] px-4 py-4 md:hidden"
        >
          <ul className="flex flex-col gap-3">
            {[...links, { href: "/cities", label: "Cities" }].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="block py-2 text-base font-medium text-[#f0ede8]"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
