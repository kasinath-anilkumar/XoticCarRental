import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), configured: vi.fn(), from: vi.fn(), select: vi.fn(), order: vi.fn(), ilike: vi.fn(), eq: vi.fn(), range: vi.fn(), abortSignal: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ currentAdmin: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured: mocks.configured, createSupabaseServerClient: async () => ({ from: mocks.from }) }));
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({ userId: "staff" });
  mocks.configured.mockReturnValue(true);
  for (const key of ["from", "select", "order", "ilike", "eq", "range"] as const) mocks[key].mockReturnValue(mocks);
  mocks.abortSignal.mockResolvedValue({ data: [], error: null });
});
const request = (query = "kind=cities") => new Request(`http://localhost/api/admin/options?${query}`);

describe("admin reference endpoint", () => {
  it("denies signed-out and non-admin users without reading tables", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not substitute sample data when the database is unavailable", async () => {
    mocks.configured.mockReturnValue(false);
    expect((await GET(request())).status).toBe(503);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("fetches one bounded search page, with a sentinel instead of a count query", async () => {
    mocks.abortSignal.mockResolvedValue({ data: Array.from({ length: 21 }, (_, index) => ({ id: String(index), name: `City ${index}`, state: "Configured region" })), error: null });
    const response = await GET(request("kind=cities&page=3&q=50%25"));
    const data = await response.json();
    expect(mocks.select).toHaveBeenCalledWith("id,name,state");
    expect(mocks.range).toHaveBeenCalledWith(40, 60);
    expect(mocks.ilike).toHaveBeenCalledWith("name", "%50\\%%");
    expect(data.options).toHaveLength(20);
    expect(data.hasMore).toBe(true);
    expect(data.page).toBe(3);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("scopes pickup choices to the selected saved city", async () => {
    const city = "f7338c3c-0c3d-4a5e-9086-76e2d7e4c524";
    await GET(request(`kind=locations&city=${city}`));
    expect(mocks.eq).toHaveBeenCalledWith("city_id", city);
  });
  it("uses vehicle slugs in availability form submissions", async () => {
    mocks.abortSignal.mockResolvedValue({ data: [{ id: "car-id", name: "Saved vehicle", slug: "saved-vehicle" }], error: null });
    expect(await (await GET(request("kind=cars"))).json()).toEqual({ options: [{ value: "saved-vehicle", label: "Saved vehicle" }], page: 1, hasMore: false });
  });
  it("rejects unapproved tables before constructing a query", async () => {
    expect((await GET(request("kind=staff"))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("reports database failures instead of showing an empty successful list", async () => {
    mocks.abortSignal.mockResolvedValue({ data: null, error: { message: "private database detail" } });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database detail");
  });
});
