import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDuration,
  formatINR,
  formatTime,
  groupIndian,
  shortPlace,
} from "./format";
import { computeQuote, isNightPickup, tripTypeLabel } from "./pricing";
import {
  buildKmOverrides,
  buildRoutedOverrides,
  GARAGE_ROUTE_KEY,
  haversineKm,
  resolveRoute,
  roadKm,
} from "./distance";
import { decodeFreePlace, encodeFreePlace, fromServed, resolvePlace } from "./places";
import { freeThrough, unavailableOn } from "./availability";
import { seasonCovers, seasonFor } from "./seasons";
import { leadDateStamp, nextLeadId } from "./leads";
import { resolveQuote, tripFromParams, tripToParams } from "./quote";
import { parsePricingRules } from "./pricing-rules";
import {
  carPrice,
  cityRouteFares,
  estimatedFrom,
  filterCars,
  parseFilters,
  servesCity,
  DEFAULT_FILTERS,
  type CarFilters,
} from "./catalog";
import type { Catalog } from "./content";
import type { Availability } from "./store/types";
import type {
  Car,
  City,
  ExtraCharge,
  LocationPoint,
  Occasion,
  Package,
  PricingInput,
  Season,
  TripRequest,
} from "./types";

/**
 * Fixtures are written out literally rather than imported from the seed, so
 * that changing seed content can never silently change what these tests
 * assert. The values match the prototype's own data
 * (design/project/Xotic Car Rental.dc.html).
 */

const eclass: Car = {
  slug: "eclass",
  name: "Mercedes-Benz E-Class",
  year: 2023,
  type: "Luxury sedan",
  seats: 4,
  transmission: "Automatic",
  fuel: "Petrol",
  homeCitySlug: "kochi",
  garageSlug: null,
  serviceCitySlugs: [],
  rating: "4.9",
  badge: "Most booked",
  rate8h: 6500,
  rate12h: 8900,
  rateFull: 12500,
  extraKmRate: 34,
  extraHrRate: 350,
  bata: 600,
  nightCharge: 500,
  occasions: ["wedding", "celebrity", "casual"],
  images: [],
};

const x5: Car = {
  ...eclass,
  slug: "x5",
  name: "BMW X5",
  type: "Luxury SUV",
  seats: 5,
  fuel: "Diesel",
  homeCitySlug: "mumbai",
  garageSlug: null,
  serviceCitySlugs: [],
  rate8h: 8500,
  rate12h: 11500,
  rateFull: 15900,
  extraKmRate: 45,
  extraHrRate: 450,
  bata: 700,
  nightCharge: 600,
  occasions: ["celebrity", "wedding"],
};

const kochi: City = {
  slug: "kochi",
  name: "Kochi",
  state: "Kerala",
  multiplier: 1.0,
  carCount: 150,
  lat: 9.9312,
  lng: 76.2673,
  heroImage: null,
  seoTitle: null,
  seoDescription: null,
};

const mumbai: City = {
  ...kochi,
  slug: "mumbai",
  name: "Mumbai",
  state: "Maharashtra",
  multiplier: 1.15,
  carCount: 350,
  lat: 19.076,
  lng: 72.8777,
};

const p8: Package = {
  slug: "p8",
  label: "8 hrs / 80 km",
  hours: 8,
  km: 80,
  rateKey: "rate_8h",
  sub: "Half day in the city",
  icon: "ph-clock",
};

const p12: Package = {
  slug: "p12",
  label: "12 hrs / 120 km",
  hours: 12,
  km: 120,
  rateKey: "rate_12h",
  sub: "Long day, functions",
  icon: "ph-clock-clockwise",
};

const full: Package = {
  slug: "full",
  label: "Full day 24 hrs / 300 km",
  hours: 24,
  km: 300,
  rateKey: "rate_full",
  sub: "Outstation, multi-city",
  icon: "ph-road-horizon",
};

function occasion(slug: string, name: string, surcharge: number, handlingNote = ""): Occasion {
  return {
    slug,
    name,
    icon: "ph-heart",
    tagline: "",
    surcharge,
    handlingNote,
    kicker: "",
    title: "",
    blurb: "",
    h2: "",
    fleetTitle: "",
    ctaTitle: "",
    note: "",
    heroImage: null,
    includes: [],
    packages: [],
  };
}

const casual = occasion("casual", "Casual & city", 0);
const wedding = occasion(
  "wedding",
  "Wedding",
  2500,
  "Decor clearance, morning detailing, convoy contact",
);
const celebrity = occasion(
  "celebrity",
  "Celebrity pickup",
  3500,
  "Privacy fit-out, route plan, standby at venue",
);

const pricingRules = { minimumLegKm: 6, localSpeedKph: 32, outstationSpeedKph: 52, oneWayReturnPercent: 35, nightStartHour: 22, nightEndHour: 6 };

function input(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    pricingRules,
    car: eclass,
    pkg: p8,
    city: kochi,
    occasion: casual,
    tripType: "local",
    km: 60,
    haltHours: 2,
    time: "09:00",
    gstPercent: 5,
    advancePercent: 25,
    ...overrides,
  };
}

