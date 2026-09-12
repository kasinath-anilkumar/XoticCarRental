import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, businessDate } from "@/lib/dates";

const { getCatalog, listAvailability, isSupabaseConfigured, canRecordEnquiries } = vi.hoisted(() => ({ getCatalog: vi.fn(), listAvailability: vi.fn(), isSupabaseConfigured: vi.fn(), canRecordEnquiries: vi.fn() }));
vi.mock("@/lib/content", () => ({ getCatalog }));
vi.mock("@/lib/store", () => ({ getStore: () => ({ listAvailability }) }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured }));
vi.mock("@/lib/supabase/admin", () => ({ canRecordEnquiries }));
import { GET } from "./route";

const date = addDays(businessDate(), 7);
beforeEach(() => {
  vi.clearAllMocks();
  isSupabaseConfigured.mockReturnValue(false);
  canRecordEnquiries.mockReturnValue(false);
  getCatalog.mockResolvedValue({ live: true, cars: [
    { slug: "selected", name: "Selected", type: "sedan", seats: 4 },
    { slug: "blocked-later", name: "Blocked later", type: "sedan", seats: 4 },
    { slug: "free", name: "Free", type: "sedan", seats: 4 },
  ] });
});

describe("availability API", () => {
  it.each(["catalogue", "storage-only"])("does not check a fallback fleet's availability with failed %s configuration", async (configured) => {
    isSupabaseConfigured.mockReturnValue(configured === "catalogue");
    canRecordEnquiries.mockReturnValue(configured === "storage-only");
    getCatalog.mockResolvedValue({ live: false });
    const response = await GET(new Request(`https://xotic.example/api/availability?car=selected&date=${date}`));
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("available");
    expect(listAvailability).not.toHaveBeenCalled();
  });
  it("checks alternatives for the entire trip and restricts database date windows", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    listAvailability.mockImplementation(async (slug?: string) => slug ? [
      { carSlug: "selected", startsOn: date, endsOn: date },
    ] : [{ carSlug: "blocked-later", startsOn: addDays(date, 1), endsOn: addDays(date, 1) }]);
    const response = await GET(new Request(`https://xotic.example/api/availability?car=selected&date=${date}&days=3`));
    expect(await response.json()).toMatchObject({ available: false, nextFree: addDays(date, 1), alternatives: [{ slug: "free", name: "Free" }] });
    expect(listAvailability).toHaveBeenCalledWith("selected", { from: date, to: addDays(date, 62) });
    expect(listAvailability).toHaveBeenCalledWith(undefined, { from: date, to: addDays(date, 2) });
  });
  it.each(["date=2026-02-30", `date=${date}&days=1.5`, `date=${date}&days=99999`])("rejects invalid intervals %s before database reads", async (query) => {
    const response = await GET(new Request(`https://xotic.example/api/availability?car=selected&${query}`));
    expect(response.status).toBe(400);
    expect(listAvailability).not.toHaveBeenCalled();
  });
  it("fails closed when the calendar cannot be read", async () => {
    listAvailability.mockRejectedValue(new Error("database down"));
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(new Request(`https://xotic.example/api/availability?car=selected&date=${date}`));
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("available", true);
    logger.mockRestore();
  });
});
