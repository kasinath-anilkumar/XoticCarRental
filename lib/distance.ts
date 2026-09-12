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

/** Below this, a "trip" is a pickup and drop in the same neighbourhood. */
export const MIN_LEG_KM = 6;

export const DEFAULT_CIRCUITY_FACTOR = 1.25;

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
 * front of it. The 6 km floor is applied here too — it is a billing rule about
 * what counts as a trip, not a hedge against a bad estimate.
 */
export function buildRoutedOverrides(
  stops: Array<{ key: string }>,
  legs: Array<{ km: number }>,
): KmOverrides {
  const measured: KmOverrides = new Map();
  for (const [index, leg] of legs.entries()) {
    const from = stops[index];
    const to = stops[index + 1];
    if (!from || !to || from.key === to.key) continue;
    measured.set(overrideKey(from.key, to.key), Math.max(MIN_LEG_KM, Math.round(leg.km)));
  }
  return measured;
}

/**
 * Road distance between two points, in whole km.
 *
 * Identical points are 0 (the prototype's `A === B` case). Anything else gets a
 * 6 km floor, so a hop across one neighbourhood still bills as a trip.
 */
export function roadKm(
  from: ResolvedPlace,
  to: ResolvedPlace,
  circuityFactor = DEFAULT_CIRCUITY_FACTOR,
  overrides?: KmOverrides,
): number {
  if (from.key === to.key) return 0;
  // A measured distance — published by staff, or handed over by the router for
  // this particular trip — always beats the estimate.
  const measured = overrides?.get(overrideKey(from.key, to.key));
  if (measured != null) return measured;
  const straight = haversineKm(from, to);
  return Math.max(MIN_LEG_KM, Math.round(straight * circuityFactor));
}

export interface RouteInput {
  /** The itinerary in visiting order: pickup, event stops, final drop. */
  stops: ResolvedPlace[];
  /** Where the vehicle is based. Null prices the trip without transfer legs. */
  garage: Coordinates | null;
  tripType: TripType;
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
  /** Total billable distance, never below 1. */
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
 * A round trip with no distinct final drop still doubles back over its own
 * itinerary, as it always did — the difference is that the doubling now
 * happens inside the itinerary, and the transfer legs are counted once.
 */
export function resolveRoute(
  input: RouteInput,
  circuityFactor = DEFAULT_CIRCUITY_FACTOR,
  overrides?: KmOverrides,
): RouteResult {
  const { stops, garage, tripType } = input;
  const legs: RouteLeg[] = [];

  if (stops.length < 2) {
    return { legs, km: 0, itineraryKm: 0, transferKm: 0 };
  }

  const km = (from: ResolvedPlace, to: ResolvedPlace) =>
    roadKm(from, to, circuityFactor, overrides);

  for (let i = 0; i < stops.length - 1; i += 1) {
    legs.push({
      fromSlug: stops[i]!.key,
      toSlug: stops[i + 1]!.key,
      km: km(stops[i]!, stops[i + 1]!),
    });
  }

  let itineraryKm = legs.reduce((sum, leg) => sum + leg.km, 0);

  // A round trip that does not name its own end comes back the way it went.
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  if (tripType === "round" && first.key !== last.key) itineraryKm *= 2;

  // The transfer legs run from the yard to the first stop and back from the
  // last — or from the first, on a round trip that returns there.
  let transferKm = 0;
  if (garage) {
    const yard: ResolvedPlace = {
      key: "garage",
      name: "Garage",
      lat: garage.lat,
      lng: garage.lng,
      citySlug: "",
      isAirport: false,
      served: false,
    };
    const home = tripType === "round" && first.key !== last.key ? first : last;
    const out = km(yard, first);
    const back = km(home, yard);
    transferKm = out + back;
    legs.unshift({ fromSlug: yard.key, toSlug: first.key, km: out, transfer: true });
    legs.push({ fromSlug: home.key, toSlug: yard.key, km: back, transfer: true });
  }

  const total = Math.max(1, itineraryKm + transferKm);
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
  circuityFactor = DEFAULT_CIRCUITY_FACTOR,
): number {
  return route.kmOverride ?? roadKm(from, to, circuityFactor);
}