describe("configured operational pricing and rental dates", () => {
  it("does not charge a second return allowance when garage-return kilometres are already billed", () => {
    const legacy = computeQuote(input({ tripType: "oneway", km: 300, haltHours: 0 }));
    const completeRoute = computeQuote(input({ tripType: "oneway", km: 300, haltHours: 0, returnDistanceIncluded: true }));
    expect(completeRoute.km).toBe(300);
    expect(completeRoute.lines.some((line) => line.label === "One-way driver return")).toBe(false);
    expect(completeRoute.lines.find((line) => line.label.startsWith("Extra distance"))?.amount).toBe((300 - 80) * 34);
    expect(legacy.subtotal - completeRoute.subtotal).toBe(3570);
  });

  it("uses configured speed, return allowance and night window in amounts and descriptions", () => {
    const rules = { ...pricingRules, localSpeedKph: 16, oneWayReturnPercent: 10, nightStartHour: 21 };
    expect(computeQuote(input({ pricingRules: rules, km: 64, haltHours: 0 })).hours).toBe(4);
    const quote = computeQuote(input({ pricingRules: rules, tripType: "oneway", km: 100, time: "21:30" }));
    expect(quote.nightStart).toBe(true);
    expect(quote.lines.find((line) => line.label === "One-way driver return")).toMatchObject({ amount: 340, note: "10% of 100 km at ₹34/km" });
    expect(quote.lines.find((line) => line.label.startsWith("Night charge"))?.note).toContain("9:00 pm and 6:00 am");
  });

  it("bills all selected inclusive rental dates even when driving takes only an hour", () => {
    const quote = computeQuote(input({ km: 20, haltHours: 0, date: "2028-02-28", returnDate: "2028-03-01" }));
    expect(quote).toMatchObject({ days: 3, includedKm: 240, includedHours: 24 });
    expect(quote.lines[0]!.amount).toBe(19_500);
    expect(quote.lines.find((line) => line.label.startsWith("Driver allowance"))?.amount).toBe(1_800);
    expect(quote.lines.find((line) => line.label.startsWith("Night charge"))?.amount).toBe(1_000);
  });

  it("keeps existing amounts for same-day and unspecified return dates", () => {
    expect(computeQuote(input({ date: "2026-09-14", returnDate: "2026-09-14" }))).toEqual(computeQuote(input({ date: "2026-09-14" })));
  });

  it("supports an explicitly configured window that does not wrap midnight", () => {
    const rules = { ...pricingRules, nightStartHour: 2, nightEndHour: 5 };
    expect(isNightPickup("03:00", rules)).toBe(true);
    expect(isNightPickup("23:00", rules)).toBe(false);
    expect(isNightPickup("05:00", rules)).toBe(false);
  });

  it.each([undefined, {}, { ...pricingRules, localSpeedKph: 0 }, { ...pricingRules, nightEndHour: 22 }, { ...pricingRules, oneWayReturnPercent: 101 }])("refuses missing or invalid pricing configuration", (rules) => {
    expect(() => parsePricingRules(rules)).toThrow();
  });

  it("round trips a return date and a deliberately blank final stop", () => {
    const trip: TripRequest = { carSlug: "eclass", packageSlug: "8h", occasionSlug: "casual", tripType: "round", customerPlace: "", stops: ["@10,76,Pickup", ""], date: "2026-09-14", returnDate: "2026-09-16", time: "09:00", haltHours: 0 };
    expect(tripFromParams(Object.fromEntries(tripToParams(trip)), trip)).toEqual(trip);
    expect(tripFromParams({ from: trip.stops[0], date: trip.date, returnDate: trip.returnDate }, { ...trip, stops: [] })).toMatchObject({ stops: [trip.stops[0], ""], returnDate: trip.returnDate });
    expect(tripFromParams({ returnDate: "" }, trip).returnDate).toBe("");
  });
});

describe("computeQuote — the prototype's default trip", () => {
  // E-Class, 8hr package, Marine Drive → airport → back, 2 halt hours, 9am.
  const quote = computeQuote(input());

  it("bills 4 hours across a single day", () => {
    expect(quote.hours).toBe(4);
    expect(quote.days).toBe(1);
    expect(quote.outstation).toBe(false);
  });

  it("charges only the package and the driver's bata", () => {
    expect(quote.lines).toHaveLength(2);
    expect(quote.lines[0]).toEqual({
      label: "8 hrs / 80 km package",
      note: "Mercedes-Benz E-Class · Kochi rate ×1.00",
      amount: 6500,
    });
    expect(quote.lines[1]).toEqual({
      label: "Driver allowance (bata)",
      note: "Food and stay for the chauffeur",
      amount: 600,
    });
  });

  it("totals ₹7,455 with a ₹1,900 advance", () => {
    expect(quote.subtotal).toBe(7100);
    expect(quote.gst).toBe(355);
    expect(quote.total).toBe(7455);
    expect(quote.advance).toBe(1900);
  });

  it("stays inside the package allowance", () => {
    expect(quote.includedKm).toBe(80);
    expect(quote.includedHours).toBe(8);
    expect(quote.nightStart).toBe(false);
  });
});

describe("computeQuote — spilling past the package", () => {
  // 200 km local pushes to 8.5 hours, which is a second day on an 8hr package.
  const quote = computeQuote(input({ km: 200 }));

  it("rolls into a second day and charges the extra distance", () => {
    expect(quote.hours).toBe(8.5);
    expect(quote.days).toBe(2);
    expect(quote.includedKm).toBe(160);
  });

  it("itemises extra km, doubled bata and one overnight halt", () => {
    expect(quote.lines.map((l) => l.label)).toEqual([
      "8 hrs / 80 km package × 2 days",
      "Extra distance · 40 km",
      "Driver allowance (bata) × 2",
      "Night charge × 1",
    ]);
    expect(quote.lines[1].amount).toBe(40 * 34);
    expect(quote.lines[1].note).toBe("₹34/km past 160 km included");
    expect(quote.lines[3].note).toBe("Overnight halt on a multi-day trip");
  });

  it("totals ₹16,863", () => {
    expect(quote.subtotal).toBe(16060);
    expect(quote.total).toBe(16863);
    expect(quote.advance).toBe(4200);
  });
});

describe("computeQuote — one-way outstation, night pickup, wedding", () => {
  const quote = computeQuote(
    input({
      pkg: p12,
      tripType: "oneway",
      km: 300,
      haltHours: 0,
      time: "23:00",
      occasion: wedding,
    }),
  );

  it("uses the outstation speed", () => {
    // 300 km ÷ 52 km/h = 5.77 h, rounded up to the half hour.
    expect(quote.hours).toBe(6);
    expect(quote.days).toBe(1);
    expect(quote.outstation).toBe(true);
  });

  it("charges the night pickup even on a single-day trip", () => {
    expect(quote.nightStart).toBe(true);
    const night = quote.lines.find((l) => l.label.startsWith("Night charge"));
    expect(night).toEqual({
      label: "Night charge × 1",
      note: "Pickup between 10:00 pm and 6:00 am",
      amount: 500,
    });
  });

  it("adds the driver's empty return at 35% of the fare", () => {
    const ret = quote.lines.find((l) => l.label === "One-way driver return");
    expect(ret).toEqual({
      label: "One-way driver return",
      note: "35% of 300 km at ₹34/km",
      amount: 3570,
    });
  });

  it("adds the wedding handling fee", () => {
    const handling = quote.lines.find((l) => l.label === "Wedding handling");
    expect(handling?.amount).toBe(2500);
    expect(handling?.note).toBe("Decor clearance, morning detailing, convoy contact");
  });

  it("totals ₹23,299.50", () => {
    expect(quote.subtotal).toBe(22190);
    expect(quote.total).toBeCloseTo(23299.5, 2);
    expect(quote.advance).toBe(5800);
  });
});

describe("computeQuote — round trip with a city multiplier", () => {
  const quote = computeQuote(
    input({
      car: x5,
      pkg: full,
      city: mumbai,
      occasion: celebrity,
      tripType: "round",
      km: 900,
      haltHours: 0,
      time: "06:00",
    }),
  );

  it("applies the city multiplier to the package base", () => {
    expect(quote.lines[0].amount).toBeCloseTo(15900 * 1.15, 6);
    expect(quote.lines[0].note).toBe("BMW X5 · Mumbai rate ×1.15");
  });

  it("charges no night fee for a 6am pickup", () => {
    expect(quote.nightStart).toBe(false);
    expect(quote.lines.some((l) => l.label.startsWith("Night charge"))).toBe(false);
  });

  it("charges no one-way return on a round trip", () => {
    expect(quote.lines.some((l) => l.label === "One-way driver return")).toBe(false);
  });

  it("totals ₹51,959.25", () => {
    expect(quote.subtotal).toBeCloseTo(49485, 6);
    expect(quote.total).toBeCloseTo(51959.25, 2);
    expect(quote.advance).toBe(13000);
  });
});

