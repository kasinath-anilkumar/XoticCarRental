/**
 * The bundled index — `data/india-cities.json`, every Indian town over 10,000
 * people, generated from the `all-the-cities` GeoNames dataset by
 * `npm --prefix backend run geocode`.
 *
 * It used to be the only source of suggestions. It is now the floor under the
 * live geocoder: it answers instantly, it answers offline, and it answers when
 * a provider is down. It ranks by population, which is the one thing a live
 * provider is weakest at — a search for "kochi" should open with the city of
 * two million, not a road named after it.
 *
 * ~260 KB, read once into module scope, never shipped to the browser.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { fold } from "../places";

import type { GeoKind, GeoPlace } from "./types";

export interface IndexedPlace {
  name: string;
  lat: number;
  lng: number;
  state: string;
  population: number;
  /** Former names, so "Kochi" finds the row GeoNames still calls "Cochin". */
  aka?: string[];
}

let cache: IndexedPlace[] | null = null;
let loading: Promise<IndexedPlace[]> | null = null;
/** The index is missing for every request once it is missing for one. */
let warned = false;

/** Empty when the index has not been generated — callers degrade, not fail. */
export async function loadIndex(): Promise<IndexedPlace[]> {
  if (cache) return cache;

  // One read shared between every request that arrives during a cold start.
  loading ??= readFile(join(process.cwd(), "data", "india-cities.json"), "utf8")
    .then((raw) => {
      cache = JSON.parse(raw) as IndexedPlace[];
      return cache;
    })
    .catch((error) => {
      if (!warned) {
        warned = true;
        console.warn(
          `[geo] data/india-cities.json is unavailable (${error instanceof Error ? error.message : error}) — ` +
            "suggestions come from the live geocoder alone. Run `npm --prefix backend run geocode` to rebuild it.",
        );
      }
      // Left retryable: the file is a build artefact, and generating it
      // should not need a restart to take effect.
      loading = null;
      return [];
    });

  return loading;
}

function kindFor(population: number): GeoKind {
  if (population >= 300_000) return "city";
  if (population >= 25_000) return "town";
  return "village";
}

export function toGeoPlace(place: IndexedPlace): GeoPlace {
  return {
    id: `index:${place.name},${place.lat},${place.lng}`,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    detail: place.state,
    state: place.state,
    city: place.name,
    country: "India",
    countryCode: "IN",
    kind: kindFor(place.population),
  };
}

export interface IndexMatch {
  place: IndexedPlace;
  /** 0 when the name (or a former name) starts with the query, 1 when it merely contains it. */
  rank: number;
}

/**
 * Matches the index, prefix-first and population-ordered within each tier.
 * Returns the raw rows so the admin form can still show population and aliases.
 */
export async function searchIndex(query: string, limit = 8): Promise<IndexMatch[]> {
  // This generated snapshot covers India only; never use it for another country.
  if ((process.env.GEOCODER_COUNTRY ?? "in").toLowerCase() !== "in") return [];
  limit = Number.isFinite(limit) ? Math.min(20, Math.max(1, Math.trunc(limit))) : 8;
  const needle = fold(query);
  if (needle.length < 2 || needle.length > 200) return [];

  const all = await loadIndex();

  return all
    .map((place): IndexMatch | null => {
      const name = fold(place.name);
      const aliases = place.aka?.map(fold) ?? [];
      if (name.startsWith(needle) || aliases.some((alias) => alias.startsWith(needle))) {
        return { place, rank: 0 };
      }
      if (name.includes(needle) || aliases.some((alias) => alias.includes(needle))) {
        return { place, rank: 1 };
      }
      return null;
    })
    .filter((match): match is IndexMatch => match !== null)
    .sort((a, b) => a.rank - b.rank || b.place.population - a.place.population)
    .slice(0, limit);
}
