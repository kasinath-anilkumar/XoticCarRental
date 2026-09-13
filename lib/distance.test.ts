import { describe, expect, it } from "vitest";
import { GARAGE_ROUTE_KEY, resolveRoute } from "./distance";
import type { ResolvedPlace } from "./places";

describe("vehicle garage identity", () => {
  it.each(["garage", GARAGE_ROUTE_KEY])("keeps customer slug %s distinct from the vehicle yard and published distances", (slug) => {
    const pickup: ResolvedPlace = {
      key: slug, name: "Garage meeting point", lat: 9.4981, lng: 76.3388,
      citySlug: "alappuzha", isAirport: false, served: true,
    };
    const destination: ResolvedPlace = {
      ...pickup, key: "chennai", name: "Chennai", lat: 13.0827, lng: 80.2707,
      citySlug: "chennai",
    };
    const route = resolveRoute({
      garage: { lat: 9.9312, lng: 76.2673 },
      stops: [pickup, destination], tripType: "oneway",
      routedLegs: [{ km: 65 }, { km: 700 }, { km: 800 }],
    }, 1.25, new Map([[`${slug}|chennai`, 710], [`chennai|${slug}`, 710]]), 6);

    expect(route.legs).toEqual([
      { fromSlug: GARAGE_ROUTE_KEY, toSlug: slug, km: 65, transfer: true },
      { fromSlug: slug, toSlug: "chennai", km: 710 },
      { fromSlug: "chennai", toSlug: GARAGE_ROUTE_KEY, km: 800, transfer: true },
    ]);
    expect(route.transferKm).toBe(865);
    expect(route.km).toBe(1575);
  });
});
