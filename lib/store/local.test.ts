import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalStore } from "./local";
import { leadDateStamp } from "../leads";
import type { Lead, Store } from "./types";

let directory: string;
let file: string;
let store: Store;
const lead: Omit<Lead, "id" | "createdAt" | "leadId"> = {
  customerName: "Test", customerPhone: "+919876543210", customerPlace: "Kochi",
  serviceSlug: "wedding", serviceName: "Wedding", carSlug: null, carName: null, packageLabel: null,
  tripType: "", stops: [], pickupDate: "2026-10-12", pickupTime: "", haltHours: 0,
  km: 0, transferKm: 0, hours: 0, days: 0, lines: [], subtotal: 0, gst: 0, total: 0, advance: 0,
  status: "new", assignedTo: null, followUpOn: "2026-10-01", notes: null, source: "test", details: [],
};

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "xotic-store-test-"));
  file = join(directory, "store.json");
  store = createLocalStore(file);
});
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

describe("local storage integrity and pagination", () => {
  it("serializes colliding prefixes across arbitrary new services", async () => {
    const rows = await Promise.all(["executive-shuttle", "executive-transfer", "executive-travel"].map((serviceSlug) => store.createLead({ ...lead, serviceSlug })));
    expect(rows.map((row) => row.leadId.split("-")[0])).toEqual(["EXECUTIV", "EXECUTIV", "EXECUTIV"]);
    expect(rows.map((row) => row.leadId.split("-")[2])).toEqual(["001", "002", "003"]);
    expect(new Set(rows.map((row) => row.serviceSlug)).size).toBe(3);
  });

  it("keeps legacy references readable after generating new-format enquiries", async () => {
    const stamp = leadDateStamp(new Date());
    const legacy: Lead = { ...lead, id: "legacy-row", createdAt: new Date().toISOString(), leadId: `WED-${stamp}-1000` };
    await writeFile(file, JSON.stringify({ leads: [legacy], availability: [] }), "utf8");
    const collision = await store.createLead({ ...lead, serviceSlug: "wed" });
    const current = await store.createLead(lead);
    expect(collision.leadId).toBe(`WED-${stamp}-1001`);
    expect(current.leadId).toBe(`WEDDING-${stamp}-001`);
    const rows = await store.listLeadsPage({}, 1, 10);
    expect(rows.items.find((row) => row.leadId === legacy.leadId)).toEqual(legacy);
    expect(await store.leadIdsFor(stamp)).toContain(legacy.leadId);
  });
  it("records simultaneous submissions with distinct sequential references", async () => {
    const rows = await Promise.all(Array.from({ length: 30 }, () => store.createLead(lead)));
    expect(new Set(rows.map((row) => row.leadId)).size).toBe(30);
    expect(rows[0].leadId).toMatch(/-001$/);
    expect(rows.at(-1)?.leadId).toMatch(/-030$/);
    expect(await store.getLeadCounts("2026-10-01")).toEqual({ all: 30, open: 30, overdue: 30 });
    const first = await store.listLeadsPage({}, 1, 10);
    const second = await store.listLeadsPage({}, 2, 10);
    expect(first.total).toBe(30);
    expect(first.items).toHaveLength(10);
    expect(new Set([...first.items, ...second.items].map((row) => row.id)).size).toBe(20);
  });
  it("filters before paginating and excludes closed leads from overdue work", async () => {
    await Promise.all([store.createLead(lead), store.createLead({ ...lead, status: "confirmed" }), store.createLead({ ...lead, followUpOn: "2026-12-01" })]);
    const result = await store.listLeadsPage({ status: "open", overdueOn: "2026-10-01" }, 1, 1);
    expect(result.total).toBe(1);
    expect(result.items[0].status).toBe("new");
    expect(await store.getLeadCounts("2026-10-01")).toEqual({ all: 3, open: 2, overdue: 1 });
  });
  it("preserves corrupt data and recovers its writer queue after an error", async () => {
    await writeFile(file, "broken-json", "utf8");
    await expect(store.createLead(lead)).rejects.toThrow();
    expect(await readFile(file, "utf8")).toBe("broken-json");
    await writeFile(file, JSON.stringify({ leads: [], availability: [] }), "utf8");
    expect((await store.createLead(lead)).leadId).toMatch(/-001$/);
  });
  it("returns overlapping holds without loading historic entries into the page", async () => {
    const entry = { carSlug: "sedan", status: "hold" as const, startsOn: "2026-10-02", endsOn: "2026-10-04", note: null, leadId: null };
    await store.addAvailability(entry);
    await store.addAvailability({ ...entry, startsOn: "2026-09-01", endsOn: "2026-09-02" });
    await store.addAvailability({ ...entry, carSlug: "other" });
    expect(await store.listAvailability("sedan", { from: "2026-10-04", to: "2026-10-10" })).toHaveLength(1);
    expect((await store.listAvailabilityPage({ from: "2026-10-01", carSlug: "sedan" }, 1, 10)).total).toBe(1);
    expect((await store.listAvailabilityPage({ pastBefore: "2026-10-01" }, 1, 10)).total).toBe(1);
  });
});
