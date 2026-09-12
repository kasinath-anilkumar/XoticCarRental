import { describe, expect, it } from "vitest";
import { referenceRequest, searchPattern } from "./references";

describe("admin reference input", () => {
  it("keeps wildcard text literal instead of expanding a database scan", () => {
    expect(searchPattern("  50%_\\  ")).toBe("%50\\%\\_\\\\%");
  });
  it.each(["staff", "enquiries", "cities;drop table cars", ""])("rejects unsupported table %s", (kind) => {
    expect(() => referenceRequest(new URLSearchParams({ kind }))).toThrow("supported");
  });
  it.each(["0", "-1", "1.5", "10001", "NaN"])("rejects unsafe page %s", (page) => {
    expect(() => referenceRequest(new URLSearchParams({ kind: "cities", page }))).toThrow("Invalid page");
  });
  it("validates city IDs and query length before querying", () => {
    expect(() => referenceRequest(new URLSearchParams({ kind: "locations", city: "x),name.eq.anything" }))).toThrow("Invalid city");
    expect(() => referenceRequest(new URLSearchParams({ kind: "cities", q: "x".repeat(101) }))).toThrow("100 characters");
    expect(referenceRequest(new URLSearchParams({ kind: "cities", q: "  saved city  " }))).toEqual({ kind: "cities", query: "saved city", page: 1, cityId: "" });
  });
});
