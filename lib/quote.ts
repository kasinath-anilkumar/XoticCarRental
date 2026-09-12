/**
 * Turns a trip request into a quote.
 *
 * The one place that wires the catalog, the distance model and the pricing
 * engine together, so the home page's preview, the calculator, the booking
 * summary and the server-side recompute in the enquiry route all produce
 * identical numbers from identical inputs.
 */

import {
  carBySlug,
  garagePoint,
  homeCity,
  occasionBySlug,
  packageBySlug,
  type Catalog,
} from "./catalog";
import { resolvePlace, type ResolvedPlace } from "./places";
import { buildKmOverrides, buildRoutedOverrides, resolveRoute, type RouteLeg } from "./distance";
import { computeQuote } from "./pricing";
import { CatalogPricingUnavailableError, isPricingAvailable } from "./catalog-readiness";
import { isISODate, isTime } from "./dates";
import { MAX_TRIP_STOPS } from "./trip-limits";
import { GENERAL_ENQUIRY_MESSAGE, quoteMessage, whatsappLink } from "./whatsapp";
import type { RoutedTrip } from "./route/types";
import type { Car, City, Occasion, Package, Quote, TripRequest } from "./types";

export { CatalogPricingUnavailableError } from "./catalog-readiness";

export interface ResolvedQuote {
  quote: Quote;
  car: Car;
  pkg: Package;
  city: City;
  occasion: Occasion;
  /** Where the customer is, when they have said. Never part of the route. */
  customer: ResolvedPlace | null;
  /** The itinerary in visiting order. Empty until a pickup is chosen. */
  stops: ResolvedPlace[];
  /** First and last of the itinerary — the two every summary line needs. */
  from: ResolvedPlace | null;
  to: ResolvedPlace | null;
  /** Two or more stops, so there is a route to price. */
  complete: boolean;
  legs: RouteLeg[];
  /** What the customer travels, and what the vehicle drives empty (§9). */
  itineraryKm: number;
  transferKm: number;
  /** Driving time from the router, when there was one. Not billable hours. */
  drivingMinutes: number | null;
  /** True when the kilometres came from a router rather than an estimate. */
  routed: boolean;
  trip: TripRequest;
  /** The itemised message handed to WhatsApp. */
  message: string;
  whatsappHref: string;
}

/**
 * The stops of a trip, in visiting order — only the ones that resolve.
 *
 * An empty field is an empty field. This used to fall back to the first pickup
 * point in the catalog, which meant clearing the pickup silently moved the trip
 * to Marine Drive, Kochi: the map dropped a pin there, the quote priced a
 * journey from there, and nothing on the screen said so. A quote for a trip
 * nobody asked for is worse than no quote.
 *
 * Split out because routing has to happen *before* the quote — a caller
 * resolves the stops, asks `lib/route` for the drive, and hands the answer
 * back in. Resolving twice is free: it is a lookup in an array of 33.
 */
export function tripStops(catalog: Catalog, trip: TripRequest): ResolvedPlace[] {
  const stops: ResolvedPlace[] = [];

  // The leading run, and no further. Every consumer reads these by position —
  // the map's numbered pins, the summary's rows, the router's legs — so a gap
  // ends the itinerary rather than closing over itself. A drop with no pickup
  // is not "one stop", it is a journey nobody has described yet.
  for (const token of trip.stops) {
    const place = resolvePlace(token, catalog.locations);
    if (!place) break;
    stops.push(place);
  }

  return stops;
}

/**
 * @param routed The driven route for this exact trip, when one could be had.
 *   Its per-leg distances replace the estimate; a published route fare still
 *   beats both, because somebody measured that one on purpose.
 */
/**
 * Does this route leave its home state?
 *
 * Only our own pickup points carry a city, and only a city carries a state.
 * A place dropped anywhere in India by coordinates is unknown, and unknown
 * counts as no — a permit charge on a trip that never crossed a border is a
 * worse mistake than one missed on a trip that did, which staff will catch
 * when they confirm the quote.
 */
function crossesStates(catalog: Catalog, stops: ResolvedPlace[]): boolean {
  const states = new Set<string>();
  for (const stop of stops) {
    const city = catalog.cities.find((item) => item.slug === stop.citySlug);
    if (city) states.add(city.state);
  }
  return states.size > 1;
}

