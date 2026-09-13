import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, businessDate } from "@/lib/dates";

const { getCatalog, createLead, listAvailability, resolveRoutedQuote, isSupabaseConfigured, canRecordEnquiries } = vi.hoisted(() => ({
  getCatalog: vi.fn(), createLead: vi.fn(), listAvailability: vi.fn(), resolveRoutedQuote: vi.fn(), isSupabaseConfigured: vi.fn(), canRecordEnquiries: vi.fn(),
}));
vi.mock("@/lib/content", () => ({ getCatalog }));
vi.mock("@/lib/store", () => ({ getStore: () => ({ createLead, listAvailability }) }));
vi.mock("@/lib/quote-server", () => ({ resolveRoutedQuote }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured }));
vi.mock("@/lib/supabase/admin", () => ({ canRecordEnquiries }));
import { POST } from "./route";

const date = addDays(businessDate(), 7);
const valid = { tripType: "local", date, time: "10:00", carSlug: "sedan", packageSlug: "8h", occasionSlug: "wedding", stops: ["@10,76,Pickup", "@10.1,76.1,Drop"], haltHours: 0 };
let requestId = 0;
function request(body: unknown) {
  return new Request("https://xotic.example/api/enquiries", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `quote-test-${requestId++}` }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  isSupabaseConfigured.mockReturnValue(false);
  canRecordEnquiries.mockReturnValue(false);
  const car = { slug: "sedan", name: "Sedan", year: 2026, type: "Luxury sedan" };
  const pkg = { slug: "8h", label: "8 hours" };
  const occasion = { slug: "wedding", name: "Wedding" };
  const stops = [{ name: "Pickup" }, { name: "Drop" }];
  getCatalog.mockResolvedValue({ live: true, cars: [car], packages: [pkg], occasions: [occasion], locations: [], settings: { whatsappNumber: "919876543210", gstPercent: 5 } });
  resolveRoutedQuote.mockResolvedValue({ car, pkg, occasion, from: stops[0], to: stops[1], stops, customer: null, transferKm: 10,
    quote: { km: 90, hours: 8, days: 1, subtotal: 10_000, gst: 500, total: 10_500, advance: 2_100, lines: [] },
  });
  listAvailability.mockResolvedValue([]);
  createLead.mockResolvedValue({ leadId: "WED-260919-001" });
});

describe("quote enquiry API", () => {
  it("uses inclusive selected dates for availability and persists the return date", async () => {
    const returnDate = addDays(date, 2);
    const resolved = await resolveRoutedQuote();
    resolveRoutedQuote.mockResolvedValue({ ...resolved, quote: { ...resolved.quote, days: 3 } });
    expect((await POST(request({ ...valid, returnDate }))).status).toBe(200);
    expect(resolveRoutedQuote).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ returnDate }));
    expect(listAvailability).toHaveBeenCalledWith("sedan", { from: date, to: returnDate });
    expect(createLead).toHaveBeenCalledWith(expect.objectContaining({ days: 3, details: [{ label: "Return date", value: returnDate }] }));
  });
  it.each(["catalogue", "storage-only"])("never prices or records seed data with a failed %s configuration", async (configured) => {
    isSupabaseConfigured.mockReturnValue(configured === "catalogue");
    canRecordEnquiries.mockReturnValue(configured === "storage-only");
    getCatalog.mockResolvedValue({ live: false });
    const response = await POST(request(valid));
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("whatsappHref");
    expect(resolveRoutedQuote).not.toHaveBeenCalled();
    expect(listAvailability).not.toHaveBeenCalled();
    expect(createLead).not.toHaveBeenCalled();
  });
  it("stores server-recomputed totals and the store-assigned reference", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    const response = await POST(request({ ...valid, total: 1, advance: 0 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ recorded: true, total: 10_500, advance: 2_100, leadId: "WED-260919-001" });
    expect(createLead).toHaveBeenCalledWith(expect.objectContaining({ total: 10_500, advance: 2_100 }));
    expect(listAvailability).toHaveBeenCalledWith("sedan", { from: date, to: date });
  });
  it("saves and messages the return to pickup inferred for a two-stop round trip", async () => {
    const resolved = await resolveRoutedQuote();
    const stops = [{ name: "Pickup" }, { name: "Destination" }, { name: "Pickup" }];
    resolveRoutedQuote.mockResolvedValue({ ...resolved, stops, from: stops[0], to: stops[2] });
    const response = await POST(request({ ...valid, tripType: "round" }));
    expect(response.status).toBe(200);
    expect(createLead).toHaveBeenCalledWith(expect.objectContaining({
      tripType: "round", stops: [
        { name: "Pickup", role: "pickup" }, { name: "Destination", role: "stop" }, { name: "Pickup", role: "drop" },
      ],
    }));
    const body = await response.json();
    const message = new URL(body.whatsappHref).searchParams.get("text");
    expect(message).toContain("Stop 1: Destination");
    expect(message).toContain("Final drop: Pickup");
    expect(message).not.toContain("Final drop: Destination");
    expect(resolveRoutedQuote).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ stops: valid.stops }));
  });
  it("rejects a stale quote for a vehicle that is now held", async () => {
    listAvailability.mockResolvedValue([{ carSlug: "sedan", startsOn: date, endsOn: date }]);
    const response = await POST(request(valid));
    expect(response.status).toBe(409);
    expect(createLead).not.toHaveBeenCalled();
  });
  it.each([
    { ...valid, time: "25:61" },
    { ...valid, returnDate: addDays(date, -1) },
    { ...valid, returnDate: addDays(date, 30) },
    { ...valid, returnDate: "2026-02-30" },
    { ...valid, stops: ["@10,76,Pickup", "", "@10.1,76.1,Drop"] },
    { ...valid, stops: Array(13).fill("@10,76,Pickup") },
    { ...valid, carSlug: "unknown" },
    { ...valid, packageSlug: "unknown" },
    { ...valid, occasionSlug: "unknown" },
    { ...valid, stops: ["@10,76,Pickup", "unknown-place"] },
  ])("rejects invalid inputs without routing or writing", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(resolveRoutedQuote).not.toHaveBeenCalled();
    expect(createLead).not.toHaveBeenCalled();
  });
});
