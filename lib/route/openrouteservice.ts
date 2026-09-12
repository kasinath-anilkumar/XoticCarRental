/**
 * OpenRouteService — the keyed alternative.
 *
 * For anyone who would rather not lean on a public demo server and would rather
 * not run their own: an account, a free tier of a couple of thousand routes a
 * day, and an SLA to complain to. Set `ROUTER_PROVIDER=openrouteservice` and
 * `ROUTER_API_KEY`.
 *
 * It answers GeoJSON with a `segments` array — one per pair of stops, same as
 * OSRM's legs — so the shape above this file is identical either way.
 *
 * https://openrouteservice.org/dev/#/api-docs/v2/directions
 */

import { fetchJson } from "../net/http";

import type { LatLng, RouteProvider, RoutedTrip } from "./types";

const ENDPOINT = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

interface OrsResponse {
  features?: Array<{
    properties: {
      summary?: { distance?: number; duration?: number };
      segments?: Array<{ distance: number; duration: number }>;
    };
    geometry: { coordinates: Array<[number, number]> };
  }>;
  error?: { message?: string } | string;
}

export function createOpenRouteServiceProvider(): RouteProvider {
  const key = process.env.ROUTER_API_KEY ?? "";

  return {
    name: "openrouteservice",
    // A paid-for quota does not need spacing out; the daily cap is the limit
    // that matters, and the cache is what protects it.
    minIntervalMs: 0,

    async route(stops: LatLng[], options = {}) {
      if (!key) throw new Error("ROUTER_API_KEY is not set");

      const data = await fetchJson<OrsResponse>(ENDPOINT, {
        method: "POST",
        // Lon,lat here too — every routing API in this family takes it that way.
        body: { coordinates: stops.map(([lat, lng]) => [lng, lat]) },
        headers: { Authorization: key },
        signal: options.signal,
        timeoutMs: 6000,
      });

      const feature = data.features?.[0];
      if (!feature) {
        const message = typeof data.error === "string" ? data.error : data.error?.message;
        throw new Error(message ?? "no route");
      }

      const segments = feature.properties.segments ?? [];
      const legs = segments.map((segment) => ({
        km: Math.round(segment.distance / 100) / 10,
        minutes: Math.round(segment.duration / 60),
      }));

      // The summary is what ORS itself totals the route at; falling back to the
      // sum of the legs keeps a response with segments but no summary usable.
      const km = feature.properties.summary?.distance
        ? Math.round(feature.properties.summary.distance / 100) / 10
        : Math.round(legs.reduce((sum, leg) => sum + leg.km, 0) * 10) / 10;
      const minutes = feature.properties.summary?.duration
        ? Math.round(feature.properties.summary.duration / 60)
        : legs.reduce((sum, leg) => sum + leg.minutes, 0);

      return {
        legs,
        km,
        minutes,
        path: feature.geometry.coordinates.map(([lng, lat]): LatLng => [lat, lng]),
      } satisfies RoutedTrip;
    },
  };
}
