"use client";

import type { Screening } from "@/lib/types";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";

type Props = {
  screenings: Screening[];
  className?: string;
};

function buildGeoJSON(screenings: Screening[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: screenings.map((s) => ({
      type: "Feature" as const,
      properties: {
        id: s.id,
        city: s.city,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [s.lng, s.lat],
      },
    })),
  };
}

function escapeHtml(text: string): string {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

export function ScreeningsMap({ screenings, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const screeningsRef = useRef(screenings);

  useEffect(() => {
    screeningsRef.current = screenings;
  }, [screenings]);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const el = containerRef.current;
    if (!el || !token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: el,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-30, 42],
      zoom: 2.4,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("screenings", {
        type: "geojson",
        data: buildGeoJSON(screeningsRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 55,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "screenings",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "rgba(245, 166, 35, 0.55)",
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 22, 28, 28],
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(245, 166, 35, 0.9)",
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "screenings",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#0a0f1e",
        },
      });

      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "screenings",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match",
            ["get", "city"],
            "new-york",
            "#f5a623",
            "london",
            "#60a5fa",
            "#94a3b8",
          ],
          "circle-radius": 8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0a0f1e",
        },
      });

      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["clusters"],
        });
        const f = features[0];
        if (!f?.properties) return;
        const src = map.getSource("screenings") as mapboxgl.GeoJSONSource;
        const id = f.properties.cluster_id as number;
        src.getClusterExpansionZoom(id, (err, zoom) => {
          if (err || zoom == null) return;
          const coords = (f.geometry as GeoJSON.Point).coordinates as [
            number,
            number,
          ];
          map.easeTo({ center: coords, zoom });
        });
      });

      map.on("click", "unclustered-point", (e) => {
        const f = e.features?.[0];
        if (!f?.properties) return;
        const id = String(f.properties.id);
        const s = screeningsRef.current.find((x) => x.id === id);
        if (!s) return;

        const html = `
          <div style="min-width:220px;max-width:280px;font-family:system-ui,sans-serif;color:#0a0f1e;padding:4px 0;">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px;">${escapeHtml(s.film)}</div>
            <div style="font-size:13px;opacity:.85;margin-bottom:6px;">${escapeHtml(s.venue)}</div>
            <div style="font-size:12px;opacity:.7;">${escapeHtml(s.date)} · ${escapeHtml(s.time)}</div>
            <a href="${escapeHtml(s.bookingUrl)}" target="_blank" rel="noopener noreferrer"
              style="display:inline-block;margin-top:10px;background:#f5a623;color:#0a0f1e;font-weight:600;padding:8px 14px;border-radius:999px;text-decoration:none;font-size:13px;">Book / More info</a>
          </div>
        `;

        new mapboxgl.Popup({ offset: 12, maxWidth: "300px" })
          .setLngLat([s.lng, s.lat])
          .setHTML(html)
          .addTo(map);
      });

      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "unclustered-point", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "unclustered-point", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance) return;
    function apply() {
      const m = mapRef.current;
      if (!m) return;
      const src = m.getSource("screenings") as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (src) src.setData(buildGeoJSON(screenings));
    }
    if (mapInstance.getSource("screenings")) apply();
    else mapInstance.once("load", apply);
  }, [screenings]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return (
      <div
        className={`flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-white/20 bg-[#0d1428]/50 p-8 text-center text-sm text-white/50 ${className}`}
      >
        Set <code className="text-[#f5a623]">NEXT_PUBLIC_MAPBOX_TOKEN</code> in
        .env.local to load the map.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`min-h-[320px] w-full overflow-hidden rounded-2xl border border-white/10 md:min-h-[420px] ${className}`}
      role="region"
      aria-label="Map of screenings"
    />
  );
}