describe("computeQuote — guards", () => {
  it("never bills less than one hour", () => {
    expect(computeQuote(input({ km: 1, haltHours: 0 })).hours).toBe(1);
  });

  it("rolls a long halt into another package day", () => {
    const quote = computeQuote(input({ km: 10, haltHours: 11 }));
    // 10/32 = 0.3125 h + 11 = 11.3125 -> 11.5 h billable.
    expect(quote.hours).toBe(11.5);
    expect(quote.days).toBe(2);
  });

  /**
   * KNOWN BEHAVIOUR, carried over deliberately from the prototype.
   *
   * `days = ceil(hours / pkg.hours)` guarantees `days * pkg.hours >= hours`, so
   * `extraHours = max(0, hours - includedHours)` is always 0 — the "Extra hours"
   * line in the quote can never fire, no matter the input. Time past the package
   * is billed as another whole package day instead: 3 hours over an 8hr/₹6,500
   * package costs a second ₹6,500, not 3 × ₹350.
   *
   * The rate card still advertises "Extra time · ₹350 / hr", so the published
   * rate and the quote disagree. This is flagged for a business decision rather
   * than silently changed here — see the note in the handover.
   */
  it("never bills extra hours: time past the package rolls to another day", () => {
    const cases: PricingInput[] = [
      input({ pkg: p12, km: 192, haltHours: 8 }),
      input({ pkg: p8, km: 400, haltHours: 6 }),
      input({ pkg: full, tripType: "round", km: 1500, haltHours: 10 }),
    ];
    for (const testCase of cases) {
      const quote = computeQuote(testCase);
      expect(quote.hours).toBeLessThanOrEqual(quote.includedHours);
      expect(quote.lines.some((l) => l.label.startsWith("Extra hours"))).toBe(false);
    }
  });
});

describe("isNightPickup", () => {
  it.each([
    ["22:00", true],
    ["23:30", true],
    ["00:00", true],
    ["05:59", true],
    ["06:00", false],
    ["09:00", false],
    ["21:59", false],
  ])("%s -> %s", (time, expected) => {
    expect(isNightPickup(time, pricingRules)).toBe(expected);
  });
});

describe("tripTypeLabel", () => {
  it("matches the prototype's wording", () => {
    expect(tripTypeLabel("local")).toBe("Local, in city");
    expect(tripTypeLabel("oneway")).toBe("Outstation one-way");
    expect(tripTypeLabel("round")).toBe("Outstation round trip");
  });
});

describe("formatting", () => {
  it("groups rupees the Indian way", () => {
    expect(groupIndian(100)).toBe("100");
    expect(groupIndian(1900)).toBe("1,900");
    expect(groupIndian(12500)).toBe("12,500");
    expect(groupIndian(123456)).toBe("1,23,456");
    expect(groupIndian(1234567)).toBe("12,34,567");
  });

  it("rounds to whole rupees", () => {
    expect(formatINR(7455.49)).toBe("₹7,455");
    expect(formatINR(1109.5)).toBe("₹1,110");
  });

  it("formats dates and times the way the design writes them", () => {
    expect(formatDate("2026-09-14")).toBe("14 Sep 2026");
    expect(formatTime("09:00")).toBe("9:00 am");
    expect(formatTime("22:30")).toBe("10:30 pm");
    expect(formatTime("00:15")).toBe("12:15 am");
  });

  it("shortens place names for route lines", () => {
    expect(shortPlace("Marine Drive, Kochi")).toBe("Marine Drive");
    expect(shortPlace("Cochin Intl Airport (COK)")).toBe("Cochin Intl Airport");
  });
});

describe("distance", () => {
  const marineLocation: LocationPoint = {
    slug: "kochi-marine",
    name: "Marine Drive, Kochi",
    citySlug: "kochi",
    lat: 9.9816,
    lng: 76.2755,
    isAirport: false,
  };
  const cokLocation: LocationPoint = {
    slug: "kochi-airport",
    name: "Cochin Intl Airport (COK)",
    citySlug: "kochi",
    lat: 10.152,
    lng: 76.4019,
    isAirport: true,
  };
  const munnarLocation: LocationPoint = {
    slug: "munnar",
    name: "Munnar",
    citySlug: "kochi",
    lat: 10.0889,
    lng: 77.0595,
    isAirport: false,
  };

  const marine = fromServed(marineLocation);
  const cok = fromServed(cokLocation);
  const munnar = fromServed(munnarLocation);

  it("measures the great-circle distance", () => {
    // Marine Drive to COK is ~23 km as the crow flies, ~30 km by road.
    expect(haversineKm(marine, cok)).toBeGreaterThan(20);
    expect(haversineKm(marine, cok)).toBeLessThan(27);
  });

  it("scales straight-line distance up to road distance", () => {
    const km = roadKm(marine, cok, 1.25);
    expect(km).toBeGreaterThanOrEqual(26);
    expect(km).toBeLessThanOrEqual(34);
  });

  it("puts Munnar within range of its real 130 km road distance", () => {
    expect(roadKm(marine, munnar, 1.25)).toBeGreaterThan(105);
    expect(roadKm(marine, munnar, 1.25)).toBeLessThan(140);
  });

  it("is zero between a point and itself", () => {
    expect(roadKm(marine, marine, 1.25)).toBe(0);
    expect(resolveRoute({ stops: [marine, marine], garage: null, tripType: "local" }, 1.25, undefined, 6).km).toBe(0);
  });

  it("floors a short hop at 6 km", () => {
    const nearby = fromServed({ ...cokLocation, slug: "nearby", lat: 9.9818, lng: 76.2757 });
    expect(roadKm(marine, nearby, 1.25, undefined, pricingRules.minimumLegKm)).toBe(6);
    expect(roadKm(marine, nearby, 1.25, undefined, 0)).toBe(0);
    expect(roadKm(marine, nearby, 1.25, undefined, 10)).toBe(10);
  });

  it("sums the legs of a there-and-back route", () => {
    const route = resolveRoute(
      { stops: [marine, cok, marine], garage: null, tripType: "local" },
      1.25,
    );
    expect(route.legs).toHaveLength(2);
    expect(route.km).toBe(route.legs[0].km + route.legs[1].km);
  });

  it("prefers a published road distance over the estimate, both ways round", () => {
    const overrides = buildKmOverrides([
      { citySlug: "kochi", fromSlug: "kochi-marine", toSlug: "munnar", kmOverride: 130 },
      { citySlug: "kochi", fromSlug: "kochi-marine", toSlug: "kochi-fort", kmOverride: null },
    ]);

    expect(roadKm(marine, munnar, 1.25, overrides)).toBe(130);
    expect(roadKm(munnar, marine, 1.25, overrides)).toBe(130);
    // A route row with no override still falls back to the estimate.
    expect(roadKm(marine, cok, 1.25, overrides)).toBe(roadKm(marine, cok, 1.25));
  });

  it("applies published distances to every leg of a route", () => {
    const overrides = buildKmOverrides([
      { citySlug: "kochi", fromSlug: "kochi-marine", toSlug: "munnar", kmOverride: 130 },
    ]);
    const route = resolveRoute(
      { stops: [marine, munnar, marine], garage: null, tripType: "round" },
      1.25,
      overrides,
    );
    expect(route.km).toBe(260);
  });

  it("doubles a round trip that has no explicit return drop", () => {
    const oneLeg = resolveRoute(
      { stops: [marine, munnar], garage: null, tripType: "oneway" },
      1.25,
    );
    const roundTrip = resolveRoute(
      { stops: [marine, munnar], garage: null, tripType: "round" },
      1.25,
    );
    expect(roundTrip.km).toBe(oneLeg.km * 2);
  });
});

