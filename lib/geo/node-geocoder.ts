/**
 * Every other provider, through `node-geocoder`.
 *
 * Photon covers the default case for free, but a busy operator may want an
 * account with somebody who signs an SLA — or may already have a Google key.
 * `node-geocoder` speaks to all of them (Nominatim, LocationIQ, OpenCage,
 * Google, Mapbox, HERE, TomTom, PickPoint…) and normalises the answers, so
 * switching is `GEOCODER_PROVIDER=locationiq` and a key, not a rewrite.
 *
 * The library is server-only and CommonJS: it must never be imported from a
 * client component. Nothing here is — the browser talks to `/api/places`.
 */

import NodeGeocoder from "node-geocoder";

import { detailLine, kindFromOsm } from "./normalize";
import { userAgent } from "../net/http";
import type { Coords, GeoKind, GeoPlace, GeoProvider, SearchOptions } from "./types";

/**
 * Providers that speak Nominatim's parameters. They take a country filter and
 * a result limit upstream, which the rest have to be filtered for afterwards.
 */
const NOMINATIM_LIKE = new Set(["openstreetmap", "locationiq", "pickpoint", "openmapquest", "nominatimmapquest"]);

/** Nominatim's published limit is one request a second, and it is enforced. */
const NOMINATIM_INTERVAL_MS = 1100;

/** A raw Nominatim row, for the two fields the library drops. */
interface NominatimRaw {
  name?: string;
  class?: string;
  type?: string;
  display_name?: string;
  addresstype?: string;
  address?: { state?: string; city?: string; town?: string; village?: string; county?: string; suburb?: string; country?: string; country_code?: string };
  types?: string[];
}

type Entry = NodeGeocoder.Entry & {
  county?: string;
  neighbourhood?: string;
  extra?: { confidence?: number; googlePlaceId?: string; neighborhood?: string };
};

/**
 * The label to show.
 *
 * Nominatim 4.3+ returns a bare `name` ("Vadakkenchery"); older rows and other
 * providers give only a formatted address, whose first segment is the same
 * thing ("Vadakkenchery, Alathur, Palakkad, …"). Falling through to the city
 * covers a reverse lookup in open country, where there is no address at all.
 */
function labelFor(entry: Entry, raw: NominatimRaw | undefined): string {
  const fromRaw = raw?.name?.trim();
  if (fromRaw) return fromRaw;

  const head = entry.formattedAddress?.split(",")[0]?.trim();
  if (head) return head;

  return entry.city?.trim() || entry.state?.trim() || entry.administrativeLevels?.level1long?.trim() || "";
}

/**
 * What kind of place it is.
 *
 * Only the Nominatim family reports it (`class`/`type`). For everyone else a
 * result that is only a road is an address and everything else is a locality —
 * enough for ordering, and honest about what the provider actually said.
 */
function kindFor(entry: Entry, raw: NominatimRaw | undefined): GeoKind {
  if (raw?.addresstype || raw?.class || raw?.type) return kindFromOsm(raw.class, raw.addresstype ?? raw.type);
  if (raw?.types?.includes("administrative_area_level_1")) return "state";
  if (raw?.types?.includes("country")) return "country";
  if (raw?.types?.some((value) => value === "locality" || value === "postal_town")) return "city";
  if (raw?.types?.includes("airport")) return "airport";
  if (entry.streetName && entry.streetName === entry.formattedAddress?.split(",")[0]?.trim()) {
    return "address";
  }
  return "locality";
}

function toPlace(entry: Entry, raw: NominatimRaw | undefined): GeoPlace | null {
  const { latitude: lat, longitude: lng } = entry;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat!) > 90 || Math.abs(lng!) > 180) return null;

  const name = labelFor(entry, raw).slice(0, 160);
  if (!name) return null;

  // The formatted address is the fallback context: whatever the provider chose
  // to say after the name, minus the country it always ends with.
  const trail = (entry.formattedAddress ?? "")
    .split(",")
    .slice(1, -1)
    .map((part) => part.trim());

  const state = entry.state || entry.administrativeLevels?.level1long || raw?.address?.state || "";
  const city = entry.city || raw?.address?.city || raw?.address?.town || raw?.address?.village;
  const locality = entry.neighbourhood || entry.extra?.neighborhood || raw?.address?.suburb;
  return {
    id: entry.extra?.googlePlaceId ? `google:${entry.extra.googlePlaceId}` : `${entry.provider ?? "geo"}:${lat},${lng}`,
    name,
    lat: lat as number,
    lng: lng as number,
    detail: detailLine(
      [locality, city, entry.county || raw?.address?.county, state, ...trail],
      name,
    ),
    state,
    city,
    locality,
    country: entry.country || raw?.address?.country,
    countryCode: (entry.countryCode || raw?.address?.country_code)?.toUpperCase(),
    kind: kindFor(entry, raw),
  };
}

