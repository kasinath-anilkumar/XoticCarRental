import { describe, expect, it } from "vitest";

import { CatalogPricingUnavailableError, isPricingAvailable } from "./catalog-readiness";
import { resolveQuote } from "./quote";
import type { Catalog } from "./content";
import type { TripRequest } from "./types";

function catalog(): Catalog {
  return {
    live: true,
    cars: [{
      slug: "car", name: "Test vehicle", year: 2026, type: "Sedan", seats: 4,
      transmission: "Automatic", fuel: "Petrol", homeCitySlug: "home", garageSlug: null,
      serviceCitySlugs: [], rating: "4.5", badge: "", rate8h: 1000, rate12h: 1500,
      rateFull: 2000, extraKmRate: 10, extraHrRate: 100, bata: 100, nightCharge: 100,
      occasions: ["casual"], images: [],
    }],
    // Put an unrelated city first to catch accidental default-city pricing.
    cities: [
      { slug: "other", name: "Other city", state: "Kerala", multiplier: 2,
        carCount: 0, lat: 10, lng: 76, heroImage: null, seoTitle: null, seoDescription: null },
      { slug: "home", name: "Home city", state: "Kerala", multiplier: 1.25,
        carCount: 1, lat: 9, lng: 76, heroImage: null, seoTitle: null, seoDescription: null },
    ],
    packages: [{ slug: "8h", label: "8 hrs / 80 km", hours: 8, km: 80, rateKey: "rate_8h", sub: "", icon: "" }],
    occasions: [{
      slug: "casual", name: "Casual", icon: "", tagline: "", surcharge: 0, handlingNote: "",
      kicker: "", title: "", blurb: "", h2: "", fleetTitle: "", ctaTitle: "", note: "",
      heroImage: null, includes: [], packages: [],
    }],
    locations: [], garages: [], carTypes: ["Sedan"], cityRoutes: [], seasons: [],
    settings: {
      whatsappNumber: "919876543210", phoneDisplay: "+91 98765 43210", email: "test@example.com",
      gstPercent: 5, advancePercent: 25, circuityFactor: 1.25,
      inclusions: [], exclusions: [], whyItems: [], charges: [],
    },
  };
}

const trip: TripRequest = {
  carSlug: "car", packageSlug: "8h", occasionSlug: "casual", tripType: "local",
  customerPlace: "", stops: [], date: "2026-09-14", time: "09:00", haltHours: 0,
};

describe("catalog pricing readiness", () => {
  it("turns an empty live database into a specific unavailable error, not a property access crash", () => {
    const empty = { ...catalog(), cars: [], cities: [], packages: [], occasions: [] };
    expect(isPricingAvailable(empty)).toBe(false);
    expect(() => resolveQuote(empty, trip)).toThrow(CatalogPricingUnavailableError);
    expect(() => resolveQuote(empty, trip)).toThrow("vehicle catalog is incomplete");
  });

  it.each(["cars", "packages", "occasions", "cities"] as const)(
    "rejects a partially configured catalog with no %s",
    (key) => {
      const incomplete = { ...catalog(), [key]: [] };
      expect(isPricingAvailable(incomplete)).toBe(false);
      expect(() => resolveQuote(incomplete, trip)).toThrow(CatalogPricingUnavailableError);
    },
  );

  it("does not substitute the first public city when a vehicle's home city was unpublished", () => {
    const incomplete = catalog();
    incomplete.cities = incomplete.cities.filter((city) => city.slug !== "home");
    expect(incomplete.cities[0].multiplier).toBe(2);
    expect(isPricingAvailable(incomplete)).toBe(false);
    expect(() => resolveQuote(incomplete, trip)).toThrow(CatalogPricingUnavailableError);
  });

  it("checks every offered car, including one that is not selected in the current trip", () => {
    const incomplete = catalog();
    incomplete.cars.push({ ...incomplete.cars[0], slug: "orphan", homeCitySlug: "unpublished" });
    expect(isPricingAvailable(incomplete)).toBe(false);
    expect(() => resolveQuote(incomplete, trip)).toThrow(CatalogPricingUnavailableError);
  });

  it("rejects an unresolved empty home-city slug even if a malformed city shares it", () => {
    const incomplete = catalog();
    incomplete.cars[0].homeCitySlug = "";
    incomplete.cities[0].slug = "";
    expect(isPricingAvailable(incomplete)).toBe(false);
  });

  it.each([true, false])("keeps valid pricing available with live=%s and no predefined stops or garages", (live) => {
    const ready = { ...catalog(), live };
    expect(isPricingAvailable(ready)).toBe(true);
    const resolved = resolveQuote(ready, trip);
    expect(resolved.city.slug).toBe("home");
    expect(resolved.quote.subtotal).toBe(1350);
    expect(resolved.quote.total).toBe(1417.5);
    expect(resolved.complete).toBe(false);
  });

  it("preserves existing unknown-slug fallbacks when the catalog itself is ready", () => {
    const ready = catalog();
    const expected = resolveQuote(ready, trip);
    const resolved = resolveQuote(ready, {
      ...trip, carSlug: "old-car", packageSlug: "old-package", occasionSlug: "old-occasion",
    });
    expect(resolved.car).toBe(ready.cars[0]);
    expect(resolved.pkg).toBe(ready.packages[0]);
    expect(resolved.occasion).toBe(ready.occasions[0]);
    expect(resolved.city.slug).toBe("home");
    expect(resolved.quote).toEqual(expected.quote);
  });
});
