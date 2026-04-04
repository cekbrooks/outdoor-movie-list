"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { haversineKm, milesFromKm } from "@/lib/geo";
import type { Screening } from "@/lib/types";
import { NoScreenings } from "./NoScreenings";
import { ScreeningCard } from "./ScreeningCard";

const RADIUS_KM = 40;

type Props = {
  allScreenings: Screening[];
};

export function NearMeClient({ allScreenings }: Props) {
  const searchParams = useSearchParams();
  const latQ = searchParams.get("lat");
  const lngQ = searchParams.get("lng");

  const parsedQuery = useMemo(() => {
    if (latQ == null || lngQ == null) return null;
    const la = parseFloat(latQ);
    const ln = parseFloat(lngQ);
    if (Number.isNaN(la) || Number.isNaN(ln)) return null;
    return { lat: la, lng: ln };
  }, [latQ, lngQ]);

  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);
  const [geoFinished, setGeoFinished] = useState(false);

  useEffect(() => {
    if (parsedQuery) return;
    if (!navigator.geolocation) {
      queueMicrotask(() => setGeoFinished(true));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLat(pos.coords.latitude);
        setGeoLng(pos.coords.longitude);
        setGeoFinished(true);
      },
      () => setGeoFinished(true),
      { enableHighAccuracy: true, timeout: 14_000 }
    );
  }, [parsedQuery]);

  const lat = parsedQuery?.lat ?? geoLat;
  const lng = parsedQuery?.lng ?? geoLng;
  const ready = parsedQuery !== null || geoFinished;
  const denied = ready && (lat == null || lng == null);

  const withDistance = useMemo(() => {
    if (lat == null || lng == null) return [];
    return allScreenings
      .map((s) => {
        const km = haversineKm(lat, lng, s.lat, s.lng);
        return { s, km, mi: milesFromKm(km) };
      })
      .filter(({ km }) => km <= RADIUS_KM)
      .sort((a, b) => a.km - b.km);
  }, [allScreenings, lat, lng]);

  if (allScreenings.length === 0) {
    return <NoScreenings />;
  }

  if (!ready) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0d1428]/50 p-12 text-center text-white/60">
        Finding your position…
      </div>
    );
  }

  if (denied) {
    return (
      <div className="space-y-8">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-[#f0ede8]">
          <p className="text-lg">
            Location access is off or unavailable. Pick a city to keep browsing
            outdoor screenings.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/new-york"
            className="rounded-2xl border border-white/10 bg-[#0d1428]/60 p-6 text-center font-display text-xl text-[#f0ede8] transition hover:border-[#f5a623]/40"
          >
            New York
          </Link>
          <Link
            href="/london"
            className="rounded-2xl border border-white/10 bg-[#0d1428]/60 p-6 text-center font-display text-xl text-[#f0ede8] transition hover:border-[#f5a623]/40"
          >
            London
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-white/55">
        Within {RADIUS_KM} km (~{Math.round(milesFromKm(RADIUS_KM))} miles) of
        your position — {withDistance.length}{" "}
        {withDistance.length === 1 ? "screening" : "screenings"}, sorted by
        distance.
      </p>
      {withDistance.length === 0 ? (
        <NoScreenings message="No screenings found within range. Try another city." />
      ) : (
        <ul className="grid list-none gap-6 p-0">
          {withDistance.map(({ s, mi }) => (
            <li key={s.id}>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[#f5a623]/90">
                {mi.toFixed(1)} miles away
              </div>
              <ScreeningCard screening={s} showCity />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
