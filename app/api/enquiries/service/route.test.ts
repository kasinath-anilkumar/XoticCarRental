import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCatalog, createLead, isSupabaseConfigured, canRecordEnquiries } = vi.hoisted(() => ({
  getCatalog: vi.fn(), createLead: vi.fn(), isSupabaseConfigured: vi.fn(), canRecordEnquiries: vi.fn(),
}));
vi.mock("@/lib/content", () => ({ getCatalog }));
vi.mock("@/lib/store", () => ({ getStore: () => ({ createLead }) }));
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured }));
vi.mock("@/lib/supabase/admin", () => ({ canRecordEnquiries }));

import { POST } from "./route";

const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
const valid = { service: "wedding", customerName: "Test Person", customerPhone: "+91 9876543210", answers: { city: "Kochi", date, venue: "Test venue" } };
let requestId = 0;
function request(body: unknown) {
  return new Request("https://xotic.example/api/enquiries/service", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `service-test-${requestId++}` }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  isSupabaseConfigured.mockReturnValue(false);
  canRecordEnquiries.mockReturnValue(false);
  getCatalog.mockResolvedValue({ live: true, settings: { whatsappNumber: "919876543210" } });
  createLead.mockResolvedValue({ leadId: "WED-260919-001" });
});

describe("service enquiry API", () => {
  it.each(["catalogue", "storage-only"])("does not send a fallback contact or store an enquiry with failed %s configuration", async (configured) => {
    isSupabaseConfigured.mockReturnValue(configured === "catalogue");
    canRecordEnquiries.mockReturnValue(configured === "storage-only");
    getCatalog.mockResolvedValue({ live: false, settings: { whatsappNumber: "0000000000" } });
    const response = await POST(request(valid));
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("whatsappHref");
    expect(createLead).not.toHaveBeenCalled();
  });
  it("records accepted answers and returns the actual stored reference", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.recorded).toBe(true);
    expect(body.leadId).toBe("WED-260919-001");
    expect(decodeURIComponent(body.whatsappHref)).toContain("Phone: +91 9876543210");
    expect(createLead).toHaveBeenCalledWith(expect.objectContaining({ pickupDate: date, customerPhone: valid.customerPhone }));
    expect(createLead.mock.calls[0][0]).not.toHaveProperty("leadId");
  });

  it.each([
    { ...valid, customerPhone: "abc" },
    { ...valid, answers: { ...valid.answers, date: "2026-02-30" } },
    { ...valid, answers: { ...valid.answers, segment: "invented option" } },
    { ...valid, answers: { ...valid.answers, convoyCars: "-3" } },
    { ...valid, answers: { ...valid.answers, returnDate: "2020-01-01" } },
    { ...valid, customerName: "x".repeat(121) },
  ])("rejects invalid answers before any catalogue or database work", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(getCatalog).not.toHaveBeenCalled();
    expect(createLead).not.toHaveBeenCalled();
  });

  it("keeps a usable WhatsApp fallback without claiming the enquiry was saved", async () => {
    createLead.mockRejectedValue(new Error("database unavailable"));
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ recorded: false, leadId: expect.stringMatching(/^ASK-/), whatsappHref: expect.stringContaining("wa.me") });
    logger.mockRestore();
  });
});
