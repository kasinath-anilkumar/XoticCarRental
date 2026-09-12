import { afterEach, describe, expect, it, vi } from "vitest";
import { createPhotonProvider } from "./photon";
import { createNodeGeocoderProvider } from "./node-geocoder";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("provider normalization and transport", () => {
  it("uses Photon country filtering, keeps typed state context and drops foreign/invalid points", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ features: [
      { geometry: { coordinates: [76, 10] }, properties: { name: "Kerala", type: "state", state: "Kerala", country: "India", countrycode: "IN" } },
      { geometry: { coordinates: [76, 91] }, properties: { name: "Invalid", countrycode: "IN" } },
      { geometry: { coordinates: [76, 10] }, properties: { name: "Foreign", countrycode: "GB" } },
    ] }));
    vi.stubGlobal("fetch", fetcher);
    const results = await createPhotonProvider("in").search("Kerala", { limit: 8 });
    const url = new URL(fetcher.mock.calls[0]![0]);
    expect(url.searchParams.get("countrycode")).toBe("IN");
    expect(url.searchParams.has("bbox")).toBe(false);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: "state", state: "Kerala", countryCode: "IN" });
  });

  it("normalizes real node-geocoder Google administrative fields and zero-results", async () => {
    vi.stubEnv("GEOCODER_API_KEY", "test-key");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ status: "OK", results: [{
      formatted_address: "Kerala, India", place_id: "state-id", types: ["administrative_area_level_1", "political"],
      geometry: { location: { lat: 10, lng: 76 }, location_type: "APPROXIMATE" },
      address_components: [
        { long_name: "Kerala", short_name: "KL", types: ["administrative_area_level_1", "political"] },
        { long_name: "India", short_name: "IN", types: ["country", "political"] },
      ],
    }] })).mockResolvedValueOnce(Response.json({ status: "ZERO_RESULTS", results: [] }));
    vi.stubGlobal("fetch", fetcher);
    const provider = createNodeGeocoderProvider("google", "in");
    expect(await provider.search("Kerala", {})).toEqual([expect.objectContaining({ state: "Kerala", kind: "state", countryCode: "IN", id: "google:state-id" })]);
    expect(await provider.search("Unknown", {})).toEqual([]);
  });

  it("upgrades installed LocationIQ HTTP transport and sends bounded country parameters", async () => {
    vi.stubEnv("GEOCODER_API_KEY", "test-key");
    const fetcher = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal("fetch", fetcher);
    await createNodeGeocoderProvider("locationiq", "in").search("Kochi", { limit: 8 });
    const url = new URL(fetcher.mock.calls[0]![0]);
    expect(url.protocol).toBe("https:");
    expect(url.searchParams.get("countrycodes")).toBe("in");
    expect(url.searchParams.get("limit")).toBe("16");
  });

  it("preserves Nominatim reverse raw locality data", async () => {
    vi.stubEnv("NOMINATIM_URL", "https://geocoder.example");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ name: "Gate", lat: "10", lon: "76", class: "place", type: "suburb", address: { city: "Kochi", state: "Kerala", suburb: "Kakkanad", country_code: "in", country: "India" } })));
    expect(await createNodeGeocoderProvider("openstreetmap", "in").reverse({ lat: 10, lng: 76 })).toMatchObject({ name: "Gate", kind: "suburb", city: "Kochi", locality: "Kakkanad", countryCode: "IN" });
  });

  it("cancels node-geocoder HTTP fetch and rejects upstream error statuses", async () => {
    vi.stubEnv("GEOCODER_API_KEY", "test-key");
    const fetcher = vi.fn((_url, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
    }));
    vi.stubGlobal("fetch", fetcher);
    const abort = new AbortController();
    const pending = createNodeGeocoderProvider("locationiq", "in").search("Kochi", { signal: abort.signal });
    const rejected = expect(pending).rejects.toBeDefined();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    abort.abort();
    await rejected;
    expect((fetcher.mock.calls[0]![1].signal as AbortSignal).aborted).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(createNodeGeocoderProvider("locationiq", "in").search("Kochi", {})).rejects.toThrow("503");
  });

  it("does not send autocomplete to public Nominatim", async () => {
    vi.stubEnv("NOMINATIM_URL", "https://nominatim.openstreetmap.org");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(createNodeGeocoderProvider("openstreetmap", "in").search("Kochi", {})).rejects.toThrow("Autocomplete");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
