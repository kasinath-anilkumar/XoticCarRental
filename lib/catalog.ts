/**
 * Selectors over the catalog.
 *
 * Pure functions, no I/O — they take the loaded catalog and answer the
 * questions the screens ask. The lookups fall back to the first row rather
 * than throwing, matching the prototype: a stale bookmark with an unknown car
 * slug should show *a* car, not a 500.
 */

import { cityRouteKm } from "./distance";
import { fromServed } from "./places";
import { rateFor } from "./pricing";
import { isISODate } from "./dates";
import type { Car, City, LocationPoint, Occasion, Package, TripRequest } from "./types";
import { haversineKm } from "./distance";
import type { Catalog } from "./content";

// Re-exported so screens can import the catalog type from one place.
export type { Catalog } from "./content";

export function carBySlug(catalog: Catalog, slug: string | undefined): Car {
  return catalog.cars.find((c) => c.slug === slug) ?? catalog.cars[0];
}

export function cityBySlug(catalog: Catalog, slug: string | undefined): City {
  return catalog.cities.find((c) => c.slug === slug) ?? catalog.cities[0];
}

export function packageBySlug(catalog: Catalog, slug: string | undefined): Package {
  return catalog.packages.find((p) => p.slug === slug) ?? catalog.packages[0];
}

export function occasionBySlug(catalog: Catalog, slug: string | undefined): Occasion {
  return catalog.occasions.find((o) => o.slug === slug) ?? catalog.occasions[0];
}

/** Locations can legitimately be absent (an empty "return drop"). */
export function locationBySlug(
  catalog: Catalog,
  slug: string | null | undefined,
): LocationPoint | null {
  if (!slug) return null;
  return catalog.locations.find((l) => l.slug === slug) ?? null;
}

export function locationBySlugOrFirst(catalog: Catalog, slug: string | undefined): LocationPoint {
  return catalog.locations.find((l) => l.slug === slug) ?? catalog.locations[0];
}

/** The city whose multiplier prices this car. */
/**
 * Where a car is based, as a point to price from.
 *
 * Falls back to the home city's centre for a vehicle with no garage recorded —
 * an estimate from the middle of the city is wrong by a few kilometres, which
 * beats pretending the transfer legs do not exist.
 */
/** The states we serve, in the order the cities are listed. */
export function statesOf(catalog: Catalog): string[] {
  return [...new Set(catalog.cities.map((city) => city.state))];
}

/**
 * May this vehicle be sent to this city? (§6)
 *
 * An empty list means yes — the restriction is opt-in, so adding the field
 * changed nothing for the fleet that was already travelling anywhere. A car's
 * own home city is always allowed, because a list that excluded the yard the
 * car sleeps in would be a data-entry mistake rather than a policy.
 */
export function servesCity(car: Car, citySlug: string): boolean {
  if (!citySlug) return true;
  if (car.serviceCitySlugs.length === 0) return true;
  return car.homeCitySlug === citySlug || car.serviceCitySlugs.includes(citySlug);
}

export function garagePoint(catalog: Catalog, car: Car): { lat: number; lng: number } | null {
  const garage = catalog.garages.find((g) => g.slug === car.garageSlug);
  if (garage) return { lat: garage.lat, lng: garage.lng };
  const city = catalog.cities.find((c) => c.slug === car.homeCitySlug);
  return city ? { lat: city.lat, lng: city.lng } : null;
}

export function homeCity(catalog: Catalog, car: Car): City {
  return cityBySlug(catalog, car.homeCitySlug);
}

/** Headline price: this car, on this package, at its home city's rate. */
export function carPrice(catalog: Catalog, car: Car, pkg: Package): number {
  return rateFor(car, pkg.rateKey) * homeCity(catalog, car).multiplier;
}

export function heroImage(car: Car): string | null {
  return car.images.find((i) => i.kind === "hero")?.url ?? car.images[0]?.url ?? null;
}

