import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TRIP_STOPS } from "@/lib/trip-limits";

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
});
