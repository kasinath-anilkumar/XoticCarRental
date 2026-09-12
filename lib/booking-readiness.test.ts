import { describe, expect, it } from "vitest";
import { bookingIssue } from "./booking-readiness";
import type { TripRequest } from "./types";

const trip = { stops: ["@10,76,Pickup", "@11,77,Drop"], date: "2026-10-18", time: "09:00" } as TripRequest;

describe("booking readiness", () => {
  it("requires selected locations and a real customer schedule", () => {
    expect(bookingIssue(trip, [], "2026-10-01")).toBeNull();
    expect(bookingIssue({ ...trip, stops: [trip.stops[0], "", trip.stops[1]] }, [], "2026-10-01")).toMatch(/each itinerary stop/);
    expect(bookingIssue({ ...trip, time: "" }, [], "2026-10-01")).toMatch(/date and time/);
    expect(bookingIssue({ ...trip, date: "2026-02-30" }, [], "2026-10-01")).toMatch(/date and time/);
    expect(bookingIssue(trip, [], "2026-10-19")).toMatch(/date and time/);
  });

  it("preserves an optional return date but rejects reversed and impossible date ranges", () => {
    expect(bookingIssue({ ...trip, returnDate: "2026-10-20" }, [], "2026-10-01")).toBeNull();
    expect(bookingIssue({ ...trip, returnDate: "2026-10-17" }, [], "2026-10-01")).toMatch(/return date/);
    expect(bookingIssue({ ...trip, returnDate: "2026-10-32" }, [], "2026-10-01")).toMatch(/return date/);
    expect(bookingIssue({ ...trip, returnDate: "2026-11-17" }, [], "2026-10-01")).toMatch(/30 days/);
  });
});
