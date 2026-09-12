import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/auth";
import { reversePlace, searchPlaces } from "@/lib/geo";
import { searchIndex, toGeoPlace } from "@/lib/geo/local-index";
import type { GeoKind, GeoPlace } from "@/lib/geo/types";

/**
 * Coordinate lookup for the admin's "add a pickup point" form.
 *
 * This used to read the bundled GeoNames index and nothing else, which meant it
 * could find Kochi but not Cochin International Airport — a terminal is not a
 * populated place. Staff pasted coordinates from a map for every airport,
 * jetty and temple we list, which is most of them.
 *
 * It asks the live geocoder now, so the things we actually park cars at are
 * findable by name. The bundled index is the fallback for when the geocoder
 * cannot answer, and the only reason it is still here — it also carries the
 * alias map, so "Kochi" finds the row GeoNames calls "Cochin".
 *
 * The form still lets the coordinates be edited by hand: the marker belongs
 * where the car waits, not at the centroid of whatever OpenStreetMap drew
 * around it.
 *
 * `?lat=&lng=` reverse-geocodes instead — staff standing at a new pickup point
 * can capture it from their phone.
 */

export interface AdminPlace {
  name: string;
  lat: number;
  lng: number;
  /** "Nedumbassery, Aluva, Kerala" */
  detail: string;
  state: string;
  kind: GeoKind;
  /** Former names, from the bundled index. */
  aka?: string[];
}

const MAX_RESULTS = 8;

function toAdminPlace(place: GeoPlace, aka?: string[]): AdminPlace {
  return {
    name: place.name,
    // The form writes these into number inputs; 5 dp is ~1 m.
    lat: Number(place.lat.toFixed(5)),
    lng: Number(place.lng.toFixed(5)),
    detail: place.detail,
    state: place.state,
    kind: place.kind,
    ...(aka?.length ? { aka } : {}),
  };
}

export async function GET(request: Request) {
  // Read-only, but it is still an internal tool — staff only.
  await requireAdmin();

  const params = new URL(request.url).searchParams;

  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (params.has("lat") || params.has("lng")) {
    if (!params.get("lat")?.trim() || !params.get("lng")?.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return NextResponse.json({ results: [], error: "Invalid coordinates." }, { status: 400 });
    }
    const place = await reversePlace({ lat, lng }, { signal: request.signal });
    return NextResponse.json({
      results: place ? [toAdminPlace({ ...place, lat, lng })] : [],
      ...(place ? {} : { error: "Nothing is mapped at that point — name it yourself." }),
    });
  }

  const query = (params.get("q") ?? "").trim();
  if (query.length > 200) return NextResponse.json({ results: [], error: "Search must be 200 characters or fewer." }, { status: 400 });
  if (query.length < 2) return NextResponse.json({ results: [] });

  const live = await searchPlaces(query, { limit: MAX_RESULTS, signal: request.signal });

  const indexed = live.places.length ? [] : await searchIndex(query, MAX_RESULTS);
  const aliases = new Map(indexed.map((match) => [match.place.name, match.place.aka]));
  const places: GeoPlace[] = live.places.length
    ? live.places
    : indexed.map((match) => toGeoPlace(match.place));

  const results = places
    .slice(0, MAX_RESULTS)
    .map((place) => toAdminPlace(place, aliases.get(place.name)));

  return NextResponse.json({
    results,
    ...(results.length === 0
      ? {
          error: live.ok
            ? `Nothing found for "${query}". Type the name and paste its coordinates below — a private jetty or a resort gate may not be mapped.`
            : "The place lookup is unreachable right now. Type the name and paste its coordinates below.",
        }
      : {}),
  });
}
