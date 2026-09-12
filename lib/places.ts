/**
 * Places: where a trip starts, ends and returns to.
 *
 * A trip used to be pinned to the 33 curated pickup points in the database. It
 * no longer is. Every location we know carries latitude and longitude, and a
 * geocoder supplies coordinates for everywhere else (lib/geo) — so any place on
 * the map can anchor a quote. A visitor can ask for a car to a village of four
 * thousand people, and be quoted for it.
 *
 * Two kinds of place, therefore:
 *
 *   served  one of our own locations. Eligible for the published road
 *           distances under Route fares. No longer offered as a suggestion —
 *           it reaches a trip through a city page's fare table or an older
 *           link, and this is what resolves it back to a name.
 *   free    anywhere the geocoder can find, which is what a visitor actually
 *           picks. Priced from its coordinates like any other point; it simply
 *           has no published distance to fall back on.
 *
 * Both travel through the URL as a single token so a quote stays a shareable
 * link:
 *
 *   kochi-marine              a served point, by slug
 *   @10.0889,77.0595,Munnar   a free place, by coordinates
 *
 * The name comes last in the token so it may contain commas without ambiguity.
 */

import type { GeoKind, GeoPlace } from "./geo/types";
import type { LocationPoint } from "./types";

/** A place as it travels through URLs, form state and the enquiry API. */
export type PlaceToken = string;

export interface ResolvedPlace {
  /** Stable identity: the slug for a served point, the token for a free one. */
  key: string;
  name: string;
  lat: number;
  lng: number;
  /** The city a served point belongs to. Empty for a free place. */
  citySlug: string;
  isAirport: boolean;
  /** True when this is one of our curated pickup points. */
  served: boolean;
}

const FREE_PREFIX = "@";

export function isFreePlace(token: PlaceToken): boolean {
  return token.startsWith(FREE_PREFIX);
}

export function encodeFreePlace(place: { name: string; lat: number; lng: number }): PlaceToken {
  // Five decimals is ~1 m — far finer than any road-distance estimate needs,
  // and it keeps the token short enough to stay readable in a shared link.
  const lat = Number(place.lat.toFixed(5));
  const lng = Number(place.lng.toFixed(5));
  return `${FREE_PREFIX}${lat},${lng},${place.name}`;
}

/** Parses a free-place token. Returns null for a slug or anything malformed. */
export function decodeFreePlace(token: PlaceToken): ResolvedPlace | null {
  if (!isFreePlace(token)) return null;

  const body = token.slice(FREE_PREFIX.length);
  const firstComma = body.indexOf(",");
  const secondComma = body.indexOf(",", firstComma + 1);
  if (firstComma === -1 || secondComma === -1) return null;

  const lat = Number(body.slice(0, firstComma));
  const lng = Number(body.slice(firstComma + 1, secondComma));
  const name = body.slice(secondComma + 1).trim();

  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { key: token, name, lat, lng, citySlug: "", isAirport: false, served: false };
}

export function fromServed(location: LocationPoint): ResolvedPlace {
  return {
    key: location.slug,
    name: location.name,
    lat: location.lat,
    lng: location.lng,
    citySlug: location.citySlug,
    isAirport: location.isAirport,
    served: true,
  };
}

/**
 * Resolves a token against the served locations, falling back to a free place.
 * Returns null only when the token names nothing we can place on the map.
 */
export function resolvePlace(
  token: PlaceToken | null | undefined,
  locations: LocationPoint[],
): ResolvedPlace | null {
  if (!token) return null;

  const free = decodeFreePlace(token);
  if (free) return free;

  const served = locations.find((location) => location.slug === token);
  return served ? fromServed(served) : null;
}

/** Diacritic- and case-insensitive, so "Rishikesh" matches "Rishīkesh". */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export interface PlaceSuggestion {
  token: PlaceToken;
  name: string;
  /** "Ambalappuzha, Kerala" — the line under the name. */
  detail: string;
  /** One of our own pickup points. Always false for a geocoded suggestion. */
  served: boolean;
  isAirport: boolean;
  /** What the geocoder called it, when it came from one. Picks the icon. */
  kind?: GeoKind;
}

/**
 * A geocoded place as the combobox wants it.
 *
 * The token carries the coordinates, so a suggestion the visitor picks needs no
 * second round trip to be priced — and stays a shareable link.
 */
export function suggestionFromGeo(place: GeoPlace): PlaceSuggestion {
  return {
    token: encodeFreePlace(place),
    name: place.name,
    detail: place.detail,
    served: false,
    isAirport: place.kind === "airport",
    kind: place.kind,
  };
}