describe("places", () => {
  const locations: LocationPoint[] = [
    {
      slug: "kochi-marine",
      name: "Marine Drive, Kochi",
      citySlug: "kochi",
      lat: 9.9816,
      lng: 76.2755,
      isAirport: false,
    },
  ];

  it("resolves one of our own pickup points by slug", () => {
    const place = resolvePlace("kochi-marine", locations);
    expect(place).toMatchObject({ key: "kochi-marine", name: "Marine Drive, Kochi", served: true });
  });

  it("round-trips anywhere in India through a token", () => {
    const token = encodeFreePlace({ name: "Thrissur", lat: 10.52, lng: 76.2144 });
    expect(token).toBe("@10.52,76.2144,Thrissur");

    const place = resolvePlace(token, locations);
    expect(place).toMatchObject({ name: "Thrissur", lat: 10.52, lng: 76.2144, served: false });
  });

  it("keeps commas in a place name — the name is the last field", () => {
    const token = encodeFreePlace({ name: "Fort Kochi, Ernakulam", lat: 9.9658, lng: 76.2422 });
    expect(decodeFreePlace(token)?.name).toBe("Fort Kochi, Ernakulam");
  });

  it("rejects a malformed or out-of-range token", () => {
    expect(decodeFreePlace("@nonsense")).toBeNull();
    expect(decodeFreePlace("@10.5,76.2")).toBeNull();
    expect(decodeFreePlace("@999,76.2,Nowhere")).toBeNull();
    expect(resolvePlace("not-a-slug", locations)).toBeNull();
  });

  it("prices a free place exactly like a served one", () => {
    const served = fromServed(locations[0]);
    const free = decodeFreePlace(encodeFreePlace({ name: "Munnar", lat: 10.0889, lng: 77.0595 }))!;
    // Same coordinates in, same distance out — being un-curated costs nothing.
    const asFree = roadKm(served, free, 1.25);
    const asServed = roadKm(served, fromServed({
      slug: "munnar", name: "Munnar", citySlug: "kochi", lat: 10.0889, lng: 77.0595, isAirport: false,
    }), 1.25);
    expect(asFree).toBe(asServed);
  });

  it("cannot claim a published road distance for a free place", () => {
    const overrides = buildKmOverrides([
      { citySlug: "kochi", fromSlug: "kochi-marine", toSlug: "munnar", kmOverride: 130 },
    ]);
    const served = fromServed(locations[0]);
    const freeMunnar = decodeFreePlace("@10.0889,77.0595,Munnar")!;
    // The override is keyed by slug, and a free place has none — so it falls
    // through to the estimate rather than borrowing someone else's number.
    expect(roadKm(served, freeMunnar, 1.25, overrides)).not.toBe(130);
  });
});

describe("routed distance", () => {
  const marine = fromServed({
    slug: "kochi-marine",
    name: "Marine Drive",
    citySlug: "kochi",
    lat: 9.9816,
    lng: 76.2673,
    isAirport: false,
  });
  const cok = fromServed({
    slug: "kochi-airport",
    name: "Cochin Intl Airport",
    citySlug: "kochi",
    lat: 10.152,
    lng: 76.3919,
    isAirport: true,
  });
  const munnar = decodeFreePlace("@10.0889,77.0595,Munnar")!;

  it("beats the straight-line estimate", () => {
    const measured = buildRoutedOverrides([marine, munnar], [{ km: 130.4 }]);
    const estimated = roadKm(marine, munnar, 1.25);

    expect(roadKm(marine, munnar, 1.25, measured)).toBe(130);
    // The estimate was the reason this feature exists: ~25 km short on a road
    // that climbs the Ghats.
    expect(estimated).toBeLessThan(120);
  });

  it("applies to a free place, unlike a published fare", () => {
    // A published override is keyed by slug and a free place has none. The
    // router works from coordinates, so it reaches everywhere.
    const measured = buildRoutedOverrides([marine, munnar], [{ km: 130.4 }]);
    expect(measured.get("kochi-marine|@10.0889,77.0595,Munnar")).toBe(130);
  });

  it("keeps the minimum billable leg", () => {
    const measured = buildRoutedOverrides([marine, cok], [{ km: 2.4 }], pricingRules.minimumLegKm);
    // A 2 km hop is still a trip; the floor is a billing rule, not a hedge
    // against a bad estimate.
    expect(roadKm(marine, cok, 1.25, measured)).toBe(6);
  });

  it("is directional — a router may send you home another way", () => {
    const measured = buildRoutedOverrides([marine, cok], [{ km: 34.8 }]);
    expect(measured.get("kochi-marine|kochi-airport")).toBe(35);
    expect(measured.get("kochi-airport|kochi-marine")).toBeUndefined();
  });

  it("ignores a leg between two identical stops", () => {
    expect(buildRoutedOverrides([marine, marine], [{ km: 0 }]).size).toBe(0);
  });

  it("totals a multi-leg trip from the legs the router measured", () => {
    const stops = [marine, cok, marine];
    const measured = buildRoutedOverrides(stops, [{ km: 34.8 }, { km: 36.3 }]);
    const route = resolveRoute(
      { stops: [marine, cok, marine], garage: null, tripType: "local" },
      1.25,
      measured,
    );

    expect(route.legs.map((leg) => leg.km)).toEqual([35, 36]);
    expect(route.km).toBe(71);
  });

  it("still yields to a published route fare", () => {
    const published = buildKmOverrides([
      { citySlug: "kochi", fromSlug: "kochi-marine", toSlug: "kochi-airport", kmOverride: 30 },
    ]);
    const measured = buildRoutedOverrides([marine, cok], [{ km: 34.8 }]);
    // Same precedence the quote applies: somebody measured the published one on
    // purpose, and the city page prints it.
    const merged = new Map([...measured, ...published]);

    expect(roadKm(marine, cok, 1.25, merged)).toBe(30);
  });
});

