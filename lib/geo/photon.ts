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
    type?: string;
  };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

function toPlace(feature: PhotonFeature): GeoPlace | null {
  const p = feature?.properties;
  if (!p) return null;
  const [lng, lat] = feature.geometry?.coordinates ?? [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat!) > 90 || Math.abs(lng!) > 180) return null;

  // An unnamed row is a house number or a bare postcode — nothing a customer
  // could pick out of a list.
  const name = (p.name?.trim() || [p.housenumber, p.street].filter(Boolean).join(" ").trim()).slice(0, 160);
  if (!name) return null;

  return {
    id: p.osm_type && p.osm_id ? `osm:${p.osm_type}${p.osm_id}` : `at:${lat},${lng}`,
    name,
    lat,
    lng,
    detail: detailLine([p.street, p.district, p.city, p.county, p.state], name),
    state: p.state ?? "",
    city: p.city,
    locality: p.district,
    country: p.country,
    countryCode: p.countrycode?.toUpperCase(),
    kind: p.type === "state" || p.type === "country" ? p.type : kindFromOsm(p.osm_key, p.osm_value),
  };
}

export function createPhotonProvider(country: string): GeoProvider {
  const endpoint = (process.env.PHOTON_URL ?? DEFAULT_ENDPOINT).replace(/\/$/, "");
  const code = country.toLowerCase();

  const inCountry = (feature: PhotonFeature) =>
    !code || (feature?.properties?.countrycode ?? "").toLowerCase() === code;

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
      // Photon restricts by ISO country code; no manually maintained borders.
      if (code) params.set("countrycode", code.toUpperCase());
      if (options.near) {
        params.set("lat", String(options.near.lat));
        params.set("lon", String(options.near.lng));
      }

      const data = await fetchJson<PhotonResponse>(`${endpoint}/api/?${params}`, {
        signal: options.signal,
      });

      if (!Array.isArray(data.features)) throw new Error("Invalid Photon response");
      return data.features.slice(0, 30)
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

      if (!Array.isArray(data.features)) throw new Error("Invalid Photon response");
      const feature = data.features.find(inCountry);
      return feature ? toPlace(feature) : null;
    },
  };
}
