import type { Catalog } from "./content";

/**
 * A public catalog must contain all pricing dimensions and the actual home
 * city of every offered vehicle. An unrelated city's multiplier is never a
 * substitute for a hidden or missing home city.
 *
 * This checks configuration completeness, independently of whether the data
 * comes from the database or the seed. Empty locations/garages are allowed:
 * customers may enter their own stops and vehicles may use their city base.
 */
export function isPricingAvailable(catalog: Catalog): boolean {
  if (catalog.cars.length === 0 || catalog.packages.length === 0 || catalog.occasions.length === 0) {
    return false;
  }
  const publicCities = new Set(catalog.cities.map((city) => city.slug));
  return catalog.cars.every((car) => Boolean(car.homeCitySlug) && publicCities.has(car.homeCitySlug));
}

export class CatalogPricingUnavailableError extends Error {
  constructor() {
    super("Pricing is unavailable because the vehicle catalog is incomplete. Please contact us for a quote.");
    this.name = "CatalogPricingUnavailableError";
  }
}
