/**
 * A quote with the trip actually routed.
 *
 * `resolveQuote` is pure and synchronous — that is why the home page's preview,
 * the calculator and the fleet cards can all call it while rendering. Asking a
 * router is neither, so it lives here instead of being smuggled into that
 * function.
 *
 * Server-only, and for the two places that must agree with what the customer
 * saw: the booking summary they read before sending, and the enquiry route that
 * recomputes the whole thing before recording it. The calculator reaches the
 * same numbers from the browser through `/api/directions`, off the same cache.
 *
 * If the router says nothing, this is exactly `resolveQuote` — the estimate,
 * the same as everywhere else.
 */

import { resolveQuote, vehicleRouteStops, type ResolvedQuote } from "./quote";
import { routeThrough, type LatLng } from "./route";
import type { Catalog } from "./catalog";
import type { TripRequest } from "./types";

/**
 * A page render waits on this, and so does the tap that opens WhatsApp, so it
 * gets a tighter deadline than the map does: a quote three seconds late is
 * worse than a quote on the old estimate. In practice it is a cache hit —
 * whoever is reading this summary was just looking at the same route on the
 * calculator.
 */
const DEADLINE_MS = 3000;

export async function resolveRoutedQuote(
  catalog: Catalog,
  trip: TripRequest,
  options: { signal?: AbortSignal } = {},
): Promise<ResolvedQuote> {
  const stops = vehicleRouteStops(catalog, trip);
  const routed = await routeThrough(stops.map((stop): LatLng => [stop.lat, stop.lng]), {
    signal: options.signal ?? AbortSignal.timeout(DEADLINE_MS),
  });
  return resolveQuote(catalog, trip, routed ? { ...routed, scope: "vehicle" } : null);
}
