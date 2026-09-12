"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { QuoteLines } from "@/components/quote/QuoteLines";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { Icon } from "@/components/ui/Icon";
import type { Catalog } from "@/lib/catalog";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { formatINR, shortPlace } from "@/lib/format";
import { tripTypeLabel } from "@/lib/pricing";
import { resolveQuote, tripToParams } from "@/lib/quote";
import type { TripRequest, TripType } from "@/lib/types";

import { CarSearch } from "./CarSearch";


export interface LivePricingProps {
  catalog: Catalog;
  /** A complete trip to start from, resolved on the server. */
  initialTrip: TripRequest;
}

const TRIP_OPTIONS: Array<{ key: TripType; label: string }> = [
  { key: "local", label: "In the city" },
  { key: "oneway", label: "One-way drop" },
  { key: "round", label: "Round trip" },
];

/**
 * "Know the exact price before you book" — proved rather than asserted.
 *
 * This used to render one fixed sample quote, which made the claim on the left
 * a promise the section itself did not keep. It now runs the real engine: pick
 * a car, a package and a trip type and every line moves, including the ones
 * customers are most wary of — the driver's bata, the night charge, the
 * one-way return allowance.
 *
 * The same `resolveQuote` the calculator, the summary and the enquiry API use,
 * so a number seen here cannot disagree with the one seen there.
 */
export function LivePricing({ catalog, initialTrip }: LivePricingProps) {
  const [trip, setTrip] = useState<TripRequest>(initialTrip);
  const set = <K extends keyof TripRequest>(key: K, value: TripRequest[K]) =>
    setTrip((current) => ({ ...current, [key]: value }));

  const resolved = useMemo(
    () => isPricingAvailable(catalog) ? resolveQuote(catalog, trip) : null,
    [catalog, trip],
  );
  if (!resolved) return <PricingUnavailable />;
  const { quote } = resolved;

  const routeLine = resolved.stops.map((stop) => shortPlace(stop.name)).join(" → ");

  const calculatorHref = `/price-calculator?${tripToParams(trip).toString()}`;

  return (
    <div className="grid grid-cols-[1fr_1fr] items-start gap-[56px] max-lg:grid-cols-1 max-lg:gap-12 max-md:gap-8">
      <div>
        <p className="kick">Transparent pricing</p>
        <h2 className="h2" style={{ marginBottom: "11.2px" }}>
          Know the exact price before you book
        </h2>
        <p className="max-w-[460px] text-[15px] text-[var(--color-neutral-300)] [text-wrap:pretty]">
          Change anything on the left and watch the bill on the right. Every charge Indian
          customers get surprised by — the driver&rsquo;s bata, the night pickup, the empty run
          home after a one-way drop — is a line you can see before you send anything.
        </p>

        <div className="my-8 flex flex-col gap-6 max-md:my-6 max-md:gap-4">
          <div>
            <span className="mb-3 block text-[11px] tracking-[0.1em] uppercase text-[var(--color-neutral-500)]" id="live-trip">
              Kind of trip
            </span>
            <div className="flex flex-wrap gap-2">
              {TRIP_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className={`relative cursor-pointer rounded-md border px-[12px] py-[7px] text-[13px] whitespace-nowrap max-md:min-h-[44px] [&_input]:pointer-events-none [&_input]:absolute [&_input]:size-0 [&_input]:opacity-0 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--color-accent)] ${
                    trip.tripType === option.key ? "border-[var(--color-accent)] bg-[var(--color-accent-800)] text-[var(--color-accent-100)]" : "border-[var(--color-divider)] bg-transparent text-[var(--color-neutral-300)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent-300)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="live-trip-type"
                    value={option.key}
                    checked={trip.tripType === option.key}
                    onChange={() => set("tripType", option.key)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-3 block text-[11px] tracking-[0.1em] uppercase text-[var(--color-neutral-500)]" id="live-package">
              Package
            </span>
            <div className="flex flex-wrap gap-2">
              {catalog.packages.map((pkg) => (
                <label
                  key={pkg.slug}
                  className={`relative cursor-pointer rounded-md border px-[12px] py-[7px] text-[13px] whitespace-nowrap max-md:min-h-[44px] [&_input]:pointer-events-none [&_input]:absolute [&_input]:size-0 [&_input]:opacity-0 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--color-accent)] ${
                    trip.packageSlug === pkg.slug ? "border-[var(--color-accent)] bg-[var(--color-accent-800)] text-[var(--color-accent-100)]" : "border-[var(--color-divider)] bg-transparent text-[var(--color-neutral-300)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent-300)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="live-package"
                    value={pkg.slug}
                    checked={trip.packageSlug === pkg.slug}
                    onChange={() => set("packageSlug", pkg.slug)}
                  />
                  {pkg.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="live-car"
              className="mb-2.5 flex items-center gap-1.5 text-[11px] tracking-[0.1em] uppercase text-[var(--color-neutral-500)]"
            >
              <Icon name="ph-car" size={13} color="var(--color-accent)" />
              Car
            </label>
            <CarSearch
              catalog={catalog}
              selectedCarSlug={trip.carSlug}
              onSelectCar={(slug) => set("carSlug", slug)}
              packageSlug={trip.packageSlug}
              id="live-car"
            />
          </div>
        </div>

        <Link href={calculatorHref} className="btn btn-primary">
          <Icon name="ph-calculator" size={17} />
          Build the exact quote for my route
        </Link>
      </div>

      <div className="relative rounded-lg bg-bg p-8 shadow-[var(--shadow-md)] max-md:p-6">
        <div className="mb-[4px] flex items-baseline justify-between gap-4">
          <span className="font-[family-name:var(--font-heading)] text-[17px]">
            {resolved.car.name}
          </span>
          <span className="tag tag-accent">{tripTypeLabel(trip.tripType)}</span>
        </div>
        <p className="mb-4 text-[12px] text-[var(--color-neutral-500)]">
          {routeLine} · {quote.km} km
        </p>

        <div className="mb-3 flex items-baseline gap-[8px] border-b border-[var(--color-divider)] pt-4 pb-6">
          <span className="font-[family-name:var(--font-heading)] text-[38px] leading-none tabular-nums text-[var(--color-accent-300)] max-md:text-[30px]">
            {formatINR(quote.total)}
          </span>
          <span className="text-[12px] text-[var(--color-neutral-500)]">
            all-in · {resolved.pkg.label}
            {quote.days > 1 ? ` × ${quote.days} days` : ""}
          </span>
        </div>

        <QuoteLines quote={quote} gstPercent={catalog.settings.gstPercent} tight />

        <p className="mt-3 text-[11px] text-[var(--color-neutral-500)]">
          Tolls, parking and state permits at actuals. {formatINR(quote.advance)} advance holds the
          car.
        </p>
      </div>
    </div>
  );
}
