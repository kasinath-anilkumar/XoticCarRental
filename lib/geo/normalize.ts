/**
 * Turning provider answers into suggestions a customer recognises.
 *
 * Two problems live here. The first is naming: OpenStreetMap knows Kalpetta as
 * a `place=town`, a `boundary=local_authority` and a `boundary=political` — one
 * town, three rows, and a dropdown that repeats itself looks broken. The second
 * is ordering: a search for "Munn" should offer Munnar the hill station before
 * Munnarkode Road, which no provider guarantees on its own.
 *
 * Everything in this file is pure, so both rules are testable without a network
 * (`normalize.test.ts`).
 */

import { fold } from "../places";
import { getDistance } from "geolib";

import type { Coords, GeoKind, GeoPlace } from "./types";

/**
 * OSM tag → our kind.
 *
 * Keyed on the tag's value first (`place=village`), falling back to its key
 * (`aeroway=*` is an airport whatever the value). Anything unrecognised is a
 * landmark: a temple, a jetty or a resort is a perfectly good pickup point, it
 * simply should not outrank the town it sits in.
 */
const KIND_BY_VALUE: Record<string, GeoKind> = {
  state: "state",
  country: "country",
  city: "city",
  town: "town",
  village: "village",
  hamlet: "village",
  isolated_dwelling: "village",
  suburb: "suburb",
  neighbourhood: "suburb",
  quarter: "suburb",
  borough: "suburb",
  locality: "locality",
  municipality: "city",
  administrative: "locality",
  aerodrome: "airport",
  terminal: "airport",
  station: "station",
  halt: "station",
  bus_station: "station",
  ferry_terminal: "station",
};

const KIND_BY_KEY: Record<string, GeoKind> = {
  aeroway: "airport",
  railway: "station",
  highway: "address",
  place: "locality",
  building: "address",
};

export function kindFromOsm(key: string | undefined, value: string | undefined): GeoKind {
  const byValue = value && Object.hasOwn(KIND_BY_VALUE, value) ? KIND_BY_VALUE[value] : undefined;
  if (byValue) return byValue;
  const byKey = key && Object.hasOwn(KIND_BY_KEY, key) ? KIND_BY_KEY[key] : undefined;
  if (byKey) return byKey;
  return "landmark";
}

/**
 * How high a kind sits in the list.
 *
 * An airport ties with a city deliberately: someone typing "cochin" is far more
 * likely to want the terminal than a suburb of the same name, and airports are
 * the single most common pickup we take.
 */
const KIND_RANK: Record<GeoKind, number> = {
  state: 0,
  country: 0,
  city: 0,
  airport: 0,
  town: 1,
  station: 2,
  village: 2,
  suburb: 3,
  locality: 3,
  landmark: 4,
  address: 5,
};

export function kindRank(kind: GeoKind): number {
  return KIND_RANK[kind] ?? 5;
}

/** The `ph-*` icon for a kind. Used by the combobox and the admin lookup. */
export function iconForKind(kind: GeoKind | undefined): string {
  switch (kind) {
    case "airport":
      return "ph-airplane-tilt";
    case "station":
      return "ph-train";
    case "city":
    case "town":
      return "ph-city";
    case "suburb":
      return "ph-buildings";
    case "address":
      return "ph-road-horizon";
    case "landmark":
    case "state":
    case "country":
      return "ph-map-trifold";
    default:
      return "ph-map-pin";
  }
}

/**
 * The line under the name: "Alathur, Palakkad, Kerala".
 *
 * Drops blanks, drops anything that merely repeats the name, drops repeats of
 * itself (providers routinely give the same string as district and city), and
 * stops at three segments — past that it wraps and stops being scannable.
 */
export function detailLine(parts: Array<string | undefined | null>, name: string): string {
  const seen = new Set<string>([fold(name)]);
  const kept: string[] = [];

  for (const part of parts) {
    const value = part?.trim();
    if (!value) continue;
    const key = fold(value);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(value);
    if (kept.length === 3) break;
  }

  return kept.join(", ");
}

/**
 * Collapses duplicate rows, keeping the best-ranked of each group.
 *
 * "Best" is the kind rank, so the `place=town` row survives and its two
 * boundary twins do not — the survivor carries the name people would say out
 * loud, and usually the richer detail line.
 */
export function dedupe(places: GeoPlace[]): GeoPlace[] {
  const best: GeoPlace[] = [];

  for (const place of places) {
    const index = best.findIndex((current) => fold(current.name) === fold(place.name)
      && fold(current.state) === fold(place.state)
      && getDistance(current, place) <= 500);
    const current = best[index];
    if (!current) {
      best.push(place);
      continue;
    }
    if (kindRank(place.kind) < kindRank(current.kind)) best[index] = place;
    // Same rank, but one of them knows where it is: keep the fuller line.
    else if (kindRank(place.kind) === kindRank(current.kind) && place.detail.length > current.detail.length) {
      best[index] = place;
    }
  }

  return best;
}

/** Rough kilometres between two points. Only ever used to compare candidates. */
/**
 * Orders suggestions for a query.
 *
 *   1. what the visitor typed, matched at the start of the name
 *   2. what kind of place it is
 *   3. how close it is to them, when we know where they are
 *
 * The provider's own relevance breaks nothing further: it arrives sorted, and a
 * stable sort keeps that order inside each tier.
 */
export function rankPlaces(places: GeoPlace[], query: string, near?: Coords | null): GeoPlace[] {
  const needle = fold(query);

  return places
    .map((place, index) => {
      const name = fold(place.name);
      const match = name === needle ? 0 : name.startsWith(needle) ? 1 : 2;
      const distance = near ? Math.floor(getDistance(place, near) / 30_000) : 0;
      return { place, index, match, distance };
    })
    .sort((a, b) => {
      if (a.match !== b.match) return a.match - b.match;
      const rank = kindRank(a.place.kind) - kindRank(b.place.kind);
      if (rank !== 0) return rank;
      // Within 30 km is "the same place as far as the visitor cares"; past
      // that, nearer wins so a Kerala search does not open with Karnataka.
      const gap = a.distance - b.distance;
      if (gap !== 0) return gap;
      return a.index - b.index;
    })
    .map((entry) => entry.place);
}
