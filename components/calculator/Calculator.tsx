"use client";

import { MAX_TRIP_DAYS, MAX_TRIP_STOPS } from "@/lib/trip-limits";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CarSearch } from "@/components/home/CarSearch";
import { RouteMap } from "@/components/map/RouteMap";
import { QuoteLines } from "@/components/quote/QuoteLines";
import { Icon } from "@/components/ui/Icon";
import { LocationCombobox } from "@/components/ui/LocationCombobox";
import { carPrice, type Catalog } from "@/lib/catalog";
import { bookingIssue } from "@/lib/booking-readiness";
import { addDays, isISODate } from "@/lib/dates";
import { formatDuration, formatINR, shortPlace } from "@/lib/format";
import { tripTypeLabel } from "@/lib/pricing";
import { resolveQuote, tripStops, tripToParams } from "@/lib/quote";
import type { RoutedTrip } from "@/lib/route/types";
import type { TripRequest, TripType } from "@/lib/types";

export interface CalculatorProps {
  catalog: Catalog;
  initialTrip: TripRequest;
  minDate: string;
}

const TRIP_OPTIONS: Array<{ key: TripType; label: string }> = [
  { key: "local", label: "Local" },
  { key: "oneway", label: "One-way" },
  { key: "round", label: "Round trip" },
];

type MobileTab = "route" | "vehicle" | "map";

/**
 * The price calculator. Everything recalculates on change, and the trip is
 * mirrored into the URL so a quote is a link someone can send to whoever is
 * paying.
 *
 * Mobile UX:
 * - On small to medium screens (< 1024px), uses a clean step/tab workflow:
 *   1. Route & Stops -> 2. Car & Package -> 3. Map & Quote Breakdown.
 * - Integrated real-time CarSearch with visual cards, live filters, and photo thumbnails.
 * - Sticky bottom bar with one-tap quote inspection and instant booking actions.
 *
 * Desktop UX:
 * - Unified 2-column layout with real-time map, full itinerary, and sticky quote card.
 */