describe("formatDuration", () => {
  it("reads as a drive, not a decimal", () => {
    expect(formatDuration(48)).toBe("48 min");
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(140)).toBe("2 hr 20 min");
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(-5)).toBe("0 min");
  });
});

describe("a trip with an end missing", () => {
  const marine: LocationPoint = {
    slug: "kochi-marine",
    name: "Marine Drive",
    citySlug: "kochi",
    lat: 9.9816,
    lng: 76.2673,
    isAirport: false,
  };
  const cok: LocationPoint = {
    slug: "kochi-airport",
    name: "Cochin Intl Airport",
    citySlug: "kochi",
    lat: 10.152,
    lng: 76.3919,
    isAirport: true,
  };

  const catalog: Catalog = {
    live: false,
    cities: [kochi],
    locations: [marine, cok],
    garages: [],
    packages: [p8, p12, full],
    occasions: [casual],
    cars: [eclass],
    carTypes: ["Luxury sedan"],
    cityRoutes: [],
    seasons: [],
    settings: {
      whatsappNumber: "919876543210",
      phoneDisplay: "+91 98765 43210",
      email: "hello@xotic.example",
      gstPercent: 5,
      advancePercent: 25,
      circuityFactor: 1.25,
      pricingRules,
      inclusions: [],
      exclusions: [],
      whyItems: [],
      charges: [],
    },
  };

  const trip = {
    carSlug: "eclass",
    packageSlug: "p8",
    tripType: "local" as const,
    customerPlace: "",
    stops: ["kochi-marine", "kochi-airport"],
    date: "2026-09-01",
    time: "09:00",
    occasionSlug: "casual",
    haltHours: 2,
  };

  it("invents nothing when the pickup is cleared", () => {
    const resolved = resolveQuote(catalog, { ...trip, stops: ["", "kochi-airport"] });

    // The bug this replaced: an empty pickup fell back to the first location in
    // the catalog, so clearing the field silently moved the trip to Kochi —
    // pin on the map, kilometres on the invoice, nothing on screen saying so.
    expect(resolved.from).toBeNull();
    expect(resolved.complete).toBe(false);
    expect(resolved.stops).toEqual([]);
    expect(resolved.quote.km).toBe(0);
  });

  it("keeps a pickup with no drop, so the map can show where you are", () => {
    const resolved = resolveQuote(catalog, { ...trip, stops: ["kochi-marine", ""] });

    expect(resolved.from?.name).toBe("Marine Drive");
    expect(resolved.to).toBeNull();
    expect(resolved.complete).toBe(false);
    expect(resolved.stops.map((stop) => stop.name)).toEqual(["Marine Drive"]);
  });

  it("still quotes the package, which is a real price either way", () => {
    const resolved = resolveQuote(catalog, { ...trip, stops: [] });

    // 8 hrs / 80 km at the Kochi multiplier, plus the driver's bata. No
    // distance charge, because there is no distance.
    expect(resolved.quote.km).toBe(0);
    expect(resolved.quote.lines.some((line) => line.label.startsWith("Extra distance"))).toBe(false);
    expect(resolved.quote.total).toBeGreaterThan(0);
  });

  it("does not hand an operator half a quote", () => {
    const resolved = resolveQuote(catalog, { ...trip, stops: ["", "kochi-airport"] });
    expect(resolved.message).not.toContain("Pickup:");
  });

  it("prices the journey once both ends are set", () => {
    const resolved = resolveQuote(catalog, trip);

    expect(resolved.complete).toBe(true);
    expect(resolved.stops.map((stop) => stop.name)).toEqual(["Marine Drive", "Cochin Intl Airport"]);
    expect(resolved.quote.km).toBeGreaterThan(0);
  });

  it("applies the configured minimum to routed and estimated quote legs", () => {
    const configured = { ...catalog, settings: { ...catalog.settings, pricingRules: { ...pricingRules, minimumLegKm: 50 } } };
    const estimated = resolveQuote(configured, trip);
    expect(estimated.legs.every((leg) => leg.km >= 50)).toBe(true);
    const routed = resolveQuote(configured, trip, { legs: [{ km: 2, minutes: 5 }], km: 2, minutes: 5, path: [] });
    expect(routed.itineraryKm).toBe(50);
    const noFloor = { ...catalog, settings: { ...catalog.settings, pricingRules: { ...pricingRules, minimumLegKm: 0 } } };
    expect(resolveQuote(noFloor, trip, { legs: [{ km: 2, minutes: 5 }], km: 2, minutes: 5, path: [] }).itineraryKm).toBe(2);
  });

  it("uses the configured outstation speed for city route travel-time previews", () => {
    const configured = { ...catalog, cityRoutes: [{ citySlug: "kochi", fromSlug: "kochi-marine", toSlug: "kochi-airport", kmOverride: 104 }] };
    expect(cityRouteFares(configured, kochi)[0]?.driveTime).toBe("about 2 hr");
    const faster = { ...configured, settings: { ...configured.settings, pricingRules: { ...pricingRules, outstationSpeedKph: 104 } } };
    expect(cityRouteFares(faster, kochi)[0]?.driveTime).toBe("about 1 hr");
  });

  it("takes the router's kilometres over the estimate", () => {
    const estimated = resolveQuote(catalog, trip);
    const routed = resolveQuote(catalog, trip, {
      legs: [{ km: 34.8, minutes: 48 }],
      km: 34.8,
      minutes: 48,
      path: [],
    });

    // 35 km of itinerary, plus the vehicle's run from its base and home
    // again — the total is the working day, not the passenger's part of it.
    expect(routed.itineraryKm).toBe(35);
    expect(routed.quote.km).toBe(35 + routed.transferKm);
    expect(routed.quote.km).not.toBe(estimated.quote.km);
    expect(routed.drivingMinutes).toBe(48);
    expect(routed.routed).toBe(true);
  });
});

