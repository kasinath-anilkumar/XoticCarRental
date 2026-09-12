import { NextResponse } from "next/server";

import { searchPlaces } from "@/lib/geo";
import { searchIndex, toGeoPlace } from "@/lib/geo/local-index";
import { clientKey, createRateLimiter } from "@/lib/net/rate-limit";
import { suggestionFromGeo, type PlaceSuggestion } from "@/lib/places";
import type { GeoPlace } from "@/lib/geo/types";

/**
 * Place suggestions for the pickup / drop comboboxes.
 *
 * Everything a visitor is offered comes from the live geocoder (`lib/geo`).
 * There is no curated list in front of it any more: a fixed set of pickup
 * points answered "Kochi" well and "Komalapuram" not at all, and a search box
 * that knows a village of four thousand people should not be seasoned with
 * thirty-three that it already knew.
 *
 * `data/india-cities.json` — the bundled GeoNames index of towns over 10,000
 * people — is kept strictly as a **fallback**. It answers when the geocoder
 * cannot: an outage, a timeout, a rate limit. It never dilutes a live answer,
 * because it would only ever add the towns the geocoder already knows.
 *
 * The response says which of the two it is (`degraded`), so the combobox can
 * tell a visitor "nothing is called that" apart from "we could not ask".
 */

const MAX_RESULTS = 8;

/**
 * An anti-abuse ceiling, not a quota.
 *
 * Deliberately high: mobile India is largely behind carrier NAT, so an address
 * is a neighbourhood rather than a person, and a limit tuned to one typist
 * would break the search box for a hundred innocent ones. What actually
 * protects the upstream service is the cache and the interval gate in
 * `lib/geo`, which are global. Over the limit the request still gets an
 * answer — the offline one — rather than an error.
 */
const allow = createRateLimiter(300, 60_000);

/** `near=10.0889,77.0595` — the visitor's position, when they have shared it. */
function parseNear(value: string | null): { lat: number; lng: number } | null {
  if (!value) return null;
  const parts = value.split(",");
  if (parts.length !== 2 || parts.some((part) => part.trim() === "")) return null;
  const [lat, lng] = parts.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat! < -90 || lat! > 90 || lng! < -180 || lng! > 180) return null;
  return { lat: lat!, lng: lng! };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length > 200) return NextResponse.json({ error: "Search must be 200 characters or fewer." }, { status: 400 });
  if (query.length < 2) return NextResponse.json({ results: [], degraded: false });

  const near = parseNear(url.searchParams.get("near"));
  const throttled = !allow(clientKey(request));

  const live = throttled
    ? { places: [] as GeoPlace[], ok: false }
    : await searchPlaces(query, { limit: MAX_RESULTS, near, signal: request.signal });

  // The index only ever speaks when the geocoder could not.
  const places = live.places.length
    ? live.places
    : (await searchIndex(query, MAX_RESULTS)).map((match) => toGeoPlace(match.place));

  const results: PlaceSuggestion[] = places.slice(0, MAX_RESULTS).map(suggestionFromGeo);

  return NextResponse.json(
    { results, degraded: !live.ok },
    {
      // Long enough that a shared link's autocomplete is warm, short enough
      // that a newly mapped place turns up the same day. A degraded answer is
      // not cached at all — it would outlive the outage that caused it.
      headers: {
        "Cache-Control": live.ok
          ? "public, max-age=600, stale-while-revalidate=86400"
          : "no-store",
      },
    },
  );
}