/** node-geocoder hangs `raw` — the provider's untouched response — on the array. */
function rawRows(results: unknown): NominatimRaw[] {
  const raw = (results as { raw?: unknown }).raw;
  if (Array.isArray(raw)) return raw as NominatimRaw[];
  if (raw && typeof raw === "object") {
    const rows = (raw as { results?: NominatimRaw[] }).results;
    return Array.isArray(rows) ? rows : [raw as NominatimRaw];
  }
  return [];
}

export function createNodeGeocoderProvider(provider: string, country: string): GeoProvider {
  const nominatimLike = NOMINATIM_LIKE.has(provider);
  const code = country.toLowerCase();

  // The cast is two mismatches, both benign: `provider` is a string chosen at
  // runtime rather than one of the union members, and the published typings
  // describe `fetch` as node-fetch's, while what the library is handed here is
  // the platform's. The shapes it actually uses — url in, response out — agree.
  const configuredEndpoint = process.env.NOMINATIM_URL;
  const publicNominatim = provider === "openstreetmap" && (!configuredEndpoint || new URL(configuredEndpoint).hostname === "nominatim.openstreetmap.org");
  // Instantiate per operation so cancellation never leaks between callers.
  const geocoder = (signal?: AbortSignal) => NodeGeocoder({
    provider,
    apiKey: process.env.GEOCODER_API_KEY,
    language: "en",
    // Nominatim wants to know who is calling, and every provider is happier
    // with a request that identifies itself.
    fetch: async (url: string, init: RequestInit | undefined) => {
      signal?.throwIfAborted();
      const endpoint = new URL(url);
      // Several installed adapters still emit HTTP URLs, including keyed ones.
      if (endpoint.protocol === "http:" && !(provider === "openstreetmap" && configuredEndpoint && !publicNominatim)) endpoint.protocol = "https:";
      const headers = new Headers(init?.headers);
      headers.set("User-Agent", userAgent());
      const timeout = AbortSignal.timeout(4_500);
      const response = await fetch(endpoint, { ...init, headers, cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      if (!response.ok) throw new Error(`Geocoder HTTP ${response.status}`);
      return response;
    },
    ...(provider === "openstreetmap"
      ? { osmServer: configuredEndpoint ?? "https://nominatim.openstreetmap.org" }
      : {}),
    // Nominatim asks for a contact address on heavy use; it is optional and
    // harmless everywhere else.
    ...(nominatimLike && process.env.GEOCODER_CONTACT?.includes("@")
      ? { email: process.env.GEOCODER_CONTACT }
      : {}),
  } as unknown as NodeGeocoder.Options);

  // A provider that does not report a country is taken at its word rather
  // than filtered away — several only fill it in for some result types.
  const inCountry = (place: GeoPlace) => !code || place.countryCode?.toLowerCase() === code;

  return {
    name: provider,
    minIntervalMs: nominatimLike ? NOMINATIM_INTERVAL_MS : 0,

    async search(query: string, options: SearchOptions = {}) {
      // The public OSM service explicitly prohibits autocomplete requests.
      if (publicNominatim) throw new Error("Autocomplete requires Photon, a contracted provider or a private Nominatim endpoint");
      const limit = Math.min(20, (options.limit ?? 8) * 2);
      // Nominatim's parameters are its own; everyone else takes a plain string
      // and is filtered for country on the way out.
      const value = nominatimLike
        ? { q: query, countrycodes: code, limit, addressdetails: 1 }
        : query;

      let results: Entry[];
      try {
        results = (await geocoder(options.signal).geocode(value as string)) as Entry[];
      } catch (error) {
        // node-geocoder treats Google's successful zero-results status as an error.
        if (provider === "google" && error instanceof Error && error.message.startsWith("Status is ZERO_RESULTS.")) return [];
        throw error;
      }
      const raw = rawRows(results);

      return results.slice(0, 30)
        .map((entry, index) => {
          const place = toPlace(entry, raw[index]);
          return place && inCountry(place) ? place : null;
        })
        .filter((place): place is GeoPlace => place !== null);
    },

    async reverse(at: Coords, options = {}) {
      let results: Entry[];
      try {
        results = (await geocoder(options.signal).reverse({ lat: at.lat, lon: at.lng })) as Entry[];
      } catch (error) {
        if (provider === "google" && error instanceof Error && error.message.startsWith("Status is ZERO_RESULTS.")) return null;
        throw error;
      }
      const raw = rawRows(results);
      return results.slice(0, 30).map((entry, index) => toPlace(entry, raw[index])).find((place) => place && inCountry(place)) ?? null;
    },
  };
}
