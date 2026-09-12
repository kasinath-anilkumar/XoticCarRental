/**
 * Live place lookup.
 *
 * `data/india-cities.json` — 2,948 towns over 10,000 people — is a floor, not
 * the answer: a customer asking to be picked up from a village of 4,000, a
 * resort, a temple or a terminal building was not in it, and typing the name of
 * one returned nothing. This module puts a real geocoder behind the search box
 * so the suggestions are as detailed as the map is.
 *
 * Server-only. The browser never talks to a provider directly — it goes through
 * `/api/places`, which is where the key (if there is one), the cache and the
 * rate limit live.
 *
 *   GEOCODER_PROVIDER   photon (default) | openstreetmap | locationiq | google | …
 *   GEOCODER_API_KEY    required by the keyed providers, unused by the default
 *   GEOCODER_COUNTRY    ISO code results are confined to. "in".
 *   GEOCODER_CONTACT    an address a provider can reach us on
 *   PHOTON_URL          a self-hosted Photon, instead of the public instance
 *
 * Every failure — a provider outage, a rate limit, a timeout, no network at all
 * — degrades to an empty result, and `/api/places` still answers from the
 * bundled index. A geocoding incident must not take the booking flow down.
 */

import { fold } from "../places";

import { createInflight, createThrottle, TtlCache } from "../net/cache";
import { dedupe, rankPlaces } from "./normalize";
import { createPhotonProvider } from "./photon";
import type { Coords, GeoPlace, GeoProvider, SearchOptions } from "./types";

export type { Coords, GeoKind, GeoPlace } from "./types";
export { iconForKind } from "./normalize";

/** Place names do not change; this bounds memory and retries a sulking API. */
const TTL_MS = 6 * 60 * 60 * 1000;
const SEARCH_CACHE_SIZE = 500;
const REVERSE_CACHE_SIZE = 200;

const searchCache = new TtlCache<GeoPlace[]>(TTL_MS, SEARCH_CACHE_SIZE);
const reverseCache = new TtlCache<GeoPlace | null>(TTL_MS, REVERSE_CACHE_SIZE);
const inflightSearch = createInflight<GeoPlace[]>();
const inflightReverse = createInflight<GeoPlace | null>();

export function providerName(): string {
  return (process.env.GEOCODER_PROVIDER ?? "photon").toLowerCase();
}

function country(): string {
  return (process.env.GEOCODER_COUNTRY ?? "in").toLowerCase();
}

let cached: Promise<GeoProvider> | null = null;
let gate: (() => Promise<void>) | null = null;

/**
 * Builds the configured provider once.
 *
 * `node-geocoder` is imported only if it is actually the choice — the default
 * path never loads a CommonJS library, or its dependencies, at all.
 */
function provider(): Promise<GeoProvider> {
  cached ??= (async () => {
    const name = providerName();
    const built =
      name === "photon"
        ? createPhotonProvider(country())
        : await import("./node-geocoder").then((m) =>
            m.createNodeGeocoderProvider(name, country()),
          );
    gate = createThrottle(built.minIntervalMs);
    return built;
  })();
  return cached;
}

/**
 * One line per problem per minute.
 *
 * A provider that is down is down for every keystroke of every visitor; the
 * first log says so and the next thousand only make the outage harder to read.
 */
const lastLogged = new Map<string, number>();

function report(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const key = `${scope}:${message}`;
  const now = Date.now();
  if ((lastLogged.get(key) ?? 0) > now - 60_000) return;
  lastLogged.set(key, now);
  console.warn(`[geo] ${scope} failed via ${providerName()}: ${message}`);
}

/** Rounds a bias point to ~11 km, so nearby visitors share a cache entry. */
function nearKey(near: Coords | null | undefined): string {
  return near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : "";
}

/**
 * What a search came back with, and whether the provider was reachable at all.
 *
 * The two are worth telling apart. "No such place" and "the geocoder is down"
 * look identical from a list of zero results, and telling somebody their
 * village does not exist when the truth is that we could not ask is the worse
 * of the two mistakes.
 */
export interface PlaceSearch {
  places: GeoPlace[];
  /** False only when the provider errored, timed out or refused. */
  ok: boolean;
}

/**
 * Suggestions for what someone is typing.
 *
 * Ranked, deduped and capped. Never throws — the caller decides what an
 * unreachable provider should look like, and a search box that errors is worse
 * than one that is briefly less complete.
 */
export async function searchPlaces(
  query: string,
  options: SearchOptions = {},
): Promise<PlaceSearch> {
  const trimmed = query.trim();
  const limit = options.limit ?? 8;
  if (trimmed.length < 2) return { places: [], ok: true };

  const key = `${fold(trimmed)}|${limit}|${nearKey(options.near)}`;
  const hit = searchCache.get(key);
  if (hit) return { places: hit, ok: true };

  try {
    const places = await inflightSearch(key, async () => {
      const geo = await provider();
      await gate?.();
      const raw = await geo.search(trimmed, { ...options, limit });
      const results = rankPlaces(dedupe(raw), trimmed, options.near).slice(0, limit);
      searchCache.set(key, results);
      return results;
    });
    return { places, ok: true };
  } catch (error) {
    report("search", error);
    return { places: [], ok: false };
  }
}

/**
 * What is at a point — the name for "use my current location".
 *
 * The visitor's own coordinates are what get priced; this only supplies the
 * label, so a failure here costs a nice name, not the pickup.
 */
export async function reversePlace(
  at: Coords,
  options: { signal?: AbortSignal } = {},
): Promise<GeoPlace | null> {
  if (!Number.isFinite(at.lat) || !Number.isFinite(at.lng)) return null;

  // 4 dp is ~11 m — two taps from the same pavement share an answer.
  const key = `${at.lat.toFixed(4)},${at.lng.toFixed(4)}`;
  const hit = reverseCache.get(key);
  if (hit !== undefined) return hit;

  try {
    return await inflightReverse(key, async () => {
      const geo = await provider();
      await gate?.();
      const place = await geo.reverse(at, options);
      reverseCache.set(key, place);
      return place;
    });
  } catch (error) {
    report("reverse", error);
    return null;
  }
}
