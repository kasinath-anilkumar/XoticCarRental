import { NextResponse } from "next/server";

import { clientKey, createRateLimiter } from "@/lib/net/rate-limit";
import { routeThrough, type LatLng } from "@/lib/route";
import { MAX_TRIP_STOPS } from "@/lib/trip-limits";

/**
 * The driven route through a trip's stops.
 *
 * The calculator asks for this whenever a stop changes, and uses the answer
 * twice: to draw the road on the map, and to price the trip by it. Both from
 * one response, so the line the customer is looking at and the kilometres they
 * are being charged for are the same journey.
 *
 *   GET /api/directions?stops=9.98,76.26;10.15,76.39
 *
 * A router that cannot answer is not an error here: `routed: false` comes back,
 * the map falls back to a straight line and the quote to its estimate — which
 * is what both did before there was a router at all.
 */

/**
 * A route is asked for far less often than a place suggestion — one per change
 * of stop, and the cache absorbs the repeats — so this is mostly here to stop a
 * script from spending someone else's routing quota.
 */
const allow = createRateLimiter(120, 60_000);

function parseStops(value: string | null): LatLng[] {
  if (!value || value.length > 500) return [];
  const pairs = value.split(";");
  if (pairs.length < 2 || pairs.length > MAX_TRIP_STOPS) return [];
  const stops: LatLng[] = [];
  for (const pair of pairs) {
    const parts = pair.split(",");
    if (parts.length !== 2 || parts.some((part) => part.trim() === "")) return [];
    const [lat, lng] = parts.map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat!) > 90 || Math.abs(lng!) > 180) return [];
    stops.push([lat!, lng!]);
  }
  return stops;
}

export async function GET(request: Request) {
  const stops = parseStops(new URL(request.url).searchParams.get("stops"));

  if (stops.length < 2) {
    return NextResponse.json({ error: "Two or more stops are required." }, { status: 400 });
  }

  if (!allow(clientKey(request))) {
    return NextResponse.json(
      { routed: false, error: "Too many routes — give it a moment." },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }

  const trip = await routeThrough(stops, { signal: request.signal });

  if (!trip) {
    return NextResponse.json(
      { routed: false },
      // Never cached: the next request should try the router again rather than
      // inherit the minute it was down.
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { routed: true, km: trip.km, minutes: trip.minutes, legs: trip.legs, path: trip.path },
    // Roads do not move. This is the same answer tomorrow.
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
