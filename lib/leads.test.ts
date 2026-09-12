import { describe, expect, it } from "vitest";
import { leadPrefix, nextLeadId } from "./leads";

describe("service-derived enquiry prefixes", () => {
  it.each([
    ["executive-shuttle", "EXECUTIV"],
    ["medical-transfers", "MEDICALT"],
    ["Café-transfer", "CAFETRAN"],
    ["x", "XX"],
    ["123-456", "ENQ"],
    ["", "ENQ"],
  ])("maps %s into the database's bounded prefix format", (slug, expected) => {
    expect(leadPrefix(slug)).toBe(expected);
    expect(leadPrefix(slug)).toMatch(/^[A-Z]{2,8}$/);
  });

  it("shares the sequence when independently named services derive the same prefix", () => {
    const now = new Date("2026-08-21T06:00:00Z");
    const first = nextLeadId("executive-shuttle", now, []);
    expect(nextLeadId("executive-transfer", now, [first])).toBe("EXECUTIV-260821-002");
  });

  it("continues a legacy prefix's counter without changing any issued reference", () => {
    const taken = ["WED-260821-999", "WED-260821-1000"];
    expect(nextLeadId("wed", new Date("2026-08-21T06:00:00Z"), taken)).toBe("WED-260821-1001");
    expect(taken).toEqual(["WED-260821-999", "WED-260821-1000"]);
  });
});
