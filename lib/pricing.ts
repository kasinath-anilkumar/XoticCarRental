/**
 * The quote engine.
 *
 * A direct port of the prototype's `calc()` (design/project/Xotic Car Rental.dc.html).
 * The arithmetic is deliberately unchanged — these are the numbers the business
 * quotes customers, and lib/pricing.test.ts pins every branch of it. If a rule
 * needs to change, change it here and update the fixtures in the same commit,
 * so a quote never moves by accident.
 *
 * Pure: no database, no network, no clock. Callers resolve the car, package,
 * city and occasion first and pass distance in from lib/distance.ts.
 */

import { formatINR, formatTime } from "./format";
import { isISODate, isTime } from "./dates";
import { parsePricingRules } from "./pricing-rules";
import { seasonFor } from "./seasons";
import type { Car, PricingInput, PricingRules, Quote, QuoteLine, RateKey } from "./types";

export function rateFor(car: Car, rateKey: RateKey): number {
  switch (rateKey) {
    case "rate_8h":
      return car.rate8h;
    case "rate_12h":
      return car.rate12h;
    case "rate_full":
      return car.rateFull;
  }
}

/** True when a pickup at HH:MM falls in the 22:00–05:59 night window. */
export function isNightPickup(time: string, rules: PricingRules): boolean {
  if (!isTime(time)) return false;
  const hour = Number.parseInt(time, 10);
  if (Number.isNaN(hour)) return false;
  return rules.nightStartHour > rules.nightEndHour
    ? hour >= rules.nightStartHour || hour < rules.nightEndHour
    : hour >= rules.nightStartHour && hour < rules.nightEndHour;
}

export function nightWindowLabel(rules: PricingRules): string {
  const time = (hour: number) => formatTime(`${String(hour).padStart(2, "0")}:00`);
  return `${time(rules.nightStartHour)} and ${time(rules.nightEndHour)}`;
}

export function computeQuote(input: PricingInput): Quote {
  const rules = parsePricingRules(input.pricingRules);
  const {
    car,
    pkg,
    city,
    occasion,
    tripType,
    km,
    haltHours,
    time,
    gstPercent,
    advancePercent,
    date = "",
    returnDate = "",
    seasons = [],
    charges = [],
    interstate = false,
  } = input;

  const outstation = tripType !== "local";

  // Drive time from distance, plus whatever the customer is holding the car
  // for, rounded up to the next half hour.
  const driveHours = km / (outstation ? rules.outstationSpeedKph : rules.localSpeedKph);
  const hours = Math.max(1, Math.ceil((driveHours + Number(haltHours || 0)) * 2) / 2);
  const rentalDays = isISODate(date) && isISODate(returnDate) && returnDate >= date
    ? Math.round((Date.parse(`${returnDate}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000) + 1 : 1;
  const days = Math.max(rentalDays, Math.ceil(hours / pkg.hours));

  const base = rateFor(car, pkg.rateKey) * city.multiplier * days;
  const includedKm = pkg.km * days;
  const includedHours = pkg.hours * days;
  const extraKm = Math.max(0, km - includedKm);
  const extraHours = Math.max(0, hours - includedHours);

  const nightStart = isNightPickup(time, rules);
  // Every night away is charged, plus the pickup itself when it starts at night.
  const nights = Math.max(0, days - 1) + (nightStart ? 1 : 0);

  // The season multiplies the package base only — see lib/seasons.ts for why.
  const season = seasonFor(seasons, date);
  const seasonSurcharge = season ? Math.round(base * (season.multiplier - 1)) : 0;

  const oneWayReturn =
    tripType === "oneway"
      ? Math.round(km * car.extraKmRate * rules.oneWayReturnPercent / 100)
      : 0;

  const lines: QuoteLine[] = [
    {
      label: `${pkg.label} package${days > 1 ? ` × ${days} days` : ""}`,
      note: `${car.name} · ${city.name} rate ×${city.multiplier.toFixed(2)}`,
      amount: base,
    },
  ];

  if (extraKm > 0) {
    lines.push({
      label: `Extra distance · ${extraKm} km`,
      note: `${formatINR(car.extraKmRate)}/km past ${includedKm} km included`,
      amount: extraKm * car.extraKmRate,
    });
  }

  if (extraHours > 0) {
    lines.push({
      label: `Extra hours · ${extraHours} hr`,
      note: `${formatINR(car.extraHrRate)}/hr past ${includedHours} hr included`,
      amount: extraHours * car.extraHrRate,
    });
  }

  lines.push({
    label: `Driver allowance (bata)${days > 1 ? ` × ${days}` : ""}`,
    note: "Food and stay for the chauffeur",
    amount: car.bata * days,
  });

  if (nights > 0) {
    lines.push({
      label: `Night charge × ${nights}`,
      note: nightStart
        ? `Pickup between ${nightWindowLabel(rules)}`
        : "Overnight halt on a multi-day trip",
      amount: car.nightCharge * nights,
    });
  }

  if (oneWayReturn > 0) {
    lines.push({
      label: "One-way driver return",
      note: `${rules.oneWayReturnPercent}% of ${km} km at ${formatINR(car.extraKmRate)}/km`,
      amount: oneWayReturn,
    });
  }

  if (seasonSurcharge > 0 && season) {
    lines.push({
      label: `${season.name} rate`,
      note:
        season.note ||
        `+${Math.round((season.multiplier - 1) * 100)}% on the package`,
      amount: seasonSurcharge,
    });
  }

  if (occasion.surcharge > 0) {
    lines.push({
      label: `${occasion.name} handling`,
      note: occasion.handlingNote,
      amount: occasion.surcharge,
    });
  }

  // Permits, parking and tolls last, so the trip's own costs read together
  // above them and a customer can see what is ours and what is the road's.
  for (const charge of charges) {
    if (!charge.isActive || charge.amount <= 0) continue;
    if (charge.appliesTo === "outstation" && !outstation) continue;
    if (charge.appliesTo === "interstate" && !interstate) continue;
    lines.push({ label: charge.label, note: charge.note, amount: charge.amount });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const gst = subtotal * (gstPercent / 100);
  const total = subtotal + gst;
  // The advance is quoted as a round figure — nobody transfers ₹4,287.
  const advance = Math.round((total * (advancePercent / 100)) / 100) * 100;

  return {
    km,
    hours,
    days,
    includedKm,
    includedHours,
    lines,
    subtotal,
    gst,
    total,
    advance,
    outstation,
    nightStart,
  };
}

export function tripTypeLabel(tripType: PricingInput["tripType"]): string {
  switch (tripType) {
    case "local":
      return "Local, in city";
    case "oneway":
      return "Outstation one-way";
    case "round":
      return "Outstation round trip";
  }
}