export function resolveQuote(
  catalog: Catalog,
  trip: TripRequest,
  routed?: RoutedTrip | null,
): ResolvedQuote {
  if (!isPricingAvailable(catalog)) throw new CatalogPricingUnavailableError();

  const car = carBySlug(catalog, trip.carSlug);
  const pkg = packageBySlug(catalog, trip.packageSlug);
  const occasion = occasionBySlug(catalog, trip.occasionSlug);
  const city = homeCity(catalog, car);

  // A place token is either one of our pickup points, or anywhere in India by
  // coordinates. Anything else — an empty field, a token from a link that no
  // longer resolves — is nothing, and stays nothing.
  const stops = tripStops(catalog, trip);
  const from = stops[0] ?? null;
  const to = stops.length > 1 ? stops[stops.length - 1]! : null;
  // The customer's own location never joins the route. It is asked for so the
  // fleet can be matched to them (§7) and so staff know where they are.
  const customer = resolvePlace(trip.customerPlace, catalog.locations);

  const published = buildKmOverrides(catalog.cityRoutes);
  // Spread order is the precedence: the router fills in, the published table
  // overwrites it where it has something to say.
  const measured = routed?.legs.length
    ? new Map([...buildRoutedOverrides(stops, routed.legs), ...published])
    : published;

  // Fewer than two stops is no distance. The package still has a price, and
  // the panel still shows it, but nothing pretends to know the route.
  const route = resolveRoute(
    { stops, garage: garagePoint(catalog, car), tripType: trip.tripType },
    catalog.settings.circuityFactor,
    measured,
  );

  const quote = computeQuote({
    car,
    pkg,
    city,
    occasion,
    tripType: trip.tripType,
    km: route.km,
    haltHours: trip.haltHours,
    time: trip.time,
    gstPercent: catalog.settings.gstPercent,
    advancePercent: catalog.settings.advancePercent,
    date: trip.date,
    seasons: catalog.seasons,
    charges: catalog.settings.charges,
    interstate: crossesStates(catalog, stops),
  });

  // An itemised message needs a route to itemise. Without one, the WhatsApp
  // link is the general enquiry — the button that would send it is disabled
  // anyway, and a half-written quote is not a thing to hand an operator.
  const message =
    from && to
      ? quoteMessage({
          quote,
          car,
          pkg,
          occasion,
          tripType: trip.tripType,
          stops,
          customer,
          date: trip.date,
          time: trip.time,
          gstPercent: catalog.settings.gstPercent,
        })
      : GENERAL_ENQUIRY_MESSAGE;

  return {
    quote,
    car,
    pkg,
    city,
    occasion,
    customer,
    stops,
    from,
    to,
    complete: stops.length > 1,
    legs: route.legs,
    itineraryKm: route.itineraryKm,
    transferKm: route.transferKm,
    drivingMinutes: routed?.minutes ?? null,
    routed: Boolean(routed?.legs.length),
    trip,
    message,
    whatsappHref: whatsappLink(catalog.settings.whatsappNumber, message),
  };
}

/**
 * Reads a trip out of URL search params, falling back to the supplied
 * defaults. Quotes are shareable links, so the calculator's whole state lives
 * in the query string.
 */
export function tripFromParams(
  params: Record<string, string | string[] | undefined>,
  defaults: TripRequest,
): TripRequest {
  const one = (key: string): string | undefined => {
    const value = params[key];
    const result = Array.isArray(value) ? value[0] : value;
    return result === undefined || result === "" ? undefined : result;
  };

  const tripType = one("trip");
  const halt = Number(one("halt"));

  /**
   * The itinerary rides in one parameter: `stops=a~b~c`.
   *
   * Tilde because a place token can contain commas — `@10.09,77.06,Munnar` —
   * and a comma-separated list of those is unparseable. Links written before
   * the itinerary existed carried `from`, `to` and `ret`, and are still read:
   * a quote somebody sent last week should still open.
   */
  const stops = (() => {
    const packed = one("stops");
    if (packed) return packed.split("~").slice(0, MAX_TRIP_STOPS).map((token) => token.slice(0, 240));

    const legacy = [one("from") ?? "", one("to") ?? ""];
    if ("ret" in params) legacy.push(one("ret") ?? "");
    if (legacy.some(Boolean)) return legacy.map((token) => (token ?? "").slice(0, 240));

    // Present-but-empty means cleared, the same as it always did: the
    // calculator mirrors its state into the URL, so the URL has to be able to
    // say "no pickup yet".
    return "from" in params || "stops" in params ? [] : defaults.stops;
  })();

  return {
    carSlug: one("car") ?? defaults.carSlug,
    packageSlug: one("pkg") ?? defaults.packageSlug,
    tripType:
      tripType === "local" || tripType === "oneway" || tripType === "round"
        ? tripType
        : defaults.tripType,
    customerPlace: "cust" in params ? (one("cust") ?? "") : defaults.customerPlace,
    stops,
    date: isISODate(one("date") ?? "") ? one("date")! : defaults.date,
    time: isTime(one("time") ?? "") ? one("time")! : defaults.time,
    occasionSlug: one("occ") ?? defaults.occasionSlug,
    haltHours: Number.isFinite(halt) && halt >= 0 ? Math.min(halt, 12) : defaults.haltHours,
  };
}

/** The inverse — a trip as a query string, for links between screens. */
export function tripToParams(trip: TripRequest): URLSearchParams {
  return new URLSearchParams({
    car: trip.carSlug,
    pkg: trip.packageSlug,
    trip: trip.tripType,
    cust: trip.customerPlace,
    stops: trip.stops.join("~"),
    date: trip.date,
    time: trip.time,
    occ: trip.occasionSlug,
    halt: String(trip.haltHours),
  });
}