describe("garage-to-garage (§9)", () => {
  const yard = { lat: 9.9915, lng: 76.2999 };
  const marineDrive = fromServed({
    slug: "kochi-marine",
    name: "Marine Drive",
    citySlug: "kochi",
    lat: 9.9816,
    lng: 76.2673,
    isAirport: false,
  });
  const airport = fromServed({
    slug: "kochi-airport",
    name: "Cochin Intl Airport",
    citySlug: "kochi",
    lat: 10.152,
    lng: 76.3919,
    isAirport: true,
  });

  it("prices the vehicle's run to the pickup and home from the drop", () => {
    const without = resolveRoute({ stops: [marineDrive, airport], garage: null, tripType: "oneway" }, 1.25);
    const with_ = resolveRoute({ stops: [marineDrive, airport], garage: yard, tripType: "oneway" }, 1.25);

    // The passenger's part is identical; the billed distance is not.
    expect(with_.itineraryKm).toBe(without.itineraryKm);
    expect(with_.transferKm).toBeGreaterThan(0);
    expect(with_.km).toBe(with_.itineraryKm + with_.transferKm);
    expect(with_.km).toBeGreaterThan(without.km);
  });

  it("marks the transfer legs so they can be shown apart from the journey", () => {
    const route = resolveRoute({ stops: [marineDrive, airport], garage: yard, tripType: "oneway" }, 1.25);

    const transfers = route.legs.filter((leg) => leg.transfer);
    expect(transfers).toHaveLength(2);
    // One out of the yard, one back into it — and nothing in between claims to be.
    expect(transfers[0]!.fromSlug).toBe(GARAGE_ROUTE_KEY);
    expect(transfers[1]!.toSlug).toBe(GARAGE_ROUTE_KEY);
    expect(route.legs.filter((leg) => !leg.transfer)).toHaveLength(1);
  });

  it("comes home from the LAST stop, not back the way it came", () => {
    const munnar = fromServed({
      slug: "munnar",
      name: "Munnar",
      citySlug: "kochi",
      lat: 10.0889,
      lng: 77.0595,
      isAirport: false,
    });

    const route = resolveRoute(
      { stops: [marineDrive, airport, munnar], garage: yard, tripType: "oneway" },
      1.25,
    );

    // Out to Marine Drive, home from Munnar — not twice to Marine Drive. On a
    // drop-off in the hills that difference is most of the transfer.
    const out = roadKm(marineDrive, { ...marineDrive, key: "garage", lat: yard.lat, lng: yard.lng }, 1.25);
    expect(route.transferKm).toBeGreaterThan(out * 2);
    expect(route.legs.at(-1)!.fromSlug).toBe("munnar");
  });

  it("counts the transfer once on a round trip", () => {
    const round = resolveRoute({ stops: [marineDrive, airport], garage: yard, tripType: "round" }, 1.25);
    const oneWay = resolveRoute({ stops: [marineDrive, airport], garage: yard, tripType: "oneway" }, 1.25);

    // The itinerary doubles back; the vehicle still leaves the yard once.
    expect(round.itineraryKm).toBe(oneWay.itineraryKm * 2);
    expect(round.transferKm).toBeGreaterThan(0);
  });
});

describe("an itinerary of any length (§8)", () => {
  const place = (name: string, lat: number, lng: number) =>
    fromServed({ slug: name, name, citySlug: "kochi", lat, lng, isAirport: false });

  const kottayam = place("kottayam", 9.5916, 76.5222);
  const kumarakom = place("kumarakom", 9.6177, 76.4274);
  const alappuzha = place("alappuzha", 9.4981, 76.3388);

  it("walks every stop in the order given", () => {
    const route = resolveRoute(
      { stops: [kottayam, kumarakom, alappuzha, kottayam], garage: null, tripType: "local" },
      1.25,
    );

    expect(route.legs).toHaveLength(3);
    expect(route.legs.map((leg) => leg.fromSlug)).toEqual(["kottayam", "kumarakom", "alappuzha"]);
    expect(route.km).toBe(route.legs.reduce((sum, leg) => sum + leg.km, 0));
  });

  it("changes the distance when the stops are reordered", () => {
    const one = resolveRoute(
      { stops: [kottayam, kumarakom, alappuzha], garage: null, tripType: "oneway" },
      1.25,
    );
    const other = resolveRoute(
      { stops: [kottayam, alappuzha, kumarakom], garage: null, tripType: "oneway" },
      1.25,
    );

    // A wedding day's order is a pricing input, not a presentation detail.
    expect(one.km).not.toBe(other.km);
  });

  it("prices nothing until there are two stops", () => {
    expect(resolveRoute({ stops: [kottayam], garage: null, tripType: "local" }, 1.25).km).toBe(0);
    expect(resolveRoute({ stops: [], garage: null, tripType: "local" }, 1.25).km).toBe(0);
  });
});

describe("lead references (§14)", () => {
  const noon = new Date("2026-08-21T06:30:00Z"); // noon in IST

  it("names the service, the day and the sequence", () => {
    expect(nextLeadId("wedding", noon, [])).toBe("WEDDING-260821-001");
    expect(nextLeadId("corporate", noon, [])).toBe("CORPORAT-260821-001");
    expect(nextLeadId("tour", noon, [])).toBe("TOUR-260821-001");
  });

  it("continues the day's run for that service", () => {
    const taken = ["WEDDING-260821-001", "WEDDING-260821-002", "CORPORAT-260821-001"];
    expect(nextLeadId("wedding", noon, taken)).toBe("WEDDING-260821-003");
    // A different service counts its own.
    expect(nextLeadId("corporate", noon, taken)).toBe("CORPORAT-260821-002");
  });

  it("uses the business's day, not the server's", () => {
    // 20:00 UTC on the 20th is already the 21st in Kochi, and a lead taken
    // that evening belongs to the day the staff will work it.
    expect(leadDateStamp(new Date("2026-08-20T20:00:00Z"))).toBe("260821");
  });

  it("derives a reference for a service without a fixed registry", () => {
    expect(nextLeadId("something-new", noon, [])).toBe("SOMETHIN-260821-001");
  });
});

describe("availability (§17)", () => {
  const hold = (carSlug: string, startsOn: string, endsOn: string): Availability => ({
    id: `${carSlug}-${startsOn}`,
    carSlug,
    status: "booked",
    startsOn,
    endsOn,
    note: null,
    leadId: null,
  });

  const entries = [hold("eclass", "2026-09-14", "2026-09-14"), hold("x5", "2026-09-10", "2026-09-20")];

  it("blocks a vehicle on the day it is held, and frees it the next", () => {
    expect(unavailableOn(entries, "2026-09-14").has("eclass")).toBe(true);
    expect(unavailableOn(entries, "2026-09-15").has("eclass")).toBe(false);
    // The last day is inclusive — a one-day booking blocks exactly one day.
    expect(unavailableOn(entries, "2026-09-13").has("eclass")).toBe(false);
  });

  it("blocks every day of a range", () => {
    for (const date of ["2026-09-10", "2026-09-15", "2026-09-20"]) {
      expect(unavailableOn(entries, date).has("x5")).toBe(true);
    }
    expect(unavailableOn(entries, "2026-09-21").has("x5")).toBe(false);
  });

  it("needs a clear run for a multi-day trip", () => {
    // A three-day job starting on the 12th runs into the 14th, which is taken.
    expect(freeThrough(entries, "eclass", "2026-09-12", 3)).toBe(false);
    expect(freeThrough(entries, "eclass", "2026-09-12", 2)).toBe(true);
    // A single-day job on a free day is fine.
    expect(freeThrough(entries, "eclass", "2026-09-15", 1)).toBe(true);
  });

  it("leaves an unheld vehicle alone", () => {
    expect(unavailableOn(entries, "2026-09-14").has("innova")).toBe(false);
    expect(freeThrough(entries, "innova", "2026-09-14", 5)).toBe(true);
  });
});

