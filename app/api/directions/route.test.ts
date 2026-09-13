import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_ROUTE_POINTS, MAX_TRIP_STOPS } from "@/lib/trip-limits";

const { routeThrough } = vi.hoisted(() => ({ routeThrough: vi.fn() }));
vi.mock("@/lib/route", () => ({ routeThrough }));
import { GET } from "./route";

beforeEach(() => { vi.clearAllMocks(); routeThrough.mockResolvedValue(null); });

describe("directions itinerary limits", () => {
  it("accepts all stops the calculator can express", async () => {
    const stops = Array.from({ length: MAX_TRIP_STOPS }, (_, i) => `${10 + i / 100},76`).join(";");
    const response = await GET(new Request(`https://xotic.example/api/directions?stops=${stops}`));
    expect(response.status).toBe(200);
    expect(routeThrough.mock.calls[0][0]).toHaveLength(MAX_TRIP_STOPS);
  });
  it("rejects over-limit itineraries before spending provider quota", async () => {
    const stops = Array(MAX_TRIP_STOPS + 1).fill("10,76").join(";");
    const response = await GET(new Request(`https://xotic.example/api/directions?stops=${stops}`));
    expect(response.status).toBe(400);
    expect(routeThrough).not.toHaveBeenCalled();
  });
  it("allows both garage transfers around the maximum passenger itinerary", async () => {
    const stops = Array(MAX_ROUTE_POINTS).fill("10,76").join(";");
    const response = await GET(new Request(`https://xotic.example/api/directions?scope=vehicle&stops=${stops}`));
    expect(response.status).toBe(200);
    expect(routeThrough).toHaveBeenCalledOnce();
    expect(routeThrough.mock.calls[0][0]).toHaveLength(MAX_ROUTE_POINTS);
  });
  it("bounds vehicle routes before contacting the router", async () => {
    const stops = Array(MAX_ROUTE_POINTS + 1).fill("10,76").join(";");
    const response = await GET(new Request(`https://xotic.example/api/directions?scope=vehicle&stops=${stops}`));
    expect(response.status).toBe(400);
    expect(routeThrough).not.toHaveBeenCalled();
  });
  it("marks all vehicle legs so quote consumers cannot mistake transfers for passenger legs", async () => {
    const trip = { legs: [{ km: 10, minutes: 20 }, { km: 30, minutes: 40 }, { km: 50, minutes: 60 }], km: 90, minutes: 120, path: [] };
    routeThrough.mockResolvedValue(trip);
    const request = new Request("https://xotic.example/api/directions?scope=vehicle&stops=10,76;11,76;12,76;10,76");
    const response = await GET(request);
    expect(await response.json()).toEqual({ routed: true, scope: "vehicle", ...trip });
    expect(routeThrough).toHaveBeenCalledWith([[10, 76], [11, 76], [12, 76], [10, 76]], { signal: request.signal });
  });
  it.each(["scope=unknown&stops=10,76;11,76", "stops=10,76;Infinity,76", "stops=91,76;11,76", "stops=10,76;;11,76", "stops=,76;11,76"])("rejects malformed route %s without quota use", async (query) => {
    const response = await GET(new Request(`https://xotic.example/api/directions?${query}`));
    expect(response.status).toBe(400);
    expect(routeThrough).not.toHaveBeenCalled();
  });
  it("keeps provider outages uncached", async () => {
    const response = await GET(new Request("https://xotic.example/api/directions?scope=vehicle&stops=10,76;11,76"));
    expect(await response.json()).toEqual({ routed: false });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
