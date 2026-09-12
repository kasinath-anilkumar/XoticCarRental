import { describe, expect, it } from "vitest";
import { tripFromParams, tripToParams } from "./quote";
import type { TripRequest } from "./types";

const defaults: TripRequest = {
  carSlug: "eclass", packageSlug: "8h", occasionSlug: "wedding", tripType: "local",
  customerPlace: "", stops: [], date: "2026-09-14", time: "09:00", haltHours: 0,
};

describe("shareable trip parameters", () => {
  it("retains missing stops instead of changing the meaning of a partial itinerary", () => {
    const trip = { ...defaults, stops: ["", "kochi-airport", ""] };
    expect(tripFromParams(Object.fromEntries(tripToParams(trip)), defaults)).toEqual(trip);
    expect(tripFromParams({ to: "kochi-airport" }, defaults).stops).toEqual(["", "kochi-airport"]);
  });

  it("replaces impossible dates and malformed times with safe defaults", () => {
    const trip = tripFromParams({ date: "2026-02-30", time: "25:70" }, defaults);
    expect(trip.date).toBe(defaults.date);
    expect(trip.time).toBe(defaults.time);
  });

  it("bounds route work from a supplied URL", () => {
    const trip = tripFromParams({ stops: Array(100).fill("x".repeat(500)).join("~") }, defaults);
    expect(trip.stops).toHaveLength(12);
    expect(trip.stops.every((token) => token.length <= 240)).toBe(true);
  });
});
