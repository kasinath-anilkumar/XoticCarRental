"use client";

import type { Map as LeafletMap, Marker, Polyline } from "leaflet";
import { useEffect, useRef } from "react";

import type { ResolvedPlace } from "@/lib/places";
import type { LatLng } from "@/lib/route/types";

import styles from "./RouteMap.module.css";
import { createStopPopup } from "./stop-popup";
// Leaflet's own CSS, wrapped in the vendor layer so our overrides win.
import "./leaflet-vendor.css";

/** The brand orange, at the strength the dark map tiles can carry. */
const ROUTE_COLOR = "#ff7a00";

export interface RouteMapCanvasProps {
  stops: ResolvedPlace[];
  /** Initial area only: it must not create a passenger stop or route. */
  previewCenter?: LatLng;
  /** The driven route from `/api/directions`. Empty until it arrives. */
  path?: LatLng[];
}

/**
 * The route drawn on a real map.
 *
 * Leaflet is driven directly rather than through react-leaflet: the wrapper is
 * published under the Hippocratic licence, which is not OSI-approved and is a
 * poor fit for a commercial site, while Leaflet itself is BSD-2. Doing without
 * it costs one effect.
 *
 * Tiles are OpenStreetMap's, which are free and need no key — the attribution
 * control is required by their usage policy and is deliberately left visible.
 *
 * The line is the **driven route**: the polyline that `lib/route` got from the
 * router, which is also where the quote's kilometres come from. Until that
 * arrives — and if it never does, because the router is down — it falls back to
 * the dashed straight line this map used to draw, which is honest about being a
 * direction rather than a road.
 */
export function RouteMapCanvas({ stops, previewCenter, path = [] }: RouteMapCanvasProps) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const releaseTouch = useRef<(() => void) | null>(null);
  const markers = useRef<Marker[]>([]);
  const line = useRef<Polyline | null>(null);
  const previewLat = previewCenter?.[0];
  const previewLng = previewCenter?.[1];

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    // Leaflet touches `window` at import time, so it can only load in the
    // browser — hence the dynamic import rather than a top-level one.
    void import("leaflet").then((L) => {
      if (cancelled || !holder.current) return;

      if (!map.current) {
        map.current = L.map(holder.current, {
          scrollWheelZoom: false,
          attributionControl: true,
          zoomControl: true,
          // Draw the route into a canvas rather than an SVG overlay: the
          // polyline is a few dozen points of road, and a canvas layer is one
          // composited surface instead of a path the compositor re-rasterises.
          preferCanvas: true,
        });

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map.current);

        // On a touch screen the map used to eat the scroll: a finger dragged
        // over it panned the map instead of moving the page, which on the
        // calculator means the map sits in the middle of the form you are
        // trying to scroll past. One finger scrolls the page now, two pan the
        // map — the same bargain an embedded map anywhere else strikes.
        if (L.Browser.mobile) {
          const instance = map.current;
          const element = holder.current;
          const onTouchStart = (event: TouchEvent) => {
            if (event.touches.length > 1) instance.dragging.enable();
            else instance.dragging.disable();
          };
          const onTouchEnd = () => instance.dragging.disable();

          instance.dragging.disable();
          element.addEventListener("touchstart", onTouchStart, { passive: true });
          element.addEventListener("touchend", onTouchEnd, { passive: true });
          releaseTouch.current = () => {
            element.removeEventListener("touchstart", onTouchStart);
            element.removeEventListener("touchend", onTouchEnd);
          };
        }
      }

      const instance = map.current;
      const points = stops.map((stop) => L.latLng(stop.lat, stop.lng));

      for (const marker of markers.current) marker.remove();
      markers.current = [];
      line.current?.remove();
      line.current = null;

      stops.forEach((stop, index) => {
        const last = index === stops.length - 1 && stops.length > 1;
        const icon = L.divIcon({
          className: "",
          html: `<div class="xotic-pin${last ? " xotic-pin-end" : ""}">${index + 1}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        const marker = L.marker([stop.lat, stop.lng], { icon, title: stop.name })
          .addTo(instance)
          .bindPopup(createStopPopup(stop.name, index, stops.length));
        markers.current.push(marker);
      });

      // Clearing the itinerary must also clear an old routing response while
      // the map returns to the vehicle's preview area.
      const road = stops.length > 0 && path.length > 1 ? path.map(([lat, lng]) => L.latLng(lat, lng)) : null;

      if (road) {
        line.current = L.polyline(road, { color: ROUTE_COLOR, weight: 4, opacity: 0.95 }).addTo(
          instance,
        );
      } else if (points.length > 1) {
        // No route yet: the dashed line says "this way", not "this road".
        line.current = L.polyline(points, {
          color: ROUTE_COLOR,
          weight: 3,
          opacity: 0.9,
          dashArray: "7 6",
        }).addTo(instance);
      }

      // Frame the road when there is one — it wanders well outside the box the
      // stops alone would draw, and half a route off the edge looks broken.
      const frame = road ?? points;
      const fit = () => {
        if (frame.length === 1) {
          // One stop is a place, not a journey: close enough to see the street.
          instance.setView(frame[0], 14);
        } else if (frame.length > 1) {
          // 16 rather than 13: a pickup and a drop two streets apart used to be
          // framed as if they were two towns apart.
          instance.fitBounds(L.latLngBounds(frame), { padding: [30, 30], maxZoom: 16 });
        } else if (previewLat !== undefined && previewLng !== undefined) {
          // A city-scale overview is context, with no marker or invented leg.
          // Keep vehicle changes immediate, including reduced-motion sessions.
          instance.setView([previewLat, previewLng], 11, { animate: false });
        }
      };
      fit();

      // Reconnect after a stop or preview-area change: the effect's cleanup
      // disconnects the old observer even when the map instance is reused. A
      // frame that settles to a new size is framed again, not left cropped.
      let size = `${holder.current.clientWidth}x${holder.current.clientHeight}`;
      const element = holder.current;
      resizeObserver = new ResizeObserver(() => {
        const next = `${element.clientWidth}x${element.clientHeight}`;
        if (next === size) return;
        size = next;
        instance.invalidateSize({ pan: false });
        fit();
      });
      resizeObserver.observe(element);
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
    };
  }, [stops, path, previewLat, previewLng]);

  // Torn down separately so a stop change does not destroy and rebuild the map.
  useEffect(
    () => () => {
      releaseTouch.current?.();
      releaseTouch.current = null;
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return <div ref={holder} className={styles.canvas} />;
}
