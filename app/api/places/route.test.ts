import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ search: vi.fn(), reverse: vi.fn(), index: vi.fn(), admin: vi.fn(), allow: vi.fn(() => true) }));
vi.mock("@/lib/geo", () => ({ searchPlaces: mocks.search, reverseLookup: mocks.reverse }));
vi.mock("@/lib/geo/local-index", () => ({ searchIndex: mocks.index, toGeoPlace: (place: unknown) => place }));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/net/rate-limit", () => ({ clientKey: () => "visitor", createRateLimiter: () => mocks.allow }));
import { GET } from "./route";
import { GET as reverse } from "./reverse/route";
import { GET as admin } from "../admin/geocode/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.allow.mockReturnValue(true);
  mocks.search.mockResolvedValue({ places: [], ok: true });
  mocks.index.mockResolvedValue([]);
  mocks.reverse.mockResolvedValue({ place: null, ok: true });
});

describe("place API contracts", () => {
  it.each([GET, admin])("does not replace an authoritative empty answer with indexed towns", async (handler) => {
    const response = await handler(new Request("http://localhost/api/places?q=Unknown"));
    expect(await response.json()).toMatchObject({ results: [], degraded: false });
    expect(mocks.index).not.toHaveBeenCalled();
  });
  it.each([GET, admin])("marks outage fallback as degraded and prevents caching", async (handler) => {
    mocks.search.mockResolvedValue({ places: [], ok: false });
    const response = await handler(new Request("http://localhost/api/places?q=Kochi"));
    expect(mocks.index).toHaveBeenCalledWith("Kochi", 8);
    expect(await response.json()).toMatchObject({ degraded: true });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("requires admin authentication and limits admin provider traffic", async () => {
    mocks.allow.mockReturnValue(false);
    const response = await admin(new Request("http://localhost/api/admin/geocode?q=Kochi"));
    expect(mocks.admin).toHaveBeenCalledOnce();
    expect(response.status).toBe(429);
    expect(mocks.search).not.toHaveBeenCalled();
  });
  it("reverse fallback keeps the caller's exact coordinates and is not cached during an outage", async () => {
    mocks.reverse.mockResolvedValue({ place: null, ok: false });
    const response = await reverse(new Request("http://localhost/api/places/reverse?lat=10.12345&lng=76.12345"));
    expect(await response.json()).toMatchObject({ resolved: false, degraded: true, result: { token: "@10.12345,76.12345,My location" } });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("does not fallback for an abandoned search", async () => {
    const controller = new AbortController(); controller.abort();
    mocks.search.mockResolvedValue({ places: [], ok: false });
    await GET(new Request("http://localhost/api/places?q=Kochi", { signal: controller.signal }));
    expect(mocks.index).not.toHaveBeenCalled();
  });
});
