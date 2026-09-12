import { describe, expect, it } from "vitest";
import seed from "@/backend/service-seed-data.json";
import { parseService, resolveServiceChoices } from "./service-validation";
import { serviceFromPrice } from "./services";

describe("admin-managed service content", () => {
  it("preserves decimal prices and does not turn descriptive prices into a misleading amount", () => {
    const service = parseService(seed[0]);
    const priced = (price: string) => ({ ...service, packages: [{ name: "Custom", detail: "Custom offer", price, unit: "per trip" }] });
    expect(serviceFromPrice(priced("INR 1,250.50"))).toBe(1250.5);
    expect(serviceFromPrice(priced("On request"))).toBeNull();
    expect(serviceFromPrice(priced("2 cars from 5000"))).toBeNull();
    expect(serviceFromPrice(priced("-100"))).toBeNull();
  });
  it("validates every migrated offering without relying on runtime embedded services", () => {
    expect(seed.map(parseService)).toHaveLength(seed.length);
    expect(seed.map(parseService).flatMap((service) => service.fields).filter((field) => field.name === "city").every((field) => field.type === "place")).toBe(true);
  });
  it("resolves car segments from current published types", () => {
    const service = parseService(seed[0]);
    expect(resolveServiceChoices(service, ["New category", "New category"]).fields.find((field) => field.name === "segment")?.options).toEqual(["New category"]);
    expect(resolveServiceChoices(service, []).fields.find((field) => field.name === "segment")?.options).toEqual([]);
    expect(service.fields.find((field) => field.name === "segment")?.options).toBeUndefined();
  });
  it.each([
    { slug: "../admin" }, { slug: "new" }, { group: "unrecognized" }, { fields: [{ name: "city", label: "City", type: "script" }] },
    { fields: [{ name: "constructor", label: "Bad key", type: "text" }] },
    { fields: [{ name: "mode", label: "Mode", type: "select", options: [] }] },
    { fields: [{ name: "count", label: "Count", type: "number", min: 10, max: 2 }] },
    { fields: [{ name: "city", label: "City", type: "place" }, { name: "city", label: "Again", type: "place" }] },
  ])("rejects invalid or unsafe editor content %#", (patch) => {
    expect(() => parseService({ ...seed[0], ...patch })).toThrow();
  });
});