export function Calculator({ catalog, initialTrip, minDate }: CalculatorProps) {
  const router = useRouter();
  const [trip, setTrip] = useState<TripRequest>(initialTrip);
  const [mobileTab, setMobileTab] = useState<MobileTab>("route");

  const update = <K extends keyof TripRequest>(key: K, value: TripRequest[K]) =>
    setTrip((current) => ({ ...current, [key]: value }));

  const setStop = (index: number, token: string) =>
    setTrip((current) => {
      const stops = [...current.stops];
      stops[index] = token;
      return { ...current, stops };
    });

  const addStop = () => setTrip((current) => current.stops.length >= MAX_TRIP_STOPS
    ? current : { ...current, stops: [...current.stops, ""] });

  const removeStop = (index: number) =>
    setTrip((current) => ({
      ...current,
      stops: current.stops.length > 2 ? current.stops.filter((_, i) => i !== index) : current.stops,
    }));

  const moveStop = (index: number, by: -1 | 1) =>
    setTrip((current) => {
      const to = index + by;
      if (to < 0 || to >= current.stops.length) return current;
      const stops = [...current.stops];
      [stops[index], stops[to]] = [stops[to]!, stops[index]!];
      return { ...current, stops };
    });

  const stopLabel = (index: number, total: number) => {
    if (index === 0) return "Pickup location";
    if (index === total - 1) return "Final drop";
    return `Stop ${index}`;
  };

  const stops = useMemo(() => tripStops(catalog, trip), [catalog, trip]);
  const stopsKey = useMemo(
    () => stops.map((stop) => `${stop.lat.toFixed(5)},${stop.lng.toFixed(5)}`).join(";"),
    [stops],
  );

  const [directions, setDirections] = useState<{ key: string; trip: RoutedTrip } | null>(null);
  const [routing, setRouting] = useState(false);
  const routed = directions?.key === stopsKey ? directions.trip : null;

  useEffect(() => {
    if (stopsKey.split(";").length < 2) return;

    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setRouting(true);
      try {
        const response = await fetch(`/api/directions?stops=${encodeURIComponent(stopsKey)}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
        });
        if (!response.ok) throw new Error("Route lookup failed.");
        const data = (await response.json()) as { routed?: boolean } & RoutedTrip;
        if (cancelled) return;
        setDirections(data.routed ? { key: stopsKey, trip: data } : null);
      } catch {
        if (!cancelled) setDirections(null);
      } finally {
        if (!cancelled) setRouting(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [stopsKey]);

  const resolved = useMemo(() => resolveQuote(catalog, trip, routed), [catalog, trip, routed]);
  const { quote } = resolved;

  useEffect(() => {
    const params = tripToParams(trip);
    window.history.replaceState(null, "", `/price-calculator?${params.toString()}`);
  }, [trip]);

  const routeLine = resolved.complete
    ? stops.map((stop) => shortPlace(stop.name)).join(" → ")
    : "Add a pickup and a drop";
  const summaryHref = `/booking-summary?${tripToParams(trip).toString()}`;
  const bookingPrompt = bookingIssue(trip, catalog.locations, minDate);
  const activePackage = catalog.packages.find((pkg) => pkg.slug === trip.packageSlug);

  const mapNote = !resolved.complete
    ? "Nothing is priced until both ends of the trip are set."
    : resolved.routed
      ? "Driven route on real roads. Billed distance also covers vehicle transfer from its garage."
      : routing
        ? "Finding the driving route…"
        : "Estimated road routing distance between your selected stops.";

  return (
    <>
      <div className="px-[var(--gutter-desktop)] pt-[28px] pb-[48px] max-md:px-[var(--gutter-mobile)] max-md:pt-[16px] max-md:pb-[72px]">
        {/* Header Title */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 max-md:mb-3">
          <div>
            <p className="kick">Price calculator</p>
            <h1 className="m-0 text-[28px] font-medium max-lg:text-[24px] max-md:text-[22px]">
              Build your trip, see the exact price
            </h1>
          </div>
          <p className="max-w-[48ch] text-[12.5px] text-[var(--color-neutral-400)] max-md:hidden">
            Everything recalculates as you change it. Transparent pricing itemised before you book.
          </p>
        </div>

        {/* Mobile & Tablet Step Navigator (< 1024px) */}
        <div className="mb-4 hidden rounded-lg border border-[var(--color-divider)] bg-surface p-1.5 shadow-xs max-lg:flex">
          <button
            type="button"
            onClick={() => setMobileTab("route")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[12px] font-medium transition-all ${
              mobileTab === "route"
                ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-xs"
                : "text-[var(--color-neutral-400)] hover:text-text"
            }`}
          >
            <Icon name="ph-path" size={15} />
            <span>1. Route &amp; Stops</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("vehicle")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[12px] font-medium transition-all ${
              mobileTab === "vehicle"
                ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-xs"
                : "text-[var(--color-neutral-400)] hover:text-text"
            }`}
          >
            <Icon name="ph-car" size={15} />
            <span>2. Car &amp; Package</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("map")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[12px] font-medium transition-all ${
              mobileTab === "map"
                ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-xs"
                : "text-[var(--color-neutral-400)] hover:text-text"
            }`}
          >
            <Icon name="ph-receipt" size={15} />
            <span>3. Map &amp; Quote</span>
          </button>
        </div>

        {/* Main Grid: Forms on left, Sticky Quote Panel on right */}
        <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-8 max-lg:grid-cols-1">
          <div className="min-w-0 overflow-hidden rounded-md bg-surface shadow-[var(--shadow-sm)] [&_.field>label]:mb-[4px] [&_.field>label]:text-[11.5px] [&_.input]:min-h-[38px] [&_.input]:text-[13.5px] max-md:[&_.field>label]:text-[12px] max-md:[&_.input]:min-h-[44px] max-md:[&_.input]:text-[15px]">
            {/* ── SECTION 1: ROUTE & ITINERARY ─────────────────────── */}
            <section
              className={`p-6 not-first:border-t not-first:border-[var(--color-divider)] max-md:p-4 ${
                mobileTab !== "route" ? "max-lg:hidden" : ""
              }`}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-full bg-[var(--color-accent-900)] text-[11px] font-bold text-[var(--color-accent-300)]">
                    1
                  </span>
                  <h2 className="font-[family-name:var(--font-heading)] text-[13px] tracking-[0.08em] uppercase text-[var(--color-neutral-400)]">
                    Route &amp; Schedule
                  </h2>
                </div>

                <div className="max-md:w-full">
                  <div className="seg max-md:flex max-md:w-full" role="radiogroup" aria-label="Trip type">
                    {TRIP_OPTIONS.map((option) => (
                      <label key={option.key} className="seg-opt max-md:flex-1 max-md:justify-center">
                        <input
                          type="radio"
                          name="trip"
                          value={option.key}
                          checked={trip.tripType === option.key}
                          onChange={() => update("tripType", option.key)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {/* Optional Customer Current Location */}
                <LocationCombobox
                  id="calc-customer"
                  label="Your location (optional)"
                  icon="ph-user-circle-check"
                  value={trip.customerPlace}
                  onChange={(token) => update("customerPlace", token ?? "")}
                  locations={catalog.locations}
                  placeholder="Where are you currently located?"
                  clearable
                  clearLabel="Not now"
                />

                <p className="mt-1 flex items-center gap-3 text-[10.5px] font-medium tracking-[0.08em] uppercase text-[var(--color-neutral-500)] after:h-px after:flex-1 after:bg-[var(--color-divider)] after:content-['']">
                  Itinerary Stops
                </p>

                {trip.stops.map((token, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                    <LocationCombobox
                      id={`calc-stop-${index}`}
                      label={stopLabel(index, trip.stops.length)}
                      icon={
                        index === 0
                          ? "ph-map-pin-line"
                          : index === trip.stops.length - 1
                            ? "ph-flag"
                            : "ph-path"
                      }
                      value={token}
                      onChange={(next) => setStop(index, next ?? "")}
                      locations={catalog.locations}
                    />
                    <div className="flex gap-[2px] pb-[2px] [&_.btn-icon]:h-[38px] [&_.btn-icon]:w-[32px] max-md:[&_.btn-icon]:size-[44px]">
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => moveStop(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${stopLabel(index, trip.stops.length)} earlier`}
                      >
                        <Icon name="ph-caret-up" size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => moveStop(index, 1)}
                        disabled={index === trip.stops.length - 1}
                        aria-label={`Move ${stopLabel(index, trip.stops.length)} later`}
                      >
                        <Icon name="ph-caret-down" size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => removeStop(index)}
                        disabled={trip.stops.length <= 2}
                        aria-label={`Remove ${stopLabel(index, trip.stops.length)}`}
                      >
                        <Icon name="ph-x" size={13} />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn btn-ghost mt-1 min-h-[42px] self-start text-[13px] max-md:w-full max-md:justify-center"
                  onClick={addStop}
                  disabled={trip.stops.length >= MAX_TRIP_STOPS}
                >
                  <Icon name="ph-plus-circle" size={15} color="var(--color-accent)" />
                  {trip.stops.length >= MAX_TRIP_STOPS ? `Maximum ${MAX_TRIP_STOPS} stops` : "Add another stop"}
                </button>

                <p className="mt-2 flex items-center gap-3 text-[10.5px] font-medium tracking-[0.08em] uppercase text-[var(--color-neutral-500)] after:h-px after:flex-1 after:bg-[var(--color-divider)] after:content-['']">
                  Date &amp; Timing
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="field">
                    <label htmlFor="calc-date">Pickup date</label>
                    <input
                      id="calc-date"
                      className="input"
                      type="date"
                      min={minDate}
                      value={trip.date}
                      onChange={(event) => setTrip((current) => ({ ...current, date: event.target.value,
                        returnDate: current.returnDate && isISODate(event.target.value)
                          && (current.returnDate < event.target.value || current.returnDate > addDays(event.target.value, MAX_TRIP_DAYS - 1))
                          ? "" : current.returnDate }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="calc-return-date">Return date (optional)</label>
                    <input id="calc-return-date" className="input" type="date" min={trip.date || minDate}
                      max={isISODate(trip.date) ? addDays(trip.date, MAX_TRIP_DAYS - 1) : undefined}
                      value={trip.returnDate ?? ""} onChange={(event) => update("returnDate", event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="calc-time">Pickup time</label>
                    <input
                      id="calc-time"
                      className="input"
                      type="time"
                      value={trip.time}
                      onChange={(event) => update("time", event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="calc-halt">Halt duration</label>
                    <div className="relative flex items-center">
                      <input
                        id="calc-halt"
                        className="input pr-10"
                        type="number"
                        min={0}
                        max={12}
                        value={trip.haltHours}
                        onChange={(event) => update("haltHours", Number(event.target.value) || 0)}
                      />
                      <span className="pointer-events-none absolute right-3 text-[12px] text-[var(--color-neutral-500)]">
                        hrs
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile Tab Next Action */}
                <div className="mt-4 hidden max-lg:block">
                  <button
                    type="button"
                    onClick={() => setMobileTab("vehicle")}
                    className="btn btn-primary w-full min-h-[44px]"
                  >
                    <span>Next: Select Car &amp; Package</span>
                    <Icon name="ph-arrow-right" size={15} />
                  </button>
                </div>
              </div>
            </section>

            {/* ── SECTION 2: VEHICLE & PACKAGE ─────────────────────── */}
            <section
              className={`p-6 not-first:border-t not-first:border-[var(--color-divider)] max-md:p-4 ${
                mobileTab !== "vehicle" ? "max-lg:hidden" : ""
              }`}
            >
              <div className="mb-4 flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-[var(--color-accent-900)] text-[11px] font-bold text-[var(--color-accent-300)]">
                  2
                </span>
                <h2 className="font-[family-name:var(--font-heading)] text-[13px] tracking-[0.08em] uppercase text-[var(--color-neutral-400)]">
                  Vehicle &amp; Package Selection
                </h2>
              </div>

              {/* Package Selection */}
              <div className="mb-6">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-[var(--color-neutral-400)]">
                    Select package:
                  </span>
                  <span className="text-[11.5px] text-[var(--color-accent-300)]">
                    {activePackage?.sub}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {catalog.packages.map((pkg) => {
                    const active = pkg.slug === trip.packageSlug;
                    const price = carPrice(catalog, resolved.car, pkg);
                    return (
                      <button
                        key={pkg.slug}
                        type="button"
                        onClick={() => update("packageSlug", pkg.slug)}
                        aria-pressed={active}
                        className={`group relative flex min-w-0 cursor-pointer flex-col justify-between rounded-lg border p-3.5 text-left transition-all max-md:p-3 ${
                          active
                            ? "border-[var(--color-accent)] bg-[var(--color-accent-900)]/40 text-text shadow-xs"
                            : "border-[var(--color-divider)] bg-well text-text hover:border-[var(--color-accent)]"
                        }`}
                      >
                        {/* Top: Icon + Label + Active Checkmark */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`grid size-7 shrink-0 place-items-center rounded-md ${
                                active
                                  ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                                  : "bg-[var(--color-neutral-800)] text-[var(--color-neutral-400)] group-hover:text-text"
                              }`}
                            >
                              <Icon name={pkg.icon} size={15} />
                            </span>
                            <div className="min-w-0">
                              <span className="block truncate font-[family-name:var(--font-heading)] text-[13.5px] font-semibold text-text">
                                {pkg.label}
                              </span>
                              <span className="block truncate text-[11px] text-[var(--color-neutral-500)]">
                                {pkg.sub}
                              </span>
                            </div>
                          </div>

                          {active && (
                            <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-ink)]">
                              <Icon name="ph-check" size={10} />
                            </span>
                          )}
                        </div>

                        {/* Bottom Price Strip */}
                        <div className="mt-3 flex items-baseline justify-between border-t border-[var(--color-divider)] pt-2.5">
                          <span className="text-[10px] uppercase tracking-wider text-[var(--color-neutral-500)]">
                            Base rate
                          </span>
                          <span
                            className={`font-[family-name:var(--font-heading)] text-[14px] font-semibold tabular-nums ${
                              active
                                ? "text-[var(--color-accent-300)]"
                                : "text-[var(--color-neutral-300)]"
                            }`}
                          >
                            {formatINR(price)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Searchable Car Combobox */}
              <div className="mb-4">
                <label
                  htmlFor="calc-car"
                  className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-neutral-400)]"
                >
                  <Icon name="ph-car" size={14} color="var(--color-accent)" />
                  Select luxury vehicle:
                </label>
                <CarSearch
                  catalog={catalog}
                  selectedCarSlug={trip.carSlug}
                  onSelectCar={(slug) => update("carSlug", slug)}
                  packageSlug={trip.packageSlug}
                  id="calc-car"
                  className="max-w-none"
                />
              </div>

              {/* Night Charge Advisory */}
              <div className="flex items-center gap-2 rounded-md bg-well px-3 py-2.5 text-[12px] text-[var(--color-neutral-400)]">
                <Icon name="ph-moon-stars" size={16} color="var(--color-accent)" />
                <span>
                  {quote.nightStart
                    ? "Night pickup charge applies (between 10:00 PM and 6:00 AM)."
                    : "No night charge applies for this pickup time."}
                </span>
              </div>

              {/* Mobile Tab Next Action */}
              <div className="mt-5 hidden max-lg:flex max-lg:gap-2">
                <button
                  type="button"
                  onClick={() => setMobileTab("route")}
                  className="btn btn-ghost flex-1 min-h-[44px]"
                >
                  <Icon name="ph-arrow-left" size={15} />
                  <span>Back to Route</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab("map")}
                  className="btn btn-primary flex-[1.4] min-h-[44px]"
                >
                  <span>Next: View Map &amp; Quote</span>
                  <Icon name="ph-arrow-right" size={15} />
                </button>
              </div>
            </section>

            {/* ── SECTION 3: ROUTE MAP & BREAKDOWN ─────────────────── */}
            <section
              className={`p-6 not-first:border-t not-first:border-[var(--color-divider)] max-md:p-4 ${
                mobileTab !== "map" ? "max-lg:hidden" : ""
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-full bg-[var(--color-accent-900)] text-[11px] font-bold text-[var(--color-accent-300)]">
                    3
                  </span>
                  <h2 className="font-[family-name:var(--font-heading)] text-[13px] tracking-[0.08em] uppercase text-[var(--color-neutral-400)]">
                    Route Map &amp; Live Distance
                  </h2>
                </div>
                {resolved.complete && (
                  <span className="text-[12px] text-[var(--color-accent-300)]">
                    {quote.km} km on route
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-col overflow-hidden rounded-md border border-[var(--color-divider)]">
                <RouteMap
                  fill
                  stops={stops}
                  path={routed?.path}
                  chips={
                    resolved.complete
                      ? [
                          `${quote.km} km route`,
                          resolved.drivingMinutes
                            ? `${formatDuration(resolved.drivingMinutes)} drive`
                            : `${quote.hours} hr with halts`,
                        ]
                      : []
                  }
                  note={mapNote}
                />
              </div>

              {/* On mobile (< 1024px), also show full quote breakdown right below the map */}
              <div className="mt-6 hidden max-lg:block">
                <div className="rounded-lg border border-[var(--color-divider)] bg-well p-4">
                  <div className="mb-3 flex items-baseline justify-between border-b border-[var(--color-divider)] pb-2">
                    <span className="font-[family-name:var(--font-heading)] text-[16px] font-semibold text-text">
                      Itemised Quote Breakdown
                    </span>
                    <span className="tag tag-accent">{tripTypeLabel(trip.tripType)}</span>
                  </div>

                  <p className="mb-3 text-[12px] text-[var(--color-neutral-400)]">
                    {resolved.car.name} · {routeLine}
                  </p>

                  <div className="mb-3 grid grid-cols-3 gap-2">
                    <div className="rounded bg-surface p-2 text-center">
                      <p className="text-[9.5px] uppercase text-[var(--color-neutral-500)]">Distance</p>
                      <p className="font-[family-name:var(--font-heading)] text-[14px] font-medium text-text">
                        {resolved.complete ? `${quote.km} km` : "—"}
                      </p>
                    </div>
                    <div className="rounded bg-surface p-2 text-center">
                      <p className="text-[9.5px] uppercase text-[var(--color-neutral-500)]">Duration</p>
                      <p className="font-[family-name:var(--font-heading)] text-[14px] font-medium text-text">
                        {quote.hours} hr
                      </p>
                    </div>
                    <div className="rounded bg-surface p-2 text-center">
                      <p className="text-[9.5px] uppercase text-[var(--color-neutral-500)]">Allowance</p>
                      <p className="font-[family-name:var(--font-heading)] text-[14px] font-medium text-text">
                        {quote.includedKm} km
                      </p>
                    </div>
                  </div>

                  <QuoteLines
                    quote={quote}
                    gstPercent={catalog.settings.gstPercent}
                    showSubtotal
                    totalLabel="Total payable"
                  />

                  <div className="mt-4">
                    {!bookingPrompt ? <Link
                      href={summaryHref}
                      className="btn btn-primary w-full min-h-[44px]"
                    >
                      <span>Review &amp; Confirm on WhatsApp</span>
                      <Icon name="ph-arrow-right" size={16} />
                    </Link> : <p className="text-[13px] text-[var(--color-neutral-400)]">{bookingPrompt}</p>}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ── DESKTOP STICKY QUOTE PANEL (>= 1024px) ───────────────── */}
          <aside className="sticky top-[90px] rounded-lg bg-surface p-6 shadow-[var(--shadow-md)] max-lg:hidden">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-[family-name:var(--font-heading)] text-[19px]">Your quote</span>
              <span className="tag tag-accent">{tripTypeLabel(trip.tripType)}</span>
            </div>
            <p className="mt-2 mb-4 text-[12px] text-[var(--color-neutral-500)]">
              {resolved.car.name} · {routeLine}
            </p>

            <div className="mb-4 grid grid-cols-3 gap-2.5">
              <div className="rounded-sm bg-well p-3">
                <p className="text-[10px] text-[var(--color-neutral-500)]">Distance</p>
                <p className="font-[family-name:var(--font-heading)] text-[16px]">
                  {resolved.complete ? `${quote.km} km` : "—"}
                </p>
                {resolved.complete && resolved.transferKm > 0 && (
                  <p className="mt-[2px] text-[10px] text-[var(--color-neutral-500)]">
                    incl. {Math.round(resolved.transferKm)} km transfer
                  </p>
                )}
              </div>
              <div className="rounded-sm bg-well p-3">
                <p className="text-[10px] text-[var(--color-neutral-500)]">Duration</p>
                <p className="font-[family-name:var(--font-heading)] text-[16px]">{quote.hours} hr</p>
              </div>
              <div className="rounded-sm bg-well p-3">
                <p className="text-[10px] text-[var(--color-neutral-500)]">Package covers</p>
                <p className="font-[family-name:var(--font-heading)] text-[16px]">
                  {quote.includedKm} km / {quote.includedHours} hr
                </p>
              </div>
            </div>

            <QuoteLines
              quote={quote}
              gstPercent={catalog.settings.gstPercent}
              showSubtotal
              totalLabel="Total payable"
            />

            <p className="mt-4 flex items-start gap-2 rounded-sm bg-[var(--color-accent-900)] px-3.5 py-2.5 text-[12px] leading-relaxed text-text">
              <Icon name="ph-info" size={15} color="var(--color-accent)" />
              <span>
                This is an <strong>estimated rate</strong>. Final pricing and car availability
                confirmed instantly by our team.
              </span>
            </p>

            <p className="mt-2.5 text-[11px] leading-normal text-[var(--color-neutral-500)]">
              Tolls, parking and state permits at actuals, paid directly. Fuel and chauffeur included.
            </p>

            <div className="mt-4">
              {!bookingPrompt ? (
                <Link
                  href={summaryHref}
                  className="btn btn-primary btn-block min-h-[44px]"
                >
                  Review &amp; confirm on WhatsApp
                  <Icon name="ph-arrow-right" size={16} />
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-block min-h-[44px]"
                  disabled
                >
                  {bookingPrompt}
                </button>
              )}

              <div className="mt-3 flex flex-wrap justify-center gap-5 text-[11px] text-[var(--color-neutral-500)]">
                <span className="inline-flex items-center gap-1">
                  <Icon name="ph-lock-simple" size={13} />
                  No payment on site
                </span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="ph-currency-inr" size={13} />
                  {formatINR(quote.advance)} advance to confirm
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile Fixed Action Bar (< 1024px) */}
      <div className="stickybar hidden max-lg:flex">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-neutral-500)]">
              Total payable
            </span>
            <button
              type="button"
              onClick={() => setMobileTab("map")}
              className="inline-flex items-center gap-0.5 text-[10.5px] text-[var(--color-accent-300)] underline"
            >
              Details
            </button>
          </div>
          <span className="font-[family-name:var(--font-heading)] text-[20px] font-semibold text-[var(--color-accent-300)]">
            {formatINR(quote.total)}
          </span>
        </div>

        <button
          type="button"
          className="btn btn-primary min-h-[44px] px-5"
          onClick={() => {
            if (bookingPrompt) {
              setMobileTab("route");
            } else {
              router.push(summaryHref);
            }
          }}
        >
          <span>{!bookingPrompt ? "Review & send" : "Complete trip details"}</span>
          <Icon name="ph-arrow-right" size={15} />
        </button>
      </div>
    </>
  );
}
