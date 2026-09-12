/**
 * Driving routes.
 *
 * Distance used to be invented twice over: a great-circle line between two
 * points, multiplied by 1.25 because Indian roads run about a quarter longer
 * than the crow flies. It was an honest estimate and it was still an estimate —
 * Kochi → Munnar came out at 108 km against a real 130, and the map drew a
 * dashed straight line over the Western Ghats to match.
 *
 * This asks a router instead. The same answer feeds both the shape on the map
 * and the kilometres on the quote, which is the point: a customer looking at a
 * route that climbs through Adimali and a total billed for a line through the
 * mountainside would be right to distrust both.
 *
 *   ROUTER_PROVIDER   osrm (default) | openrouteservice
 *   ROUTER_API_KEY    required by openrouteservice
 *   ROUTER_URL        your own OSRM instance, instead of the public demo server
 *
 * Server-only, and failure is always an empty answer rather than an exception:
 * a router that is down leaves the site quoting the old estimate, which is
 * exactly what it quoted before this file existed.
 */

import { createInflight, createThrottle, TtlCache } from "../net/cache";

import { createOsrmProvider } from "./osrm";
import type { LatLng, RouteProvider, RoutedTrip } from "./types";

export type { LatLng, RouteLeg, RoutedTrip } from "./types";

/** Roads change slowly. This bounds memory and retries a sulking router. */
const TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_SIZE = 300;

const cache = new TtlCache<RoutedTrip>(TTL_MS, CACHE_SIZE);
const inflight = createInflight<RoutedTrip>();

export function providerName(): string {
  return (process.env.ROUTER_PROVIDER ?? "osrm").toLowerCase();
}

let cached: Promise<RouteProvider> | null = null;
let gate: (() => Promise<void>) | null = null;

function provider(): Promise<RouteProvider> {
  cached ??= (async () => {
    const name = providerName();
    const built =
      name === "openrouteservice" || name === "ors"
        ? await import("./openrouteservice").then((m) => m.createOpenRouteServiceProvider())
        : createOsrmProvider();
    gate = createThrottle(built.minIntervalMs);
    return built;
  })();
  return cached;
}

/** One line per problem per minute — an outage is an outage for everybody. */
const lastLogged = new Map<string, number>();

function report(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const now = Date.now();
  if ((lastLogged.get(message) ?? 0) > now - 60_000) return;
  lastLogged.set(message, now);
  console.warn(`[route] ${providerName()} could not route: ${message}`);
}

/**
 * Rounds a stop to ~11 m for the cache key.
 *
 * Two people asking for a car from the same street corner should not be two
 * requests, and a route is identical long before the coordinates are.
 */
function key(stops: LatLng[]): string {
  return stops.map(([lat, lng]) => `${lat.toFixed(4)},${lng.toFixed(4)}`).join(";");
}

/**
 * The driven route through these stops, or null when it cannot be had.
 *
 * Null covers everything: no router configured, the router down, a timeout, a
 * pair of points with no road between them. Every caller has the estimate to
 * fall back on, so none of them treat it as an error.
 */
export async function routeThrough(
  stops: LatLng[],
  options: { signal?: AbortSignal } = {},
): Promise<RoutedTrip | null> {
  const usable = stops.filter(
    ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng),
  );
  if (usable.length < 2) return null;

  const cacheKey = key(usable);
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  try {
    return await inflight(cacheKey, async () => {
      const router = await provider();
      await gate?.();
      const trip = await router.route(usable, options);
      cache.set(cacheKey, trip);
      return trip;
    });
  } catch (error) {
    report(error);
    return null;
  }
}
