"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import type { ResolvedPlace } from "@/lib/places";
import type { LatLng } from "@/lib/route/types";

import styles from "./RouteMap.module.css";

/**
 * Leaflet reads `window` on import, so the canvas is loaded only in the
 * browser. The frame, the chips and the loading state render on the server, so
 * the panel never collapses while the map arrives.
 */
const RouteMapCanvas = dynamic(
  () => import("./RouteMapCanvas").then((m) => m.RouteMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className={styles.fallback}>
        <Icon name="ph-map-trifold" size={22} />
        Loading the map…
      </div>
    ),
  },
);

export interface RouteMapProps {
  stops: ResolvedPlace[];
  /** The driven route, once `/api/directions` has answered. */
  path?: LatLng[];
  /** e.g. "260 km on route" */
  chips?: string[];
  note?: string;
  /** Grow to the height of the column instead of the default 260px strip. */
  fill?: boolean;
}

export function RouteMap({ stops, path, chips = [], note, fill = false }: RouteMapProps) {
  const frame = useRef<HTMLDivElement | null>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    if (!frame.current) return;
    if (!("IntersectionObserver" in window)) {
      const frameId = requestAnimationFrame(() => setNearViewport(true));
      return () => cancelAnimationFrame(frameId);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px" });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={fill ? styles.fill : undefined}>
      <div ref={frame} className={`${styles.frame} ${fill ? styles.frameFill : ""}`}>
        {stops.length > 0 && nearViewport ? (
          <RouteMapCanvas stops={stops} path={path} />
        ) : (
          <div className={styles.fallback}>
            <Icon name="ph-map-pin-line" size={22} />
            {stops.length > 0 ? "Loading the map…" : "Select a pickup location to see the route."}
          </div>
        )}
        {chips.length > 0 && (
          <div className={styles.chips}>
            {chips.map((chip) => (
              <span key={chip} className={styles.chip}>
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}