/**
 * The fleet list's three new questions (§17, §5, §7).
 *
 * These are what a customer actually asks — "can it come on the 14th", "what
 * will it really cost me", "which one is near me" — and each was previously
 * answered wrongly or not at all: booked cars were still offered, the budget
 * chips read a headline rate that nobody pays, and identical cars were listed
 * in seed order regardless of which yard could reach you.
 */
describe("filterCars — availability, budget and proximity", () => {
  // Two identical cars in two cities, so ranking has something to decide.
  const kochiCar: Car = { ...eclass, slug: "e-kochi", homeCitySlug: "kochi", garageSlug: null };
  const mumbaiCar: Car = { ...eclass, slug: "e-mumbai", homeCitySlug: "mumbai", garageSlug: null };

  const catalog: Catalog = {
    live: false,
    cities: [kochi, mumbai],
    locations: [],
    garages: [],
    packages: [p8],
    occasions: [casual],
    cars: [kochiCar, mumbaiCar],
    carTypes: ["Luxury sedan"],
    cityRoutes: [],
    seasons: [],
    settings: {
      whatsappNumber: "919876543210",
      phoneDisplay: "+91 98765 43210",
      email: "hello@xotic.example",
      gstPercent: 5,
      advancePercent: 25,
      circuityFactor: 1.25,
      pricingRules,
      inclusions: [],
      exclusions: [],
      whyItems: [],
      charges: [],
    },
  };

  const filters = (over: Partial<CarFilters> = {}): CarFilters => ({
    ...DEFAULT_FILTERS,
    ...over,
  });

  const slugs = (cars: Car[]) => cars.map((car) => car.slug);

  it("does not offer a vehicle that is booked on the day", () => {
    const held = new Set(["e-kochi"]);
    expect(slugs(filterCars(catalog, filters(), p8, { unavailable: held }))).toEqual(["e-mumbai"]);
  });

  it("ranks by the yard that can reach the customer, not by seed order", () => {
    // A customer in Kottayam: 60-odd km from Kochi, 1,200 from Mumbai. The
    // Mumbai car is first in no sane ordering, and it is second here.
    const kottayam = { lat: 9.5916, lng: 76.5222 };
    expect(slugs(filterCars(catalog, filters(), p8, { customer: kottayam }))).toEqual([
      "e-kochi",
      "e-mumbai",
    ]);

    // From Pune the answer flips, which is the whole point of asking.
    const pune = { lat: 18.5204, lng: 73.8567 };
    expect(slugs(filterCars(catalog, filters(), p8, { customer: pune }))).toEqual([
      "e-mumbai",
      "e-kochi",
    ]);
  });

  it("leaves an explicit sort alone", () => {
    // "Price: high to low" means price, even when we know where you are.
    const byPrice = filterCars(catalog, filters({ sort: "high" }), p8, {
      customer: { lat: 9.5916, lng: 76.5222 },
    });
    // Mumbai's multiplier is 1.15, so its car is the dearer one.
    expect(slugs(byPrice)).toEqual(["e-mumbai", "e-kochi"]);
  });

  it("budgets against the estimate, not the base rate", () => {
    // The Kochi car's base rate is ₹6,500 — comfortably "under ₹7,000". The
    // estimate is (6500 + 600 bata) × 1.05 GST = ₹7,455, and it is not.
    expect(estimatedFrom(catalog, kochiCar, p8, null)).toBe(7455);
    expect(carPrice(catalog, kochiCar, p8)).toBe(6500);

    expect(slugs(filterCars(catalog, filters({ budget: "7000" }), p8))).toEqual([]);
    expect(slugs(filterCars(catalog, filters({ budget: "10000" }), p8))).toContain("e-kochi");
  });

  it("counts the run from the yard when it knows where the customer is", () => {
    // Kottayam is far enough from Kochi that the transfer runs past the
    // package's 80 included km, and the estimate has to say so.
    const kottayam = { lat: 9.5916, lng: 76.5222 };
    const near = estimatedFrom(catalog, kochiCar, p8, null);
    const far = estimatedFrom(catalog, kochiCar, p8, kottayam);
    expect(far).toBeGreaterThan(near);

    // And the Mumbai car, 1,200 km away, is nobody's ₹30,000 car for a day.
    expect(estimatedFrom(catalog, mumbaiCar, p8, kottayam)).toBeGreaterThan(30_000);
    expect(slugs(filterCars(catalog, filters({ budget: "30000" }), p8, { customer: kottayam })))
      .toEqual(["e-kochi"]);
  });

  it("reads the band and the customer out of the query string", () => {
    const parsed = parseFilters({ budget: "15000", date: "2026-09-14", cust: "kochi-marine" });
    expect(parsed.budget).toBe("15000");
    expect(parsed.date).toBe("2026-09-14");
    expect(parsed.near).toBe("kochi-marine");
  });
});

/**
 * Peak-season rates and the charges Xotic may bill (§10).
 *
 * The season is the one piece of arithmetic here that is easy to get subtly
 * wrong — a window that wraps the year end reads backwards — and the one whose
 * mistakes are expensive in both directions: a missed peak undercharges every
 * booking in December, and a stray one overcharges a customer in June.
 */
