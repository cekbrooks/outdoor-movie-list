"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NearMeButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function onClick() {
    if (!navigator.geolocation) {
      router.push("/near-me");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        router.push(
          `/near-me?lat=${latitude.toFixed(5)}&lng=${longitude.toFixed(5)}`
        );
        setBusy(false);
      },
      () => {
        setBusy(false);
        router.push("/near-me");
      },
      { enableHighAccuracy: true, timeout: 12_000 }
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#f5a623] to-[#d4890f] px-8 text-base font-bold text-[#0a0f1e] shadow-lg shadow-[#f5a623]/25 transition hover:from-[#ffc04d] hover:to-[#f5a623] disabled:opacity-70 sm:w-auto"
    >
      <span aria-hidden>📍</span>
      {busy ? "Locating…" : "Near Me"}
    </button>
  );
}
