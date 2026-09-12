/**
 * A driven route, normalised away from whichever router produced it.
 *
 * The site used to have no router at all: distance was the great-circle line
 * between two points times a circuity factor of 1.25, and the map drew that
 * line as a dashed geodesic with a note admitting it was not the roads. Both
 * are now real — the same response supplies the shape on the map and the
 * kilometres on the invoice, so the two can no longer disagree.
 */

/** `[latitude, longitude]`, the order Leaflet wants. */
export type LatLng = [number, number];

export interface RouteLeg {
  /** Road distance, in km, to one decimal. */
  km: number;
  /** Driving time in minutes, free-flow — no traffic model is involved. */
  minutes: number;
}

export interface RoutedTrip {
  /** One per pair of consecutive stops, in order. */
  legs: RouteLeg[];
  km: number;
  minutes: number;
  /**
   * The whole route as a polyline. Simplified by the provider: enough to look
   * like the road it follows, small enough to put in a JSON response.
   */
  path: LatLng[];
}

export interface RouteProvider {
  /** For logs and the response's `via` field. */
  name: string;
  /** Minimum gap between upstream calls, in ms. */
  minIntervalMs: number;
  /** Two or more stops, in visiting order. Throws if the router cannot say. */
  route(stops: LatLng[], options?: { signal?: AbortSignal }): Promise<RoutedTrip>;
}
