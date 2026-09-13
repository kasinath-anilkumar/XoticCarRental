import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Catalog } from "./catalog";
import { GARAGE_ROUTE_KEY, resolveRoute, roadKm, routePoints } from "./distance";
import { encodeFreePlace, type ResolvedPlace } from "./places";
import { passengerRouteStops, resolveQuote, tripStops, vehicleRouteStops } from "./quote";
import { resolveRoutedQuote } from "./quote-server";
import type { RoutedTrip } from "./route/types";
import type { TripRequest } from "./types";

const { routeThrough } = vi.hoisted(() => ({ routeThrough: vi.fn() }));
vi.mock("./route", () => ({ routeThrough }));

function place(name: string, lat: number, lng: number): ResolvedPlace {
  return { key: encodeFreePlace({ name, lat, lng }), name, lat, lng, citySlug: "", isAirport: false, served: false };
}
const garage = { lat: 9.9312, lng: 76.2673 };
const pickup = place("Alappuzha", 9.4981, 76.3388);
const destination = place("Chennai", 13.0827, 80.2707);
const otherDrop = place("Kollam", 8.8932, 76.6141);
const trip: TripRequest = {
  carSlug: "car", packageSlug: "8h", occasionSlug: "casual", tripType: "round",
  customerPlace: "", stops: [pickup.key, destination.key, pickup.key], date: "2026-09-14", time: "09:00", haltHours: 0,
};

function catalog(): Catalog {
  return {
    live: true,
    cars: [{
      slug: "car", name: "Test vehicle", year: 2026, type: "Sedan", seats: 4,
      transmission: "Automatic", fuel: "Petrol", homeCitySlug: "kochi", garageSlug: "yard",
      serviceCitySlugs: [], rating: "4.5", badge: "", rate8h: 1000, rate12h: 1500,
      rateFull: 2000, extraKmRate: 10, extraHrRate: 100, bata: 100, nightCharge: 100,
      occasions: ["casual"], images: [],
    }],
    cities: [{ slug: "kochi", name: "Kochi", state: "Kerala", multiplier: 1,
      carCount: 1, ...garage, heroImage: null, seoTitle: null, seoDescription: null }],
    garages: [{ slug: "yard", name: "Private yard address", citySlug: "kochi", ...garage }],
    packages: [{ slug: "8h", label: "8 hrs / 80 km", hours: 8, km: 80, rateKey: "rate_8h", sub: "", icon: "" }],
    occasions: [{
      slug: "casual", name: "Casual", icon: "", tagline: "", surcharge: 0, handlingNote: "",
      kicker: "", title: "", blurb: "", h2: "", fleetTitle: "", ctaTitle: "", note: "",
      heroImage: null, includes: [], packages: [],
    }],
    locations: [], carTypes: ["Sedan"], cityRoutes: [], seasons: [],
    settings: {
      pricingRules: { minimumLegKm: 6, localSpeedKph: 32, outstationSpeedKph: 52, oneWayReturnPercent: 35, nightStartHour: 22, nightEndHour: 6 },
      whatsappNumber: "919876543210", phoneDisplay: "+91 98765 43210", email: "test@example.com",
      gstPercent: 5, advancePercent: 25, circuityFactor: 1.25,
      inclusions: [], exclusions: [], whyItems: [], charges: [],
    },
  };
}

/** Synthetic directional road measurements; these are not actual city distances. */
function measured(km: number[], scope: RoutedTrip["scope"] = "vehicle"): RoutedTrip {
  return { scope, legs: km.map((value) => ({ km: value, minutes: value * 2 })),
    km: km.reduce((sum, value) => sum + value, 0), minutes: km.reduce((sum, value) => sum + value * 2, 0), path: [] };
}

beforeEach(() => { routeThrough.mockReset(); });

