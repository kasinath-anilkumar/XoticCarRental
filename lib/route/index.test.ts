import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_ROUTE_POINTS } from "../trip-limits";
import type { LatLng, RoutedTrip } from "./types";

const { route } = vi.hoisted(() => ({ route: vi.fn() }));
vi.mock("./osrm", () => ({ createOsrmProvider: () => ({ name: "test", minIntervalMs: 0, route }) }));

const points: LatLng[] = [[10, 76], [11, 76], [12, 76], [10, 76]];
const valid: RoutedTrip = {
  legs: [{ km: 10, minutes: 20 }, { km: 30, minutes: 40 }, { km: 50, minutes: 60 }],
  km: 90, minutes: 120, path: points,
};

beforeEach(() => {
  vi.resetModules();
  route.mockReset();
  vi.stubEnv("ROUTER_PROVIDER", "osrm");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("bounded vehicle routing", () => {
  it("routes the complete sequence once and caches only the complete answer", async () => {
    route.mockResolvedValue(valid);
    const { routeThrough } = await import("./index");
    const signal = new AbortController().signal;
    expect(await routeThrough(points, { signal })).toEqual(valid);
    expect(await routeThrough(points)).toEqual(valid);
    expect(route).toHaveBeenCalledOnce();
    expect(route).toHaveBeenCalledWith(points, { signal });
  });

  it.each([
    { ...valid, legs: valid.legs.slice(1) },
    { ...valid, legs: [...valid.legs, valid.legs[0]] },
    { ...valid, km: -1 },
    { ...valid, minutes: Infinity },
    { ...valid, legs: [{ km: NaN, minutes: 20 }, ...valid.legs.slice(1)] },
    { ...valid, legs: [{ km: 10, minutes: -1 }, ...valid.legs.slice(1)] },
    { ...valid, path: [[91, 76]] },
  ])("rejects invalid provider data without poisoning the cache", async (invalid) => {
    route.mockResolvedValueOnce(invalid).mockResolvedValueOnce(valid);
    const { routeThrough } = await import("./index");
    expect(await routeThrough(points)).toBeNull();
    expect(await routeThrough(points)).toEqual(valid);
    expect(route).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid coordinates and over-limit inputs without silently skipping stops", async () => {
    const { routeThrough } = await import("./index");
    expect(await routeThrough([[10, 76], [NaN, 76], [11, 76]])).toBeNull();
    expect(await routeThrough([[91, 76], [11, 76]])).toBeNull();
    expect(await routeThrough(Array(MAX_ROUTE_POINTS + 1).fill([10, 76]))).toBeNull();
    expect(route).not.toHaveBeenCalled();
  });
});
