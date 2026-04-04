"use client";

import dynamic from "next/dynamic";
import type { Screening } from "@/lib/types";

const Map = dynamic(
  () => import("./ScreeningsMap").then((m) => ({ default: m.ScreeningsMap })),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[320px] w-full animate-pulse rounded-2xl border border-white/10 bg-[#0d1428]/50 md:min-h-[420px]"
        aria-hidden
      />
    ),
  }
);

export function ScreeningsMapLoader(props: {
  screenings: Screening[];
  className?: string;
}) {
  return <Map {...props} />;
}