describe("canonical garage-to-garage itinerary", () => {
  it("accounts for Kochi garage, Alappuzha, Chennai, Alappuzha, garage exactly once", () => {
    const resolved = resolveQuote(catalog(), trip, measured([65, 700, 710, 66]));
    expect(vehicleRouteStops(catalog(), trip).map((point) => point.key)).toEqual([GARAGE_ROUTE_KEY, pickup.key, destination.key, pickup.key, GARAGE_ROUTE_KEY]);
    expect(resolved.legs.map((leg) => leg.km)).toEqual([65, 700, 710, 66]);
    expect(resolved.itineraryKm).toBe(1410);
    expect(resolved.transferKm).toBe(131);
    expect(resolved.quote.km).toBe(1541);
    expect(resolved.legs.reduce((sum, leg) => sum + leg.km, 0)).toBe(resolved.quote.km);
    expect(resolved.legs.map((leg) => Boolean(leg.transfer))).toEqual([true, false, false, true]);
    expect(resolved.drivingMinutes).toBe(3082);
    expect(resolved.routed).toBe(true);
    expect(vehicleRouteStops(catalog(), trip)[0].name).toBe("Garage");
  });

  it("honors a third stop as the final drop on a round trip instead of mirroring it", () => {
    const explicit = { ...trip, stops: [pickup.key, destination.key, otherDrop.key] };
    const resolved = resolveQuote(catalog(), explicit, measured([65, 700, 800, 90]));
    expect(vehicleRouteStops(catalog(), explicit).map((point) => point.key)).toEqual([GARAGE_ROUTE_KEY, pickup.key, destination.key, otherDrop.key, GARAGE_ROUTE_KEY]);
    expect(resolved.itineraryKm).toBe(1500);
    expect(resolved.transferKm).toBe(155);
    expect(resolved.legs.at(-1)?.fromSlug).toBe(otherDrop.key);
    expect(resolved.to?.key).toBe(otherDrop.key);
    expect(resolved.message).toContain("Final drop: Kollam");
    expect(passengerRouteStops(catalog(), explicit).map((point) => point.key)).toEqual(explicit.stops);
  });

  it("adds an actual independently measured return leg only for a two-stop round trip", () => {
    const twoStops = { ...trip, stops: [pickup.key, destination.key] };
    const resolved = resolveQuote(catalog(), twoStops, measured([65, 700, 710, 66]));
    expect(resolved.itineraryKm).toBe(1410);
    expect(resolved.legs.map((leg) => leg.km)).toEqual([65, 700, 710, 66]);
    expect(resolved.stops.map((stop) => stop.key)).toEqual([pickup.key, destination.key, pickup.key]);
    expect(resolved.from?.key).toBe(pickup.key);
    expect(resolved.to?.key).toBe(pickup.key);
    expect(resolved.message).toContain("Stop 1: Chennai");
    expect(resolved.message).toContain("Final drop: Alappuzha");
    expect(resolved.message).not.toContain("Final drop: Chennai");
    expect(resolved.trip.stops).toEqual([pickup.key, destination.key]);
    expect(tripStops(catalog(), twoStops).map((stop) => stop.key)).toEqual(twoStops.stops);
    expect(passengerRouteStops(catalog(), twoStops)).toEqual(resolved.stops);
    expect(vehicleRouteStops(catalog(), { ...twoStops, tripType: "oneway" })).toHaveLength(4);
  });

  it("retains per-leg measurements when the same directional pair is visited twice", () => {
    const repeated = { ...trip, stops: [pickup.key, destination.key, pickup.key, destination.key] };
    expect(resolveQuote(catalog(), repeated, measured([65, 700, 710, 705, 900])).legs.map((leg) => leg.km))
      .toEqual([65, 700, 710, 705, 900]);
  });

  it("does not invent driving distance or a round return for identical coordinates with different labels", () => {
    const alias = place("Different pickup label", pickup.lat, pickup.lng);
    expect(roadKm(pickup, alias, 1.25, undefined, 6)).toBe(0);
    const input = { stops: [pickup, alias], garage: null, tripType: "round" as const, routedLegs: [{ km: 20 }] };
    expect(routePoints(input)).toHaveLength(2);
    expect(resolveRoute(input, 1.25, undefined, 6)).toEqual({ legs: [{ fromSlug: pickup.key, toSlug: alias.key, km: 0 }], km: 0, itineraryKm: 0, transferKm: 0 });
  });

  it("retains published distances over road measurements, and the configured floor on other legs", () => {
    const route = resolveRoute({ stops: [pickup, destination], garage, tripType: "oneway", routedLegs: [{ km: 1 }, { km: 700 }, { km: 3 }] }, 1.25,
      new Map([[`${pickup.key}|${destination.key}`, 650]]), 6);
    expect(route.legs.map((leg) => leg.km)).toEqual([6, 650, 6]);
  });

  it("preserves legacy passenger-only measurements without applying them to garage transfers", () => {
    const legacy = resolveQuote(catalog(), { ...trip, tripType: "local", stops: [pickup.key, destination.key] }, { ...measured([700]), scope: undefined });
    expect(legacy.itineraryKm).toBe(700);
    expect(legacy.legs[0].transfer).toBe(true);
    expect(legacy.legs[0].km).not.toBe(700);
    expect(legacy.routed).toBe(true);
  });

  it("keeps a legacy two-stop road measurement valid when the summary adds its return stop", () => {
    const twoStops = { ...trip, stops: [pickup.key, destination.key] };
    const legacy = resolveQuote(catalog(), twoStops, { ...measured([700]), scope: undefined });
    expect(legacy.routed).toBe(true);
    expect(legacy.legs.filter((leg) => !leg.transfer)[0].km).toBe(700);
    expect(legacy.stops.map((stop) => stop.key)).toEqual([pickup.key, destination.key, pickup.key]);
    expect(legacy.message).toContain("Final drop: Alappuzha");
  });

  it("falls back completely when a vehicle response is partial or invalid", () => {
    const expected = resolveQuote(catalog(), trip);
    for (const invalid of [measured([65, 700]), measured([65, -700, 710, 66]), { ...measured([65, 700, 710, 66]), minutes: Infinity }]) {
      const actual = resolveQuote(catalog(), trip, invalid);
      expect(actual.quote).toEqual(expected.quote);
      expect(actual.routed).toBe(false);
      expect(actual.drivingMinutes).toBeNull();
    }
  });

  it("does not add a one-way percentage return when the return to garage is already measured or estimated", () => {
    const oneWay = { ...trip, tripType: "oneway" as const, stops: [pickup.key, destination.key] };
    const withoutPercent = catalog();
    withoutPercent.settings.pricingRules.oneWayReturnPercent = 0;
    for (const routed of [null, measured([65, 700, 900])]) {
      expect(resolveQuote(catalog(), oneWay, routed).quote).toEqual(resolveQuote(withoutPercent, oneWay, routed).quote);
    }
  });

  it("leaves incomplete passenger inputs without fabricated garage trips", () => {
    expect(vehicleRouteStops(catalog(), { ...trip, stops: [pickup.key, ""] })).toEqual([]);
    expect(resolveQuote(catalog(), { ...trip, stops: [pickup.key, ""] }).quote.km).toBe(0);
    expect(passengerRouteStops(catalog(), { ...trip, stops: [pickup.key, ""] }).map((stop) => stop.key)).toEqual([pickup.key]);
  });
});