export function galleryImages(car: Car): Array<{ url: string | null; label: string }> {
  const find = (kind: Car["images"][number]["kind"], label: string) => ({
    url: car.images.find((i) => i.kind === kind)?.url ?? null,
    label,
  });
  return [find("interior", "Interior"), find("rear", "Rear"), find("detail", "Detail")];
}

// ── browse filters ──────────────────────────────────────────────────────────

export type SortKey = "popular" | "low" | "high";

export interface CarFilters {
  city: string;
  type: string;
  occasion: string;
  seats: string;
  sort: SortKey;
  /** YYYY-MM-DD. Vehicles held on this date are not offered (§17). */
  date: string;
  /** A ceiling on the ESTIMATED trip rate, not the base rate (§5). */
  budget: string;
  /** Where the customer is, as a place token — used to rank by yard (§7). */
  near: string;
  /** Kerala, Karnataka or Tamil Nadu — the step above city (§3). */
  state: string;
}

export const DEFAULT_FILTERS: CarFilters = {
  city: "all",
  type: "all",
  occasion: "all",
  seats: "all",
  sort: "popular",
  date: "",
  budget: "all",
  near: "",
  state: "all",
};

/** Only filter labels and counts cross the browse page's client boundary. */
export interface BrowseFilterOptions {
  cities: Array<Pick<City, "slug" | "name" | "state"> & { carCount: number }>;
  carTypes: Array<{ name: string; count: number }>;
  carCount: number;
}

export function browseFilterOptions(catalog: Catalog): BrowseFilterOptions {
  const cityCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  for (const car of catalog.cars) {
    cityCounts.set(car.homeCitySlug, (cityCounts.get(car.homeCitySlug) ?? 0) + 1);
    typeCounts.set(car.type, (typeCounts.get(car.type) ?? 0) + 1);
  }
  return {
    cities: catalog.cities.map(({ slug, name, state }) => ({ slug, name, state, carCount: cityCounts.get(slug) ?? 0 })),
    carTypes: [...typeCounts].map(([name, count]) => ({ name, count })),
    carCount: catalog.cars.length,
  };
}

/** Input bound, not a suggested budget or a configured vehicle price. */
export const MAX_BUDGET_AMOUNT = 100_000_000;

/** Positive rupee amounts, including paise. Old amount+ links retain their floor. */
export function parseBudget(value: string | undefined): string {
  const raw = value?.trim() ?? "";
  if (!raw || raw === "all" || raw.length > 32) return "all";
  const match = /^(\d+(?:\.\d{1,2})?)(\+)?$/.exec(raw);
  if (!match) return "all";
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_BUDGET_AMOUNT) return "all";
  return `${amount}${match[2] ?? ""}`;
}