describe("peak seasons", () => {
  const wedding: Season = {
    slug: "wedding-season",
    name: "Wedding season",
    startsOn: "11-01",
    endsOn: "02-28",
    multiplier: 1.2,
    note: "November to February",
    isActive: true,
  };

  const onam: Season = {
    slug: "onam",
    name: "Onam",
    startsOn: "08-20",
    endsOn: "09-10",
    multiplier: 1.15,
    note: "Onam fortnight",
    isActive: true,
  };

  it("covers a window that wraps the year end", () => {
    // The whole point of the wrap: December and January are one season.
    expect(seasonCovers(wedding, "2026-12-14")).toBe(true);
    expect(seasonCovers(wedding, "2027-01-20")).toBe(true);
    expect(seasonCovers(wedding, "2026-11-01")).toBe(true);
    expect(seasonCovers(wedding, "2026-02-28")).toBe(true);

    // And the months it does not cover stay uncovered.
    expect(seasonCovers(wedding, "2026-06-15")).toBe(false);
    expect(seasonCovers(wedding, "2026-03-01")).toBe(false);
  });

  it("covers a window inside one year", () => {
    expect(seasonCovers(onam, "2026-08-25")).toBe(true);
    expect(seasonCovers(onam, "2026-08-19")).toBe(false);
    expect(seasonCovers(onam, "2026-09-11")).toBe(false);
  });

  it("takes the dearer season when two overlap", () => {
    const newYear: Season = {
      ...wedding,
      slug: "new-year",
      name: "New Year",
      startsOn: "12-22",
      endsOn: "01-02",
      multiplier: 1.35,
    };
    // 27 December is inside both. The customer is quoted the peak, not the
    // gentler window that happens to be listed first.
    expect(seasonFor([wedding, newYear], "2026-12-27")?.slug).toBe("new-year");
    expect(seasonFor([newYear, wedding], "2026-12-27")?.slug).toBe("new-year");
    // And in November only the wedding season applies.
    expect(seasonFor([wedding, newYear], "2026-11-10")?.slug).toBe("wedding-season");
  });

  it("ignores a season that has been switched off", () => {
    expect(seasonFor([{ ...wedding, isActive: false }], "2026-12-14")).toBeNull();
  });

  it("multiplies the package and nothing else", () => {
    const plain = computeQuote(input({ date: "2026-06-15", seasons: [wedding] }));
    const peak = computeQuote(input({ date: "2026-12-15", seasons: [wedding] }));

    // 20% of the ₹6,500 package, and not a rupee of the ₹600 bata.
    const line = peak.lines.find((l) => l.label === "Wedding season rate");
    expect(line?.amount).toBe(1300);
    expect(peak.subtotal).toBe(plain.subtotal + 1300);

    // The bata line is identical in both — scarcity is not a cost.
    const bata = (q: typeof plain) => q.lines.find((l) => l.label.startsWith("Driver allowance"));
    expect(bata(peak)?.amount).toBe(bata(plain)?.amount);
  });

  it("adds no line at all out of season", () => {
    const quote = computeQuote(input({ date: "2026-06-15", seasons: [wedding, onam] }));
    expect(quote.lines.some((l) => /season|Onam/i.test(l.label))).toBe(false);
  });
});

describe("permits, tolls and parking", () => {
  const charges: ExtraCharge[] = [
    {
      key: "permit",
      label: "Interstate permit",
      note: "Border permit",
      amount: 1500,
      appliesTo: "interstate",
      isActive: true,
    },
    {
      key: "tolls",
      label: "Toll allowance",
      note: "Highway tolls",
      amount: 800,
      appliesTo: "outstation",
      isActive: true,
    },
    {
      key: "parking",
      label: "Parking allowance",
      note: "Venue parking",
      amount: 300,
      appliesTo: "always",
      isActive: true,
    },
  ];

  const labels = (q: ReturnType<typeof computeQuote>) => q.lines.map((l) => l.label);

  it("bills only what the trip actually incurs", () => {
    // A city day: no border, no highway. Only the always-on charge.
    const local = computeQuote(input({ charges, tripType: "local", interstate: false }));
    expect(labels(local)).toContain("Parking allowance");
    expect(labels(local)).not.toContain("Toll allowance");
    expect(labels(local)).not.toContain("Interstate permit");

    // An outstation run picks up the tolls but still no permit.
    const out = computeQuote(input({ charges, tripType: "round", interstate: false }));
    expect(labels(out)).toContain("Toll allowance");
    expect(labels(out)).not.toContain("Interstate permit");

    // Crossing a state line adds the permit on top.
    const across = computeQuote(input({ charges, tripType: "round", interstate: true }));
    expect(labels(across)).toContain("Interstate permit");
    expect(labels(across)).toContain("Toll allowance");
  });

  it("ships switched off, so the quote is unchanged until Xotic says otherwise", () => {
    const off = charges.map((charge) => ({ ...charge, isActive: false }));
    const quoted = computeQuote(input({ charges: off, tripType: "round", interstate: true }));
    const none = computeQuote(input({ tripType: "round" }));
    expect(quoted.total).toBe(none.total);
  });

  it("is taxed like everything else", () => {
    // A charge is part of the subtotal, not a pass-through added after GST —
    // an operator billing a permit is providing a service, not collecting one.
    const quote = computeQuote(input({ charges, tripType: "local" }));
    expect(quote.gst).toBe(quote.subtotal * 0.05);
  });
});

/**
 * Where a vehicle may be sent (§6).
 *
 * The list is opt-in: most of the fleet travels, and a car with no list is a
 * car with no restriction. The cases worth pinning are the two that would
 * silently offer a car nobody would actually send — and the one that would
 * silently withdraw a car from its own home city.
 */
describe("serviceable cities", () => {
  const travels: Car = { ...eclass, slug: "travels", serviceCitySlugs: [] };
  const stays: Car = {
    ...eclass,
    slug: "stays",
    homeCitySlug: "kochi",
    serviceCitySlugs: ["kochi"],
  };

  it("offers an unrestricted car anywhere", () => {
    expect(servesCity(travels, "kochi")).toBe(true);
    expect(servesCity(travels, "mumbai")).toBe(true);
  });

  it("keeps a restricted car to its list", () => {
    expect(servesCity(stays, "kochi")).toBe(true);
    expect(servesCity(stays, "mumbai")).toBe(false);
  });

  it("never withdraws a car from its own home city", () => {
    // A list that leaves out the yard the car sleeps in is a typo, not a
    // policy, and it should not take the car off its own city page.
    const misconfigured: Car = { ...stays, serviceCitySlugs: ["mumbai"] };
    expect(servesCity(misconfigured, "kochi")).toBe(true);
  });

  it("asks nothing when no city is in play", () => {
    expect(servesCity(stays, "")).toBe(true);
  });

  it("drops a restricted car from another city's fleet list", () => {
    const catalog: Catalog = {
      live: false,
      cities: [kochi, mumbai],
      locations: [],
      garages: [],
      packages: [p8],
      occasions: [casual],
      cars: [travels, stays],
      carTypes: ["Luxury sedan"],
      cityRoutes: [],
      seasons: [],
      settings: {
        whatsappNumber: "919876543210",
        phoneDisplay: "+91 98765 43210",
        email: "hello@xotic.example",
        gstPercent: 5,
        advancePercent: 25,
        circuityFactor: 1.25,
        pricingRules,
        inclusions: [],
        exclusions: [],
        whyItems: [],
        charges: [],
      },
    };

    const filters = { ...DEFAULT_FILTERS };
    const slugs = (cars: Car[]) => cars.map((car) => car.slug);

    expect(slugs(filterCars(catalog, filters, p8, { wantedCity: "kochi" }))).toEqual([
      "travels",
      "stays",
    ]);
    expect(slugs(filterCars(catalog, filters, p8, { wantedCity: "mumbai" }))).toEqual(["travels"]);
  });
});