describe("server quote routing", () => {
  it("makes one bounded call for all vehicle points and preserves the caller signal", async () => {
    routeThrough.mockResolvedValue({ ...measured([65, 700, 710, 66]), scope: undefined });
    const signal = new AbortController().signal;
    const resolved = await resolveRoutedQuote(catalog(), trip, { signal });
    expect(routeThrough).toHaveBeenCalledOnce();
    expect(routeThrough).toHaveBeenCalledWith([
      [garage.lat, garage.lng], [pickup.lat, pickup.lng], [destination.lat, destination.lng], [pickup.lat, pickup.lng], [garage.lat, garage.lng],
    ], { signal });
    expect(resolved.quote.km).toBe(1541);
    expect(resolved.routed).toBe(true);
  });
  it("uses the identical full-route estimate when the provider cannot answer", async () => {
    routeThrough.mockResolvedValue(null);
    const resolved = await resolveRoutedQuote(catalog(), trip);
    expect(resolved.quote).toEqual(resolveQuote(catalog(), trip).quote);
    expect(resolved.routed).toBe(false);
  });
  it("uses the canonical final drop for a two-stop round trip without changing routing points", async () => {
    routeThrough.mockResolvedValue(measured([65, 700, 710, 66]));
    const twoStops = { ...trip, stops: [pickup.key, destination.key] };
    const resolved = await resolveRoutedQuote(catalog(), twoStops);
    expect(routeThrough.mock.calls[0][0]).toHaveLength(5);
    expect(resolved.stops.map((stop) => stop.name)).toEqual(["Alappuzha", "Chennai", "Alappuzha"]);
    expect(resolved.to?.name).toBe("Alappuzha");
    expect(resolved.quote.km).toBe(1541);
  });
});