export function budgetLabel(value: string): string {
  const budget = parseBudget(value);
  if (budget === "all") return "Any budget";
  const floor = budget.endsWith("+");
  const amount = Number(floor ? budget.slice(0, -1) : budget);
  return `${floor ? "At least" : "Up to"} ₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Invalid dates must never reach availability queries or date arithmetic. */
export function parseBrowseDate(value: string | undefined): string {
  return value && isISODate(value) ? value : "";
}

export function parseFilters(params: Record<string, string | string[] | undefined>): CarFilters {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const sort = one("sort");
  return {
    city: one("city") ?? "all",
    type: one("type") ?? "all",
    occasion: one("occasion") ?? "all",
    seats: one("seats") ?? "all",
    sort: sort === "low" || sort === "high" ? sort : "popular",
    date: parseBrowseDate(one("date")),
    budget: parseBudget(one("budget")),
    near: one("cust") ?? one("from") ?? "",
    state: one("state") ?? "all",
  };
}

/**
 * What this car would realistically cost, before a route is known.
 *
 * §5 is explicit that a budget filter must work on "the estimated applicable
 * trip rate, not merely the vehicle's base rate" — a car whose base rate is
 * ₹9,000 is not an "under ₹10,000" car once the driver's allowance, the tax
 * and the run from its yard are counted.
 *
 * So this is the floor of a real invoice: the package at the city's multiplier,
 * the bata, the transfer legs when we know where the customer is, and GST. It
 * is deliberately a *minimum* — the trip itself adds more — because a filter
 * that hides affordable cars is worse than one that shows a few too many.
 */
export function estimatedFrom(
  catalog: Catalog,
  car: Car,
  pkg: Package,
  customer: { lat: number; lng: number } | null,
): number {
  const base = carPrice(catalog, car, pkg);
  const bata = car.bata;

  let transfer = 0;
  const yard = garagePoint(catalog, car);
  if (yard && customer) {
    const km = Math.round(
      haversineKm({ lat: yard.lat, lng: yard.lng }, customer) * catalog.settings.circuityFactor,
    );
    // Out and back, and only the part past what the package already covers.
    const chargeable = Math.max(0, km * 2 - pkg.km);
    transfer = chargeable * car.extraKmRate;
  }

  const subtotal = base + bata + transfer;
  return Math.round(subtotal * (1 + catalog.settings.gstPercent / 100));
}

/** Seat buckets, matching the design's "Up to 4 / 5–7 / 8+" chips. */
function matchesSeats(car: Car, bucket: string): boolean {
  if (bucket === "all") return true;
  if (bucket === "4") return car.seats <= 4;
  if (bucket === "7") return car.seats >= 5 && car.seats <= 7;
  return car.seats > 7;
}

export interface FilterContext {
  /** Vehicles held on the requested date (§17). */
  unavailable?: Set<string>;
  /** Where the customer is, for proximity ranking (§7). */
  customer?: { lat: number; lng: number } | null;
  /** The city the trip is for — vehicles that do not serve it drop out (§6). */
  wantedCity?: string;
}

function withinBudget(estimate: number, budget: string): boolean {
  const parsed = parseBudget(budget);
  if (parsed === "all") return true;
  return parsed.endsWith("+")
    ? estimate >= Number(parsed.slice(0, -1))
    : estimate <= Number(parsed);
}

export function filterCars(
  catalog: Catalog,
  filters: CarFilters,
  pkg: Package,
  context: FilterContext = {},
): Car[] {
  const customer = context.customer ?? null;

  // §3 — the state narrows the city list, and on its own narrows the fleet.
  const citiesInState =
    filters.state === "all"
      ? null
      : new Set(
          catalog.cities
            .filter((city) => city.state === filters.state)
            .map((city) => city.slug),
        );

  const filtered = catalog.cars.filter(
    (car) =>
      (filters.city === "all" || car.homeCitySlug === filters.city) &&
      (citiesInState === null || citiesInState.has(car.homeCitySlug)) &&
      // §6 — a vehicle that does not travel to where the customer is asking
      // from is not a vehicle to offer them.
      (!context.wantedCity || servesCity(car, context.wantedCity)) &&
      (filters.type === "all" || car.type === filters.type) &&
      (filters.occasion === "all" || car.occasions.includes(filters.occasion)) &&
      matchesSeats(car, filters.seats) &&
      // A vehicle that is booked, held or in the workshop on the day is not a
      // vehicle you can offer for it.
      !context.unavailable?.has(car.slug) &&
      withinBudget(estimatedFrom(catalog, car, pkg, customer), filters.budget),
  );

  /**
   * Nearest first, when we know where the customer is (§7).
   *
   * The brief's own example: S-Class vehicles in Kochi and Trivandrum, a
   * customer in Kottayam — the answer is the nearer one, not the first one in
   * the list. Only the default order is re-sorted this way; asking for "price
   * low" means price low.
   */
  if (customer && filters.sort === "popular") {
    return [...filtered].sort((a, b) => {
      const distance = (car: Car) => {
        const yard = garagePoint(catalog, car);
        return yard ? haversineKm(yard, customer) : Number.POSITIVE_INFINITY;
      };
      return distance(a) - distance(b);
    });
  }

  if (filters.sort === "low" || filters.sort === "high") {
    // Sort on the price the card actually prints — the rate at the car's home
    // city multiplier. Sorting the raw rate instead put a ₹6,500 Mumbai car
    // (shown as ₹7,475) level with a ₹6,500 Kochi one, so "price: low to high"
    // listed them in an order the visible numbers contradicted.
    const direction = filters.sort === "low" ? 1 : -1;
    return [...filtered].sort(
      (a, b) => direction * (carPrice(catalog, a, pkg) - carPrice(catalog, b, pkg)),
    );
  }
  return filtered;
}

// ── curated sets ────────────────────────────────────────────────────────────

export function featuredCars(catalog: Catalog, count = 4): Car[] {
  return catalog.cars.slice(0, count);
}

/** Same body type, or shares an occasion. */
export function similarCars(catalog: Catalog, car: Car, count = 3): Car[] {
  return catalog.cars
    .filter(
      (other) =>
        other.slug !== car.slug &&
        (other.type === car.type || other.occasions.some((o) => car.occasions.includes(o))),
    )
    .slice(0, count);
}

/**
 * Cars for an occasion page. "Outstation & tours" has no curated tagging in the
 * seed content, so it shows the whole fleet rather than an empty grid.
 */
export function carsForOccasion(catalog: Catalog, occasion: Occasion, count = 4): Car[] {
  const tagged = catalog.cars.filter((car) => car.occasions.includes(occasion.slug));
  return (tagged.length > 0 ? tagged : catalog.cars).slice(0, count);
}

/** City's own cars first, then the rest of the fleet. */
export function carsForCity(catalog: Catalog, city: City, count = 4): Car[] {
  const local = catalog.cars.filter((car) => car.homeCitySlug === city.slug);
  const rest = catalog.cars.filter((car) => car.homeCitySlug !== city.slug);
  return [...local, ...rest].slice(0, count);
}

// ── city fares ──────────────────────────────────────────────────────────────

export interface CityRouteFare {
  name: string;
  fromSlug: string;
  toSlug: string;
  km: number;
  /** Realistic drive time, phrased for a human: "about 3 hr". */
  driveTime: string;
  packageLabel: string;
  packageSlug: string;
  /** Cheapest sedan-ish car based here. */
  price: number;
  /** Cheapest 5+ seater based here, when there is one. */
  priceLarge: number | null;
}

function driveTimeLabel(km: number, speedKph: number): string {
  const hours = Math.max(0.5, Math.round((km / speedKph) * 2) / 2);
  if (hours < 1) return "about 30 min";
  if (Number.isInteger(hours)) return `about ${hours} hr`;
  return `about ${Math.floor(hours)}½ hr`;
}

/**
 * The "fares people ask for most" table.
 *
 * Indicative, not a quote: the cheapest car based in that city, on the package
 * the distance calls for, assuming a there-and-back run, plus the driver's bata
 * and GST. The real number comes from the calculator.
 */
export function cityRouteFares(catalog: Catalog, city: City): CityRouteFare[] {
  const routes = catalog.cityRoutes.filter((r) => r.citySlug === city.slug);
  if (routes.length === 0) return [];

  const localCars = catalog.cars.filter((car) => car.homeCitySlug === city.slug);
  const pool = localCars.length > 0 ? localCars : catalog.cars;
  const cheapest = [...pool].sort((a, b) => a.rate8h - b.rate8h)[0];
  // A second column for anyone travelling as a family — the cheapest car here
  // that seats five or more. Null when the city has nothing bigger.
  const larger = [...pool].filter((c) => c.seats >= 5).sort((a, b) => a.rate8h - b.rate8h)[0];
  if (!cheapest) return [];

  const gstMultiplier = 1 + catalog.settings.gstPercent / 100;

  return routes.flatMap((route) => {
    const from = locationBySlug(catalog, route.fromSlug);
    const to = locationBySlug(catalog, route.toSlug);
    if (!from || !to) return [];

    const km = cityRouteKm(route, fromServed(from), fromServed(to), catalog.settings.circuityFactor, catalog.settings.pricingRules.minimumLegKm);
    const best = cheapestPackageFare(catalog, cheapest, city.multiplier, km, gstMultiplier);
    if (!best) return [];

    const bestLarge =
      larger && larger.slug !== cheapest.slug
        ? cheapestPackageFare(catalog, larger, city.multiplier, km, gstMultiplier)
        : null;

    return [
      {
        name: `${shortName(from.name)} → ${shortName(to.name)}`,
        fromSlug: route.fromSlug,
        toSlug: route.toSlug,
        km,
        driveTime: driveTimeLabel(km, catalog.settings.pricingRules.outstationSpeedKph),
        packageLabel: best.pkg.label,
        packageSlug: best.pkg.slug,
        price: best.price,
        priceLarge: bestLarge ? bestLarge.price : null,
      },
    ];
  });
}

/** The cars actually based in a city, cheapest first. */
export function carsBasedIn(catalog: Catalog, city: City): Car[] {
  return catalog.cars
    .filter((car) => car.homeCitySlug === city.slug)
    .sort((a, b) => a.rate8h - b.rate8h);
}

/** The lowest all-in headline for a city, for its hero and the index table. */
export function cityFromPrice(catalog: Catalog, city: City): number | null {
  const local = carsBasedIn(catalog, city);
  const pool = local.length > 0 ? local : catalog.cars;
  const cheapest = pool[0];
  if (!cheapest) return null;
  const base = rateFor(cheapest, catalog.packages[0].rateKey) * city.multiplier;
  return (base + cheapest.bata) * (1 + catalog.settings.gstPercent / 100);
}

export function airportFor(catalog: Catalog, city: City): LocationPoint | null {
  return catalog.locations.find((l) => l.citySlug === city.slug && l.isAirport) ?? null;
}

export function pickupPointsIn(catalog: Catalog, city: City): LocationPoint[] {
  return catalog.locations.filter((l) => l.citySlug === city.slug);
}

/**
 * The cheapest package for a round trip of this distance.
 *
 * The prototype picked by a fixed distance ladder (over 130 km → full day),
 * which made the published table non-monotonic: Thekkady at 160 km quoted less
 * than Munnar at 130 km, because the longer trip crossed into a package whose
 * bigger allowance swallowed the extra-km charge. A "from" price that falls as
 * the distance rises reads as a broken table, so this prices every package and
 * takes the lowest — which is the one we would actually sell.
 */
function cheapestPackageFare(
  catalog: Catalog,
  car: Car,
  cityMultiplier: number,
  km: number,
  gstMultiplier: number,
): { pkg: Package; price: number } | null {
  let best: { pkg: Package; price: number } | null = null;

  for (const pkg of catalog.packages) {
    const base = rateFor(car, pkg.rateKey) * cityMultiplier;
    // Round trip: the allowance has to cover both directions.
    const extra = Math.max(0, km * 2 - pkg.km) * car.extraKmRate;
    const price = (base + extra + car.bata) * gstMultiplier;
    if (!best || price < best.price) best = { pkg, price };
  }

  return best;
}

function shortName(name: string): string {
  return name.split(",")[0].split(" (")[0];
}

// ── calculator defaults ─────────────────────────────────────────────────────

export type TripDefaults = TripRequest;

/**
 * Start with published pricing choices, but never invent a pickup or schedule.
 * An explicitly supplied date is preserved for callers restoring a saved trip.
 */
export function tripDefaults(catalog: Catalog, tomorrow: string): TripDefaults {
  return {
    carSlug: catalog.cars[0]?.slug ?? "",
    packageSlug: catalog.packages[0]?.slug ?? "",
    tripType: "local",
    // The customer's own location starts empty: it is theirs to give, and the
    // estimate does not need it.
    customerPlace: "",
    stops: ["", ""],
    date: tomorrow,
    time: "",
    occasionSlug:
      catalog.occasions.find((o) => o.surcharge === 0)?.slug ?? catalog.occasions[0]?.slug ?? "",
    haltHours: 0,
  };
}

/** "2026-08-19" + 1 day, without pulling in a date library. */
export function isoTomorrow(now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return date.toISOString().slice(0, 10);
}
