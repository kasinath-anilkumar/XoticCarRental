/**
 * The shape every geocoding provider is normalised into.
 *
 * Providers disagree about almost everything — Photon answers GeoJSON with OSM
 * tags, Nominatim answers an address object, Google answers address components
 * — so nothing above `lib/geo/` ever sees a provider's own response. It sees a
 * `GeoPlace`: a name, a point, and a line of context to disambiguate the four
 * Kalpettas from each other.
 */

/**
 * What kind of thing a suggestion is. Only used for ranking and for the icon
 * beside it — pricing treats every place identically.
 */
export type GeoKind =
  | "city"
  | "town"
  | "village"
  | "suburb"
  | "locality"
  | "airport"
  | "station"
  | "landmark"
  | "address";

export interface GeoPlace {
  /**
   * Stable within a provider (`osm:N:12345`), synthesised from the coordinates
   * otherwise. Only used to dedupe a single response.
   */
  id: string;
  /** "Vadakkenchery" — the label, never the full postal address. */
  name: string;
  lat: number;
  lng: number;
  /** "Alathur, Palakkad, Kerala" — the line under the name. */
  detail: string;
  /** Empty when the provider does not say. */
  state: string;
  kind: GeoKind;
}

export interface Coords {
  lat: number;
  lng: number;
}

export interface SearchOptions {
  limit?: number;
  /** Biases results towards the visitor when their position is known. */
  near?: Coords | null;
  signal?: AbortSignal;
}

/**
 * A geocoder. Two implementations ship: Photon (`photon.ts`, keyless, built for
 * type-ahead) and everything `node-geocoder` supports (`node-geocoder.ts`).
 */
export interface GeoProvider {
  /** For logs and the admin status line. */
  name: string;
  /** Minimum gap between upstream calls, in ms. Free services have limits. */
  minIntervalMs: number;
  search(query: string, options: SearchOptions): Promise<GeoPlace[]>;
  reverse(at: Coords, options?: { signal?: AbortSignal }): Promise<GeoPlace | null>;
}
