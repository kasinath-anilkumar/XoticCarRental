/**
 * Route distance.
 *
 * The prototype invented distance: every location carried made-up `x`/`y`
 * integers and `dist()` ran `Math.hypot` over them. Real quotes need real km,
 * so locations now carry latitude/longitude (seeded from the `all-the-cities`
 * GeoNames dataset for cities, hand-entered for airports, jetties and temples)
 * and distance is haversine, scaled by a circuity factor.
 *
 * Why a factor: haversine is straight-line. Indian road distance runs roughly a
 * quarter longer — Delhi→Agra is 180 km direct and 233 km by road, Kochi→Munnar
 * 105 vs 130. The factor lives in `site_settings` so it can be tuned without a
 * deploy.
 *
 * The estimate is now the *last* resort, not the only one. A specific trip is
 * routed for real (`lib/route`), and the router's per-leg distances arrive here
 * as overrides. Three sources, in order:
 *
 *   1. a published `km_override` — somebody measured it and we stand by it
 *   2. the router — the roads the map is drawing, so the two always agree
 *   3. haversine × circuity — when there is no router to ask
 */

import { getDistance } from "geolib";
import type { ResolvedPlace } from "./places";
import type { CityRoute, TripType } from "./types";

/** Internal endpoint marker; transfer positions distinguish it from customer stops. */
export const GARAGE_ROUTE_KEY = "#vehicle-garage";

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Great-circle distance in km, unrounded. */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  // geolib works in metres and takes {latitude, longitude}.
  const metres = getDistance(
    { latitude: a.lat, longitude: a.lng },
    { latitude: b.lat, longitude: b.lng },
    1,
  );
  return metres / 1000;
}

/**
 * Published road distances, keyed both ways round.
 *
 * A route with a `km_override` is a distance somebody measured — it beats the
 * estimate everywhere, not only on the city page that publishes it. Without
 * this, the fare table would quote Kochi→Munnar at 130 km while the calculator
 * quoted 108 km for the same two points, and the customer would be right to
 * distrust both.
 */
export type KmOverrides = Map<string, number>;

export function buildKmOverrides(routes: CityRoute[]): KmOverrides {
  const overrides: KmOverrides = new Map();
  for (const route of routes) {
    if (route.kmOverride == null) continue;
    overrides.set(overrideKey(route.fromSlug, route.toSlug), route.kmOverride);
    overrides.set(overrideKey(route.toSlug, route.fromSlug), route.kmOverride);
  }
  return overrides;
}

function overrideKey(from: string, to: string): string {
  return `${from}|${to}`;
}

/**
 * The router's answer for one trip, in the shape `roadKm` already understands.
 *
 * Directional, unlike the published table: a router is entitled to send you
 * home a different way, and this only ever describes the legs of the trip in
 * front of it. The configured billing floor applies to routed legs too.
 */
export function buildRoutedOverrides(
  stops: Array<{ key: string }>,
  legs: Array<{ km: number }>,
  minimumLegKm = 0,
): KmOverrides {
  const measured: KmOverrides = new Map();
  for (const [index, leg] of legs.entries()) {
    const from = stops[index];
    const to = stops[index + 1];
    if (!from || !to || from.key === to.key) continue;
    measured.set(overrideKey(from.key, to.key), Math.max(minimumLegKm, Math.round(leg.km)));
  }
  return measured;
}

/**
 * Road distance between two points, in whole km.
 *
 * Identical points are zero. Other legs use the configured billing floor;
 * callers doing pure distance calculations may omit the floor.
 */
export function roadKm(
  from: ResolvedPlace,
  to: ResolvedPlace,
  circuityFactor: number,
  overrides?: KmOverrides,
  minimumLegKm = 0,
): number {
  if (samePoint(from, to)) return 0;
  // A measured distance — published by staff, or handed over by the router for
  // this particular trip — always beats the estimate.
  const measured = overrides?.get(overrideKey(from.key, to.key));
  if (measured != null) return measured;
  const straight = haversineKm(from, to);
  return Math.max(minimumLegKm, Math.round(straight * circuityFactor));
}

