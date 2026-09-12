import { describe, expect, it } from "vitest";

import { filterServiceCities, serviceStates } from "./service-areas";

const cities = [
  { slug: "harbour", name: "Harbour city", state: "New territory", airportName: "Harbour terminal" },
  { slug: "lake", name: "Lake city", state: "New territory", airportName: null },
  { slug: "hills", name: "Hills city", state: "Other province", airportName: "Mountain airport" },
];

describe("published service-area facets", () => {
  it("derives counted state choices from supplied cities, including previously unknown territories", () => {
    expect(serviceStates(cities)).toEqual([{ name: "New territory", count: 2 }, { name: "Other province", count: 1 }]);
    expect(serviceStates([])).toEqual([]);
    expect(serviceStates([{ state: " " }, { state: "  New territory " }])).toEqual([{ name: "New territory", count: 1 }]);
  });

  it("combines selected state and search rather than showing cities in conflicting states", () => {
    expect(filterServiceCities(cities, "New territory", "city").map((city) => city.slug)).toEqual(["harbour", "lake"]);
    expect(filterServiceCities(cities, "New territory", "Mountain")).toEqual([]);
    expect(filterServiceCities(cities, "all", " MOUNTAIN ").map((city) => city.slug)).toEqual(["hills"]);
  });

  it("never introduces unpublished choices and preserves each matching city's identity", () => {
    expect(filterServiceCities(cities, "Unsupported state", "")).toEqual([]);
    expect(filterServiceCities([], "all", "Harbour")).toEqual([]);
    expect(filterServiceCities(cities, "all", "harbour")[0]).toBe(cities[0]);
  });
});
