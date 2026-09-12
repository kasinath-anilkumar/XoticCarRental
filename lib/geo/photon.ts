/**
 * Photon — the default provider.
 *
 * Photon is Komoot's OpenStreetMap search, and the reason it is the default is
 * that it is built for type-ahead where the alternatives are built for lookup.
 * Nominatim answers "Vadakkench" with nothing at all; Photon answers it with
 * Vadakkenchery, because it indexes prefixes. For a search box over Indian
 * villages that difference is the whole feature.
 *
 * It needs no key and no account. `PHOTON_URL` points at a self-hosted instance
 * for anyone who would rather not lean on the public one.
 *
 * https://photon.komoot.io — the API is the `/api` and `/reverse` endpoints,
 * both answering GeoJSON.
 */

import { fetchJson } from "../net/http";
import { detailLine, kindFromOsm } from "./normalize";
import type { Coords, GeoPlace, GeoProvider, SearchOptions } from "./types";

const DEFAULT_ENDPOINT = "https://photon.komoot.io";

/**
 * Country boxes bias a search without confining it.
 *
 * Photon has no country filter — `bbox` only weights results, so Nepal still
 * turns up on "airport". The hard filter is on `countrycode` below; this just
 * puts Indian answers first for a site that only drives in India.
 */
const COUNTRY_BBOX: Record<string, string> = {
  in: "68.1,6.5,97.4,35.7",
};

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    postcode?: string;
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

function toPlace(feature: PhotonFeature): GeoPlace | null {
  const p = feature.properties;
  const [lng, lat] = feature.geometry?.coordinates ?? [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // An unnamed row is a house number or a bare postcode — nothing a customer
  // could pick out of a list.
  const name = p.name?.trim() || p.street?.trim();
  if (!name) return null;

  return {
    id: p.osm_type && p.osm_id ? `osm:${p.osm_type}${p.osm_id}` : `at:${lat},${lng}`,
    name,
    lat,
    lng,
    detail: detailLine([p.street, p.district, p.city, p.county, p.state], name),
    state: p.state ?? "",
    kind: kindFromOsm(p.osm_key, p.osm_value),
  };
}

export function createPhotonProvider(country: string): GeoProvider {
  const endpoint = (process.env.PHOTON_URL ?? DEFAULT_ENDPOINT).replace(/\/$/, "");
  const code = country.toLowerCase();
  const bbox = COUNTRY_BBOX[code];

  const inCountry = (feature: PhotonFeature) =>
    !code || (feature.properties.countrycode ?? "").toLowerCase() === code;

  return {
    name: "photon",
    // The public instance asks only for fair use. A short gap keeps a fast
    // typist from turning one search box into a load test.
    minIntervalMs: 120,

    async search(query, options: SearchOptions = {}) {
      const params = new URLSearchParams({
        q: query,
        // Over-fetch: the country filter and dedupe both cut the list down,
        // and a request that comes back with two rows was wasted.
        limit: String(Math.min(30, (options.limit ?? 8) * 3)),
        lang: "en",
      });
      if (bbox) params.set("bbox", bbox);
      if (options.near) {
        params.set("lat", String(options.near.lat));
        params.set("lon", String(options.near.lng));
      }

      const data = await fetchJson<PhotonResponse>(`${endpoint}/api/?${params}`, {
        signal: options.signal,
      });

      return (data.features ?? [])
        .filter(inCountry)
        .map(toPlace)
        .filter((place): place is GeoPlace => place !== null);
    },

    async reverse(at: Coords, options = {}) {
      const params = new URLSearchParams({
        lat: String(at.lat),
        lon: String(at.lng),
        lang: "en",
        limit: "1",
      });

      const data = await fetchJson<PhotonResponse>(`${endpoint}/reverse?${params}`, {
        signal: options.signal,
      });

      const feature = data.features?.[0];
      return feature ? toPlace(feature) : null;
    },
  };
}