export interface RouteInput {
  /** The itinerary in visiting order: pickup, event stops, final drop. */
  stops: ResolvedPlace[];
  /** Where the vehicle is based. Null prices the trip without transfer legs. */
  garage: Coordinates | null;
  tripType: TripType;
  /** Road measurements for the complete vehicle route, in consecutive order. */
  routedLegs?: ReadonlyArray<{ km: number }>;
}

function samePoint(from: ResolvedPlace, to: ResolvedPlace): boolean {
  return from.lat === to.lat && from.lng === to.lng;
}

/** The exact points sent to the router and priced, including an explicit return. */
export function routePoints({ stops, garage, tripType }: RouteInput): ResolvedPlace[] {
  if (stops.length < 2) return [];
  const itinerary = [...stops];
  // A third stop is already an explicit final drop. Only a two-stop round
  // trip leaves its return destination unstated.
  if (tripType === "round" && stops.length === 2 && !samePoint(stops[0]!, stops[1]!)) {
    itinerary.push(stops[0]!);
  }
  if (!garage) return itinerary;
  const yard: ResolvedPlace = {
    key: GARAGE_ROUTE_KEY, name: "Garage", lat: garage.lat, lng: garage.lng,
    citySlug: "", isAirport: false, served: false,
  };
  return [yard, ...itinerary, yard];
}

export interface RouteLeg {
  fromSlug: string;
  toSlug: string;
  km: number;
  /** True for the two legs that move the empty vehicle to and from its yard. */
  transfer?: boolean;
}

export interface RouteResult {
  legs: RouteLeg[];
  /** Total billable distance; stationary itineraries may be zero. */
  km: number;
  /** The part of it the customer travels in the car. */
  itineraryKm: number;
  /** The part of it the vehicle drives empty, to reach them and to go home. */
  transferKm: number;
}

/**
 * Total route distance, garage to garage.
 *
 * §9: the priced distance is
 *
 *   vehicle garage → pickup → event(s) → final drop → vehicle garage
 *
 * because that is the vehicle's whole working day. A Kochi car doing a
 * Kottayam wedding drives to Kottayam empty and comes home empty, and pricing
 * only the middle of that was quoting away two dead-head legs.
 *
 * Every distance belongs to an actual consecutive leg. A two-stop round trip
 * adds a return to pickup; a longer itinerary already specifies its final drop.
 */
export function resolveRoute(
  input: RouteInput,
  circuityFactor: number,
  overrides?: KmOverrides,
  minimumLegKm = 0,
): RouteResult {
  const points = routePoints(input);
  const legs: RouteLeg[] = [];
  if (points.length < 2) {
    return { legs, km: 0, itineraryKm: 0, transferKm: 0 };
  }
  const routedLegs = input.routedLegs?.length === points.length - 1 ? input.routedLegs : undefined;
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const routedKm = routedLegs?.[i]?.km;
    const transfer = Boolean(input.garage) && (i === 0 || i === points.length - 2);
    // Keep measurements indexed by leg: visiting the same pair twice need
    // not produce the same route. Published distances retain precedence.
    // Published routes describe customer places, not our synthetic yard marker.
    const measured = transfer ? undefined : overrides?.get(overrideKey(from.key, to.key));
    const km = samePoint(from, to) ? 0 : measured ?? (
      routedKm != null && Number.isFinite(routedKm) && routedKm >= 0
        ? Math.max(minimumLegKm, Math.round(routedKm))
        : roadKm(from, to, circuityFactor, undefined, minimumLegKm)
    );
    legs.push({
      fromSlug: from.key,
      toSlug: to.key,
      km,
      ...(transfer ? { transfer: true } : {}),
    });
  }
  const itineraryKm = legs.reduce((sum, leg) => sum + (leg.transfer ? 0 : leg.km), 0);
  const transferKm = legs.reduce((sum, leg) => sum + (leg.transfer ? leg.km : 0), 0);
  const total = itineraryKm + transferKm;
  return { legs, km: total, itineraryKm, transferKm };
}

/**
 * Distance for a named city route, preferring the published override.
 * Used by the city pages' "fares people ask for most" table.
 */
export function cityRouteKm(
  route: CityRoute,
  from: ResolvedPlace,
  to: ResolvedPlace,
  circuityFactor: number,
  minimumLegKm = 0,
): number {
  return route.kmOverride ?? roadKm(from, to, circuityFactor, undefined, minimumLegKm);
}
