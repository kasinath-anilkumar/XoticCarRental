/**
 * Domain types for Xotic Car Rental.
 *
 * These mirror the prototype's data model (design/project/Xotic Car Rental.dc.html,
 * the `class Component extends DCLogic` block) but in the shape the Supabase
 * schema stores it. The pricing engine consumes these and nothing else, so it
 * stays pure and testable without a database.
 */

/** Which of a car's three package rates a package draws from. */
export type RateKey = "rate_8h" | "rate_12h" | "rate_full";

/** Prototype's `q.trip`. */
export type TripType = "local" | "oneway" | "round";

export interface City {
  slug: string;
  name: string;
  state: string;
  /** Rate multiplier applied to every package base. Kochi 1.0, Bengaluru 1.05. */
  multiplier: number;
  /** Marketing headline count ("350 cars"), not a live inventory number. */
  carCount: number;
  lat: number;
  lng: number;
  heroImage: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

/**
 * Where a vehicle is based.
 *
 * Internal (§9): it is a pricing input, never rendered. A quote shows the
 * transfer distance it produces, not the yard it belongs to.
 */
export interface Garage {
  slug: string;
  name: string;
  citySlug: string;
  lat: number;
  lng: number;
}

export interface LocationPoint {
  slug: string;
  name: string;
  citySlug: string;
  lat: number;
  lng: number;
  isAirport: boolean;
}

export interface Package {
  slug: string;
  /** "8 hrs / 80 km" */
  label: string;
  hours: number;
  km: number;
  rateKey: RateKey;
  /** "Half day in the city" */
  sub: string;
  /** Phosphor icon name, e.g. "ph-clock". */
  icon: string;
}

export interface CarImage {
  url: string;
  kind: "hero" | "interior" | "rear" | "detail";
  alt: string | null;
}

export interface Car {
  slug: string;
  name: string;
  year: number;
  /** "Luxury sedan", "MUV", … — also the Browse "Car type" facet. */
  type: string;
  seats: number;
  transmission: string;
  fuel: string;
  /** City whose multiplier prices this car. */
  homeCitySlug: string;
  /**
   * The yard this unit runs out of. Null falls back to the home city centre,
   * which is what an un-garaged vehicle used to be priced from.
   */
  garageSlug: string | null;
  /**
   * Where this vehicle may be sent (§6). Empty means anywhere Xotic serves,
   * which is the honest default — most of the fleet travels. A list is for
   * the cars that do not: a vintage car that is not driven between states, a
   * signature car kept for one city.
   */
  serviceCitySlugs: string[];
  rating: string;
  badge: string;
  rate8h: number;
  rate12h: number;
  rateFull: number;
  /** ₹ per km past the package allowance. */
  extraKmRate: number;
  /** ₹ per hour past the package allowance. */
  extraHrRate: number;
  /** Driver's daily food-and-stay allowance. */
  bata: number;
  nightCharge: number;
  /** Occasion slugs this car is curated for. */
  occasions: string[];
  images: CarImage[];
}

export interface OccasionPackage {
  name: string;
  detail: string;
  /** Pre-formatted, e.g. "₹11,400" — these are indicative "from" prices. */
  price: string;
  unit: string;
}

export interface OccasionInclude {
  title: string;
  detail: string;
}

export interface Occasion {
  slug: string;
  name: string;
  icon: string;
  tagline: string;
  /** Flat handling fee added to a quote for this occasion. 0 for most. */
  surcharge: number;
  /** Line-item note shown beside the surcharge in a quote. */
  handlingNote: string;
  kicker: string;
  title: string;
  blurb: string;
  h2: string;
  fleetTitle: string;
  ctaTitle: string;
  note: string;
  heroImage: string | null;
  includes: OccasionInclude[];
  packages: OccasionPackage[];
}

export interface CityRoute {
  citySlug: string;
  fromSlug: string;
  toSlug: string;
  /** Set to publish an exact road distance instead of the estimate. */
  kmOverride: number | null;
}

export interface WhyItem {
  icon: string;
  title: string;
  body: string;
}

export interface SiteSettings {
  pricingRules: PricingRules;
  /** Digits only, country code first — "919876543210". */
  whatsappNumber: string;
  phoneDisplay: string;
  email: string;
  gstPercent: number;
  advancePercent: number;
  /**
   * Road distance ÷ straight-line distance. Haversine underestimates Indian
   * road distance by roughly a quarter; see lib/distance.ts.
   */
  circuityFactor: number;
  inclusions: string[];
  exclusions: string[];
  whyItems: WhyItem[];
  /**
   * Permits, parking and tolls, where Xotic bills them rather than passing
   * them through at actuals (§10). Shipped inactive; the admin turns them on.
   */
  charges: ExtraCharge[];
}

/** One row of the itemised quote. */
export interface QuoteLine {
  label: string;
  note: string;
  amount: number;
}

export interface QuoteLeg {
  fromSlug: string;
  toSlug: string;
  km: number;
}

/**
 * The trip as the customer described it — everything the calculator collects.
 *
 * `from` / `to` / `returnTo` are PLACE TOKENS, not location slugs: either one
 * of our curated pickup points by slug, or anywhere in India encoded as
 * `@lat,lng,name`. See lib/places.ts.
 */
export interface TripRequest {
  carSlug: string;
  packageSlug: string;
  tripType: TripType;
  /**
   * Where the CUSTOMER is — their city or area, not where the car is wanted.
   *
   * A separate field on purpose (§3, §28): it decides which vehicles are near
   * enough to offer, and it is frequently nowhere near the pickup. A Kottayam
   * customer books a Kumarakom wedding with a car from the Kochi yard, and
   * every one of those three places matters to a different part of the answer.
   *
   * Empty is allowed: the estimate does not need it, the matching does.
   */
  customerPlace: string;
  /**
   * The itinerary in visiting order: pickup first, then each event stop, then
   * the final drop (§8). Two entries is the shortest real trip; there is no
   * upper bound, because a wedding day routinely has four.
   */
  stops: string[];
  /** YYYY-MM-DD */
  date: string;
  /** Last rental date, inclusive. Blank means derive duration from the itinerary. */
  returnDate?: string;
  /** HH:MM, 24-hour */
  time: string;
  occasionSlug: string;
  haltHours: number;
}

/** What the pricing engine needs, with entities already resolved. */
/**
 * A recurring peak window (§10). Dates are MM-DD and may wrap the year end.
 */
export interface Season {
  slug: string;
  name: string;
  /** MM-DD, inclusive. */
  startsOn: string;
  /** MM-DD, inclusive. A value below `startsOn` wraps past 31 December. */
  endsOn: string;
  /** Applied to the package base. 1.25 is "a quarter more in season". */
  multiplier: number;
  /** Why, in the customer's words — it goes on the quote line. */
  note: string;
  isActive: boolean;
}

/**
 * A charge Xotic may add to a quote (§10): a state permit, a parking
 * allowance, a toll float.
 *
 * They are configuration rather than code because which of them applies is a
 * commercial decision that changes by state and by season, and because the
 * honest default for most operators — "at actuals, paid directly" — means
 * shipping them switched off rather than not shipping them at all.
 */
export interface ExtraCharge {
  key: string;
  label: string;
  note: string;
  amount: number;
  /**
   * always      every trip
   * outstation  one-way and round trips that leave the city
   * interstate  trips whose stops are known to span two states
   */
  appliesTo: "always" | "outstation" | "interstate";
  isActive: boolean;
}

export interface PricingInput {
  pricingRules: PricingRules;
  car: Car;
  pkg: Package;
  city: City;
  occasion: Occasion;
  tripType: TripType;
  /** Total route distance in km, already road-adjusted. */
  km: number;
  haltHours: number;
  /** HH:MM, 24-hour — decides the night charge. */
  time: string;
  gstPercent: number;
  advancePercent: number;
  /** The pickup date, YYYY-MM-DD — decides the peak-season rate (§10). */
  date?: string;
  returnDate?: string;
  /** Recurring peak windows. Empty means no seasonal pricing. */
  seasons?: Season[];
  /** Permits, parking and tolls, where Xotic bills them (§10). */
  charges?: ExtraCharge[];
  /** True when the route is known to cross a state line. */
  interstate?: boolean;
}

export interface PricingRules {
  minimumLegKm: number;
  localSpeedKph: number;
  outstationSpeedKph: number;
  oneWayReturnPercent: number;
  nightStartHour: number;
  nightEndHour: number;
}

export interface Quote {
  km: number;
  /** Billable hours, rounded up to the half hour. */
  hours: number;
  days: number;
  /** Package km allowance across all days. */
  includedKm: number;
  /** Package hour allowance across all days. */
  includedHours: number;
  lines: QuoteLine[];
  subtotal: number;
  gst: number;
  total: number;
  /** Rounded to the nearest ₹100. */
  advance: number;
  outstation: boolean;
  /** True when pickup falls between 22:00 and 05:59. */
  nightStart: boolean;
}
