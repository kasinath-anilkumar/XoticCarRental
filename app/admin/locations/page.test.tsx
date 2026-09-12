import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), from: vi.fn(), select: vi.fn(), order: vi.fn(), ilike: vi.fn(), range: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured: () => true, createSupabaseServerClient: async () => ({ from: mocks.from }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../AdminShell", () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => createElement("main", null, children), AdminPageHead: () => null }));
vi.mock("@/components/admin/ListFilters", () => ({ ListFilters: () => null }));
vi.mock("./NewLocationForm", () => ({ NewLocationForm: () => null }));
vi.mock("./LocationRow", () => ({ LocationRow: ({ name }: { name: string }) => createElement("div", { "data-record": true }, name) }));
import AdminLocationsPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ email: "staff@example.test" });
  for (const key of ["from", "select", "order", "ilike"] as const) mocks[key].mockReturnValue(mocks);
  mocks.redirect.mockImplementation((url) => { throw new Error(`redirect:${url}`); });
  mocks.range.mockResolvedValue({ data: [{ id: "saved-id", name: "Configured pickup", city_id: "saved-city", cities: { name: "Configured city" } }], error: null, count: 51 });
});

describe("admin pickup pagination", () => {
  it("bounds the database read and displays the database total", async () => {
    const html = renderToStaticMarkup(await AdminLocationsPage({ searchParams: Promise.resolve({ page: "3", q: "pick" }) }));
    expect(mocks.range).toHaveBeenCalledWith(50, 74);
    expect(mocks.select).toHaveBeenCalledWith("*,cities(name)", { count: "exact" });
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(html).toContain("51 matching locations");
    expect(html).toContain("Showing 51");
    expect(html).toContain("q=pick&amp;page=2");
    expect((html.match(/data-record/g) ?? [])).toHaveLength(1);
  });
  it("redirects stale page offsets while preserving search filters", async () => {
    await expect(AdminLocationsPage({ searchParams: Promise.resolve({ page: "9", q: "pick" }) })).rejects.toThrow("redirect:/admin/locations?q=pick&page=3");
  });
  it("surfaces failed reads instead of reporting an empty database", async () => {
    mocks.range.mockResolvedValue({ data: null, error: { message: "Read failed" }, count: null });
    await expect(AdminLocationsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("Could not load admin records");
  });
});
