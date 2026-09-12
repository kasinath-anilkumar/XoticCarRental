import { describe, expect, it } from "vitest";

import { budgetLabel, filterCars, MAX_BUDGET_AMOUNT, parseBudget, parseFilters } from "./catalog";
import type { Catalog } from "./content";

const catalog: Catalog = {
  live: true,
  cars: [{
    slug: "test-car", name: "Test car", year: 2026, type: "Sedan", seats: 4,
    transmission: "Automatic", fuel: "Petrol", homeCitySlug: "test-city", garageSlug: null,
    serviceCitySlugs: [], rating: "4.5", badge: "", rate8h: 1000, rate12h: 1500,
    rateFull: 2000, extraKmRate: 10, extraHrRate: 100, bata: 100, nightCharge: 100,
    occasions: [], images: [],
  }],
  cities: [{ slug: "test-city", name: "Test city", state: "Test state", multiplier: 1,
    carCount: 1, lat: 10, lng: 76, heroImage: null, seoTitle: null, seoDescription: null }],
  packages: [{ slug: "test-package", label: "Test package", hours: 8, km: 80, rateKey: "rate_8h", sub: "", icon: "" }],
  occasions: [], locations: [], garages: [], carTypes: ["Sedan"], cityRoutes: [], seasons: [],
  settings: {
    whatsappNumber: "", phoneDisplay: "", email: "", gstPercent: 5, advancePercent: 25,
    circuityFactor: 1.25,
    pricingRules: { minimumLegKm: 6, localSpeedKph: 35, outstationSpeedKph: 55,
      oneWayReturnPercent: 50, nightStartHour: 22, nightEndHour: 6 },
    inclusions: [], exclusions: [], whyItems: [], charges: [],
  },
};

describe("customer-defined browse budgets", () => {
  it("accepts arbitrary positive ceilings with up to two decimal places", () => {
    expect(parseFilters({ budget: "12345.67" }).budget).toBe("12345.67");
    expect(parseBudget(" 0015000.50 ")).toBe("15000.5");
    expect(parseBudget("0.01")).toBe("0.01");
    expect(parseBudget(String(MAX_BUDGET_AMOUNT))).toBe(String(MAX_BUDGET_AMOUNT));
    expect(budgetLabel("12345.67")).toBe("Up to ₹12,345.67");
  });

  it("preserves old bookmarked ceilings and plus-suffixed floors", () => {
    expect(parseFilters({ budget: "10000" }).budget).toBe("10000");
    expect(parseFilters({ budget: ["30000+", "10000"] }).budget).toBe("30000+");
    expect(budgetLabel("30000+")).toBe("At least ₹30,000");
  });

  it.each([undefined, "", "all", "0", "-1", "1e4", "Infinity", "NaN", "1.001", "100000000.01", "30000++", "12,000", "9".repeat(40)])(
    "discards invalid or unbounded budget %s", (value) => {
      expect(parseBudget(value)).toBe("all");
      expect(budgetLabel(value ?? "")).toBe("Any budget");
    },
  );

  it("compares an inclusive ceiling against the estimate including allowance and tax", () => {
    // Base 1,000 + allowance 100 + 5% GST = 1,155.
    const result = (budget: string) => filterCars(catalog, parseFilters({ budget }), catalog.packages[0]);
    expect(result("1000")).toHaveLength(0);
    expect(result("1154.99")).toHaveLength(0);
    expect(result("1155").map((car) => car.slug)).toEqual(["test-car"]);
    expect(result("1155+")).toHaveLength(1);
    expect(result("1155.01+")).toHaveLength(0);
  });
});
