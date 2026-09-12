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

import { TtlCache } from "../net/cache";
import { createRequestGate, createSharedRequests } from "./requests";
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
const inflightSearch = createSharedRequests<GeoPlace[]>();
const inflightReverse = createSharedRequests<GeoPlace | null>();

export function providerName(): string {
  return (process.env.GEOCODER_PROVIDER ?? "photon").toLowerCase();
}

export function country(): string {
  return (process.env.GEOCODER_COUNTRY ?? "in").toLowerCase();
}

let cached: Promise<GeoProvider> | null = null;
let gate: ((signal: AbortSignal) => Promise<void>) | null = null;

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
    gate = createRequestGate(built.minIntervalMs);
    return built;
  })().catch((error) => { cached = null; throw error; });
  return cached;
}

/**
 * One line per problem per minute.
 *
 * A provider that is down is down for every keystroke of every visitor; the
 * first log says so and the next thousand only make the outage harder to read.
 */
const lastLogged = new TtlCache<boolean>(60_000, 20);

function report(scope: string, error: unknown): void {
  // Provider errors can embed request URLs, API keys and a visitor's query.
  const kind = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "unavailable";
  const key = `${scope}:${kind}`;
  if (lastLogged.get(key)) return;
  lastLogged.set(key, true);
  console.warn(`[geo] ${scope} ${kind} via ${providerName()}; check provider configuration and connectivity.`);
}

/** Rounds a bias point to ~11 km, so nearby visitors share a cache entry. */
export function validCoords(at: Coords): boolean {
  return Number.isFinite(at.lat) && Number.isFinite(at.lng) && Math.abs(at.lat) <= 90 && Math.abs(at.lng) <= 180;
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
  const limit = Number.isFinite(options.limit) ? Math.min(20, Math.max(1, Math.trunc(options.limit!))) : 8;
  if (options.signal?.aborted) return { places: [], ok: false };
  if (trimmed.length < 2 || trimmed.length > 200) return { places: [], ok: true };
  // Canonicalise the actual bias as well as its key, so cached ranking agrees.
  const near = options.near && validCoords(options.near)
    ? { lat: Number(options.near.lat.toFixed(1)), lng: Number(options.near.lng.toFixed(1)) } : null;

  const key = `${providerName()}|${country()}|${fold(trimmed)}|${limit}|${near ? `${near.lat},${near.lng}` : ""}`;
  const hit = searchCache.get(key);
  if (hit) return { places: hit, ok: true };

  try {
    const places = await inflightSearch(key, async (signal) => {
      const geo = await provider();
      await gate?.(signal);
      const raw = await geo.search(trimmed, { limit, near, signal });
      signal.throwIfAborted();
      const results = rankPlaces(dedupe(raw), trimmed, near).slice(0, limit);
      searchCache.set(key, results);
      return results;
    }, options.signal);
    return { places, ok: true };
  } catch (error) {
    if (!options.signal?.aborted) report("search", error);
    return { places: [], ok: false };
  }
}

/**
 * What is at a point — the name for "use my current location".
 *
 * The visitor's own coordinates are what get priced; this only supplies the
 * label, so a failure here costs a nice name, not the pickup.
 */
export async function reverseLookup(
  at: Coords,
  options: { signal?: AbortSignal } = {},
): Promise<{ place: GeoPlace | null; ok: boolean }> {
  if (!validCoords(at) || options.signal?.aborted) return { place: null, ok: false };

  // 4 dp is ~11 m — two taps from the same pavement share an answer.
  const rounded = { lat: Number(at.lat.toFixed(4)), lng: Number(at.lng.toFixed(4)) };
  const key = `${providerName()}|${country()}|${rounded.lat},${rounded.lng}`;
  const hit = reverseCache.get(key);
  if (hit !== undefined) return { place: hit, ok: true };

  try {
    const place = await inflightReverse(key, async (signal) => {
      const geo = await provider();
      await gate?.(signal);
      const place = await geo.reverse(rounded, { signal });
      signal.throwIfAborted();
      reverseCache.set(key, place);
      return place;
    }, options.signal);
    return { place, ok: true };
  } catch (error) {
    if (!options.signal?.aborted) report("reverse", error);
    return { place: null, ok: false };
  }
}

export async function reversePlace(at: Coords, options: { signal?: AbortSignal } = {}): Promise<GeoPlace | null> {
  return (await reverseLookup(at, options)).place;
}
