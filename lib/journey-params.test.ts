import { describe, expect, it } from "vitest";
import { calculatorJourneyHref, copyJourneyParams } from "./journey-params";

describe("booking choices across public pages", () => {
  it("preserves real pickup coordinates, package and date range without copying catalog filters", () => {
    const pickup = "@19.076,72.8777,Customer-selected landmark";
    const query = new URLSearchParams({ from: pickup, date: "2026-10-18", returnDate: "2026-10-20", pkg: "custom-package", page: "3", budget: "10000", type: "SUV" });
    const carried = copyJourneyParams(query);
    expect(carried.get("from")).toBe(pickup);
    expect(carried.get("returnDate")).toBe("2026-10-20");
    expect([...carried.keys()]).toEqual(["from", "date", "returnDate", "pkg"]);
    const destination = new URL(calculatorJourneyHref("car=chosen-car&stops=~&pkg=old", carried.toString(), "custom-package"), "https://example.test");
    expect(destination.searchParams.get("from")).toBe(pickup);
    expect(destination.searchParams.has("stops")).toBe(false);
    expect(destination.searchParams.get("car")).toBe("chosen-car");
    expect(destination.searchParams.get("pkg")).toBe("custom-package");
  });

  it("preserves explicitly cleared stops and the selected vehicle when a source query names another car", () => {
    const href = calculatorJourneyHref("car=selected-car&stops=old~route", "car=other-car&stops=~&time=09%3A00", "pkg");
    const params = new URL(href, "https://example.test").searchParams;
    expect(params.get("stops")).toBe("~");
    expect(params.get("car")).toBe("selected-car");
  });
});
