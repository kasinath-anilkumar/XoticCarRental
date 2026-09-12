import { afterEach, describe, expect, it, vi } from "vitest";

import { createOsrmProvider } from "./osrm";

/**
 * The provider's whole job is translation, and translation is where routers get
 * got wrong: OSRM speaks lon,lat where the rest of this codebase speaks lat,lng,
 * and it answers in metres and seconds where a quote is in kilometres and
 * minutes. Both are pinned here rather than discovered on a map of the Bay of
 * Bengal.
 */

const RESPONSE = {
  code: "Ok",
  routes: [
    {
      distance: 34_812,
      duration: 2_880,
      geometry: { coordinates: [[76.268, 9.983], [76.392, 10.152]] },
      legs: [{ distance: 34_812, duration: 2_880 }],
    },
  ],
};

function stubFetch(body: unknown, ok = true) {
  // Typed parameters, so the assertions below can read the URL it was called
  // with rather than `never`.
  const fetchMock = vi.fn(
    async (_url: string | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status: ok ? 200 : 502,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ROUTER_URL;
});

describe("the OSRM provider", () => {
  it("sends the stops as lon,lat in visiting order", async () => {
    const fetchMock = stubFetch(RESPONSE);

    await createOsrmProvider().route([
      [9.9816, 76.2673],
      [10.152, 76.3919],
    ]);

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("/route/v1/driving/76.2673,9.9816;76.3919,10.152");
    expect(url).toContain("geometries=geojson");
  });

  it("converts metres and seconds into the units a quote is written in", async () => {
    stubFetch(RESPONSE);

    const trip = await createOsrmProvider().route([
      [9.9816, 76.2673],
      [10.152, 76.3919],
    ]);

    expect(trip.km).toBe(34.8);
    expect(trip.minutes).toBe(48);
    expect(trip.legs).toEqual([{ km: 34.8, minutes: 48 }]);
  });

  it("hands back the path as lat,lng, the way Leaflet draws it", async () => {
    stubFetch(RESPONSE);

    const trip = await createOsrmProvider().route([
      [9.9816, 76.2673],
      [10.152, 76.3919],
    ]);

    expect(trip.path).toEqual([
      [9.983, 76.268],
      [10.152, 76.392],
    ]);
  });

  it("honours a self-hosted instance", async () => {
    process.env.ROUTER_URL = "https://osrm.internal/";
    const fetchMock = stubFetch(RESPONSE);

    await createOsrmProvider().route([
      [9.9816, 76.2673],
      [10.152, 76.3919],
    ]);

    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url.startsWith("https://osrm.internal/route/v1/")).toBe(true);
  });

  it("throws when there is no road between the stops", async () => {
    stubFetch({ code: "NoRoute", message: "Impossible route" });

    await expect(
      createOsrmProvider().route([
        [9.9816, 76.2673],
        [10.152, 76.3919],
      ]),
    ).rejects.toThrow("Impossible route");
  });
});
