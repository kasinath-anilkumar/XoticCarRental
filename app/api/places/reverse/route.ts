import { NextResponse } from "next/server";

import { reversePlace } from "@/lib/geo";
import { clientKey, createRateLimiter } from "@/lib/net/rate-limit";
import { encodeFreePlace, type PlaceSuggestion } from "@/lib/places";

/**
 * What is at a point — the name behind "use my current location".
 *
 * The browser hands over coordinates; this hands back the name of the place
 * they fall in. The coordinates in the token are **the visitor's own**, not the
 * geocoder's idea of the town centre: they are more accurate, they are what the
 * distance is measured from, and they survive the geocoder having nothing to
 * say. A lookup that finds nothing still yields a usable pickup point, just one
 * labelled with its coordinates.
 */

/**
 * One tap of "use my current location" is one call, so this is generous by a
 * wide margin — and an address is a whole carrier-NAT neighbourhood, not a
 * person.
 */
const allow = createRateLimiter(60, 60_000);

function coordinate(value: string | null, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > max) return null;
  return parsed;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = coordinate(params.get("lat"), 90);
  const lng = coordinate(params.get("lng"), 180);

  if (lat === null || lng === null) {
    return NextResponse.json({ error: "lat and lng are required." }, { status: 400 });
  }

  if (!allow(clientKey(request))) {
    return NextResponse.json(
      { error: "Too many lookups — give it a moment." },
      { status: 429, headers: { "Retry-After": "30" } },
    );
  }

  const place = await reversePlace({ lat, lng }, { signal: request.signal });

  const suggestion: PlaceSuggestion = {
    token: encodeFreePlace({ name: place?.name ?? "My location", lat, lng }),
    name: place?.name ?? "My location",
    detail: place?.detail || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    served: false,
    isAirport: place?.kind === "airport",
    kind: place?.kind,
  };

  return NextResponse.json(
    { result: suggestion, resolved: place !== null },
    // A point on the pavement is the same point in an hour, but this is
    // personal — keep it in the visitor's browser, not a shared cache.
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
