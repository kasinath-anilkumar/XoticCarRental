/**
 * OSRM — the default router.
 *
 * Open Source Routing Machine, driving profile, over OpenStreetMap data. It
 * needs no key, and one request answers the whole trip: pickup → drop → return
 * comes back as a single route with a distance and a duration **per leg**,
 * which is exactly the shape a multi-stop quote bills in.
 *
 * `ROUTER_URL` points at your own instance. The public demo server at
 * router.project-osrm.org is fine for development and light traffic and asks
 * not to be leaned on; anyone running real volume should self-host it or point
 * `ROUTER_PROVIDER` at a service with an SLA.
 *
 * http://project-osrm.org/docs/v5.24.0/api/
 */

import { fetchJson } from "../net/http";

import type { LatLng, RouteProvider, RoutedTrip } from "./types";

const DEFAULT_ENDPOINT = "https://router.project-osrm.org";

/**
 * How many points of road to keep.
 *
 * OSRM's own `overview=simplified` throws away far too much for a map you can
 * zoom: a 130 km route came back as 48 points, which cuts the corner off every
 * bend and draws a straight line through the hills above Adimali. The full
 * geometry is asked for instead and thinned here, keeping every point that is
 * more than a few metres off the line its neighbours would have drawn.
 *
 * 1200 points is around 30 KB of JSON — nothing, and more detail than a map
 * this size can show.
 */
const MAX_POINTS = 1200;

/**
 * Douglas–Peucker, iterative.
 *
 * Drops the points that say nothing: a straight motorway keeps its two ends, a
 * hairpin keeps every vertex. The tolerance is in degrees — 1e-5 is roughly a
 * metre — and is raised until the line fits the budget, so a 500 km route is
 * thinned harder than a city hop, which is exactly the right way round.
 */
function thin(points: LatLng[], tolerance: number): LatLng[] {
  if (points.length < 3) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const [ax, ay] = points[start];
    const [bx, by] = points[end];
    const dx = bx - ax;
    const dy = by - ay;
    const span = dx * dx + dy * dy;

    let worst = 0;
    let worstAt = -1;
    for (let i = start + 1; i < end; i += 1) {
      const [px, py] = points[i];
      // Perpendicular distance to the segment, squared — no square roots in
      // the inner loop, and only the ordering matters.
      const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / span));
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const distance = ex * ex + ey * ey;
      if (distance > worst) {
        worst = distance;
        worstAt = i;
      }
    }

    if (worstAt !== -1 && worst > tolerance * tolerance) {
      keep[worstAt] = 1;
      stack.push([start, worstAt], [worstAt, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

function withinBudget(points: LatLng[]): LatLng[] {
  let tolerance = 0.00001; // ~1 m
  let thinned = thin(points, tolerance);
  while (thinned.length > MAX_POINTS && tolerance < 0.01) {
    tolerance *= 2;
    thinned = thin(points, tolerance);
  }
  return thinned;
}

interface OsrmResponse {
  code: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: Array<[number, number]> };
    legs: Array<{ distance: number; duration: number }>;
  }>;
}

export function createOsrmProvider(): RouteProvider {
  const endpoint = (process.env.ROUTER_URL ?? DEFAULT_ENDPOINT).replace(/\/$/, "");

  return {
    name: "osrm",
    // The public instance asks only for fair use; a route is requested far less
    // often than a suggestion, and the cache absorbs the repeats.
    minIntervalMs: 200,

    async route(stops: LatLng[], options = {}) {
      // OSRM takes lon,lat — the opposite order to everything else here, and
      // the classic way to get a route through the Bay of Bengal.
      const path = stops.map(([lat, lng]) => `${lng},${lat}`).join(";");
      const params = new URLSearchParams({
        // Full geometry, thinned below. OSRM's own simplification is tuned for
        // an overview thumbnail, not for a map somebody can zoom into.
        overview: "full",
        geometries: "geojson",
        alternatives: "false",
        steps: "false",
      });

      const data = await fetchJson<OsrmResponse>(
        `${endpoint}/route/v1/driving/${path}?${params}`,
        { signal: options.signal, timeoutMs: 6000 },
      );

      const route = data.routes?.[0];
      // "NoRoute" is an honest answer — an island with no ferry, a point in the
      // sea — and is treated like any other failure by the caller above.
      if (data.code !== "Ok" || !route) {
        throw new Error(data.message ?? data.code ?? "no route");
      }

      return {
        legs: route.legs.map((leg) => ({
          km: Math.round(leg.distance / 100) / 10,
          minutes: Math.round(leg.duration / 60),
        })),
        km: Math.round(route.distance / 100) / 10,
        minutes: Math.round(route.duration / 60),
        path: withinBudget(route.geometry.coordinates.map(([lng, lat]): LatLng => [lat, lng])),
      } satisfies RoutedTrip;
    },
  };
}
