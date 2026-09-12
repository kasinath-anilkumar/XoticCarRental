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
const NOMINATIM_LIKE = new Set(["openstreetmap", "pickpoint", "openmapquest", "nominatimmapquest"]);

/** Nominatim's published limit is one request a second, and it is enforced. */
const NOMINATIM_INTERVAL_MS = 1100;

/** A raw Nominatim row, for the two fields the library drops. */
interface NominatimRaw {
  name?: string;
  class?: string;
  type?: string;
  display_name?: string;
}

type Entry = NodeGeocoder.Entry & {
  county?: string;
  neighbourhood?: string;
  extra?: { confidence?: number };
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

  return entry.city?.trim() || entry.state?.trim() || "";
}

/**
 * What kind of place it is.
 *
 * Only the Nominatim family reports it (`class`/`type`). For everyone else a
 * result that is only a road is an address and everything else is a locality —
 * enough for ordering, and honest about what the provider actually said.
 */
function kindFor(entry: Entry, raw: NominatimRaw | undefined): GeoKind {
  if (raw?.class || raw?.type) return kindFromOsm(raw.class, raw.type);
  if (entry.streetName && entry.streetName === entry.formattedAddress?.split(",")[0]?.trim()) {
    return "address";
  }
  return "locality";
}

function toPlace(entry: Entry, raw: NominatimRaw | undefined): GeoPlace | null {
  const { latitude: lat, longitude: lng } = entry;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const name = labelFor(entry, raw);
  if (!name) return null;

  // The formatted address is the fallback context: whatever the provider chose
  // to say after the name, minus the country it always ends with.
  const trail = (entry.formattedAddress ?? "")
    .split(",")
    .slice(1, -1)
    .map((part) => part.trim());

  return {
    id: `${entry.provider ?? "geo"}:${lat},${lng}`,
    name,
    lat: lat as number,
    lng: lng as number,
    detail: detailLine(
      [entry.neighbourhood, entry.city, entry.county, entry.state, ...trail],
      name,
    ),
    state: entry.state ?? "",
    kind: kindFor(entry, raw),
  };
}

/** node-geocoder hangs `raw` — the provider's untouched response — on the array. */
function rawRows(results: unknown): NominatimRaw[] {
  const raw = (results as { raw?: unknown }).raw;
  return Array.isArray(raw) ? (raw as NominatimRaw[]) : [];
}

export function createNodeGeocoderProvider(provider: string, country: string): GeoProvider {
  const nominatimLike = NOMINATIM_LIKE.has(provider);
  const code = country.toLowerCase();

  // The cast is two mismatches, both benign: `provider` is a string chosen at
  // runtime rather than one of the union members, and the published typings
  // describe `fetch` as node-fetch's, while what the library is handed here is
  // the platform's. The shapes it actually uses — url in, response out — agree.
  const geocoder = NodeGeocoder({
    provider,
    apiKey: process.env.GEOCODER_API_KEY,
    language: "en",
    // Nominatim wants to know who is calling, and every provider is happier
    // with a request that identifies itself.
    fetch: (url: string, init: RequestInit | undefined) =>
      fetch(url, { ...init, headers: { ...init?.headers, "User-Agent": userAgent() } }),
    ...(provider === "openstreetmap" && process.env.NOMINATIM_URL
      ? { osmServer: process.env.NOMINATIM_URL }
      : {}),
    // Nominatim asks for a contact address on heavy use; it is optional and
    // harmless everywhere else.
    ...(nominatimLike && process.env.GEOCODER_CONTACT?.includes("@")
      ? { email: process.env.GEOCODER_CONTACT }
      : {}),
  } as unknown as NodeGeocoder.Options);

  // A provider that does not report a country is taken at its word rather
  // than filtered away — several only fill it in for some result types.
  const inCountry = (entry: Entry) =>
    !code || !entry.countryCode || entry.countryCode.toLowerCase() === code;

  return {
    name: provider,
    minIntervalMs: nominatimLike ? NOMINATIM_INTERVAL_MS : 0,

    async search(query: string, options: SearchOptions = {}) {
      const limit = Math.min(20, (options.limit ?? 8) * 2);
      // Nominatim's parameters are its own; everyone else takes a plain string
      // and is filtered for country on the way out.
      const value = nominatimLike
        ? { q: query, countrycodes: code, limit, addressdetails: 1 }
        : query;

      const results = (await geocoder.geocode(value as string)) as Entry[];
      const raw = rawRows(results);

      return results
        .map((entry, index) => {
          const place = toPlace(entry, raw[index]);
          return place && inCountry(entry) ? place : null;
        })
        .filter((place): place is GeoPlace => place !== null);
    },

    async reverse(at: Coords) {
      const results = (await geocoder.reverse({ lat: at.lat, lon: at.lng })) as Entry[];
      const entry = results[0];
      return entry ? toPlace(entry, rawRows(results)[0]) : null;
    },
  };
}
