import { describe, expect, it } from "vitest";
import { freeThrough } from "./availability";
import { addDays, businessDate, isISODate, isTime } from "./dates";
import type { Availability } from "./store/types";

const hold: Availability = { id: "hold", carSlug: "sedan", status: "booked", startsOn: "2026-10-15", endsOn: "2026-10-17", note: null, leadId: null };

describe("availability intervals", () => {
  it("blocks overlap on the last day of a multi-day trip", () => {
    expect(freeThrough([hold], "sedan", "2026-10-13", 3)).toBe(false);
    expect(freeThrough([hold], "sedan", "2026-10-13", 2)).toBe(true);
    expect(freeThrough([hold], "sedan", "2026-10-17", 1)).toBe(false);
    expect(freeThrough([hold], "sedan", "2026-10-18", 1)).toBe(true);
    expect(freeThrough([hold], "other", "2026-10-15", 1)).toBe(true);
  });
  it.each([["2026-02-30", 1], ["nonsense", 1], ["2026-10-13", Infinity], ["2026-10-13", 1.5], ["2026-10-13", 0], ["9999-12-31", 2]])("fails closed for invalid dates/durations %s %s", (date, days) => {
    expect(freeThrough([], "sedan", date as string, days as number)).toBe(false);
  });
});

describe("business calendar validation", () => {
  it("handles leap years and month boundaries", () => {
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("uses the India business day and validates 24-hour times", () => {
    expect(businessDate(new Date("2026-09-12T19:00:00Z"))).toBe("2026-09-13");
    expect(isTime("23:59")).toBe(true);
    expect(isTime("24:00")).toBe(false);
    expect(isTime("12:60")).toBe(false);
  });
});
