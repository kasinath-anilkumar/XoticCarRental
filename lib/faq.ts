/**
 * FAQ generators.
 *
 * The answers are computed from the catalog, not authored, so a rate change in
 * admin cannot leave a stale number sitting in an FAQ nobody thinks to re-read.
 * That is also why there are eight of them and not thirty: every question here
 * is one the data can answer truthfully.
 */

import type { FaqItem } from "@/components/content/FaqBlock";

import { carPrice, homeCity, type Catalog } from "./catalog";
import { formatChargePolicy, formatINR } from "./format";
import { nightWindowLabel, rateFor } from "./pricing";
import type { Car, City } from "./types";

const NOT_SELF_DRIVE =
  "No. Every Xotic booking comes with a chauffeur — there is no self-drive option. The driver stays with the car for the whole booking.";

function paymentAnswer(catalog: Catalog): string {
  return `Nothing is charged on this site. You send the quote on WhatsApp, and once the car and driver are confirmed a ${catalog.settings.advancePercent}% advance holds the date against a GST invoice. The balance is settled after the trip, itemised the same way.`;
}

function bataAnswer(car?: Car): string {
  const amount = car ? `${formatINR(car.bata)} a day for this car` : "a fixed amount per day";
  return `Bata is the chauffeur's food and accommodation allowance — ${amount}. It is charged per day of the trip rather than per hour, and it appears as its own line on every quote, never as a surprise at the end.`;
}

function nightAnswer(catalog: Catalog, car?: Car): string {
  const amount = car ? ` It is ${formatINR(car.nightCharge)} for this car.` : "";
  return `A pickup between ${nightWindowLabel(catalog.settings.pricingRules)} carries a night charge, plus one for each overnight halt on a multi-day trip.${amount} The pickup time determines the initial night charge.`;
}

function oneWayAnswer(): string {
  return "The billed distance includes the garage to your pickup, your journey, and the final drop back to the garage. Those return kilometres are counted once; the calculator does not add another percentage return allowance on top.";
}

function tollsAnswer(catalog: Catalog): string {
  return formatChargePolicy(catalog.settings);
}

/** Car detail page. */
export function carFaq(catalog: Catalog, car: Car): FaqItem[] {
  const city = homeCity(catalog, car);
  const prices = catalog.packages
    .map((pkg) => `${pkg.label} at ${formatINR(rateFor(car, pkg.rateKey) * city.multiplier)}`)
    .join(", ");

  return [
    {
      q: `What does the ${car.name} cost for a day in ${city.name}?`,
      a: `${prices}. Those are the package base rates before extra km, the driver's bata and ${catalog.settings.gstPercent}% GST — the calculator adds all of them for your actual route.`,
    },
    { q: "Is this self-drive?", a: NOT_SELF_DRIVE },
    { q: "What is driver bata?", a: bataAnswer(car) },
    { q: "Is there a night charge?", a: nightAnswer(catalog, car) },
    { q: "What happens on a one-way drop?", a: oneWayAnswer() },
    {
      q: `Can I take the ${car.name} outside ${city.name}?`,
      a: `Outstation estimates use the selected package per rental day, with extra km past the allowance at ${formatINR(car.extraKmRate)}/km. Check the car's listed service cities and confirm the itinerary with the operator.`,
    },
    { q: "Are tolls and parking included?", a: tollsAnswer(catalog) },
    { q: "How do I pay?", a: paymentAnswer(catalog) },
  ];
}

/** City landing page. */
export function cityFaq(catalog: Catalog, city: City): FaqItem[] {
  const local = catalog.cars.filter((car) => car.homeCitySlug === city.slug);
  const pool = local.length > 0 ? local : catalog.cars;
  const cheapest = [...pool].sort((a, b) => a.rate8h - b.rate8h)[0];
  const basePackage = catalog.packages[0];
  const from = cheapest ? formatINR(carPrice(catalog, cheapest, basePackage)) : null;

  return [
    {
      q: `What does a car with driver cost in ${city.name}?`,
      a: from
        ? `From ${from} for the ${basePackage.label} package, before the driver's bata and ${catalog.settings.gstPercent}% GST. ${city.name} carries a ×${city.multiplier.toFixed(2)} rate multiplier, which is applied to every package base for cars based here.`
        : `Rates depend on the car and package; the calculator prices any route exactly.`,
    },
    { q: "Is this self-drive?", a: NOT_SELF_DRIVE },
    { q: "What is driver bata?", a: bataAnswer(cheapest) },
    { q: "Is there a night charge?", a: nightAnswer(catalog, cheapest) },
    { q: "What happens on a one-way drop?", a: oneWayAnswer() },
    { q: "Are tolls and parking included?", a: tollsAnswer(catalog) },
    {
      q: `Which pickup points do you cover in ${city.name}?`,
      a: (() => {
        const points = catalog.locations.filter((l) => l.citySlug === city.slug);
        if (points.length === 0) {
          return `We can pick up anywhere in ${city.name} — search for the spot in the price calculator.`;
        }
        return `${points.map((p) => p.name).join(", ")}. You can also enter any other address or town in the calculator and it will price the route from there.`;
      })(),
    },
    { q: "How do I pay?", a: paymentAnswer(catalog) },
  ];
}
