"use client";

import { MAX_TRIP_DAYS, MAX_TRIP_STOPS } from "@/lib/trip-limits";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { CarSearch } from "@/components/home/CarSearch";
import { RouteMap } from "@/components/map/RouteMap";
import { QuoteLines } from "@/components/quote/QuoteLines";
import { RouteDistanceBreakdown } from "@/components/quote/RouteDistanceBreakdown";
import { Icon } from "@/components/ui/Icon";
import { Media } from "@/components/ui/Media";
import { ResponsiveDisclosure } from "@/components/ui/ResponsiveDisclosure";
import { JourneyRoadmap } from "@/components/ui/JourneyRoadmap";
import styles from "./Calculator.module.css";
import { LocationCombobox } from "@/components/ui/LocationCombobox";
import { carPrice, garagePoint, heroImage, type Catalog } from "@/lib/catalog";
import { bookingIssue } from "@/lib/booking-readiness";
import { addDays, isISODate, isTime } from "@/lib/dates";
import { resolvePlace } from "@/lib/places";
import { focusPageTarget } from "@/lib/navigation-focus";
import { formatDuration, formatINR, shortPlace } from "@/lib/format";
import { nightWindowLabel, tripTypeLabel } from "@/lib/pricing";
import { resolveQuote, tripToParams, vehicleRouteStops } from "@/lib/quote";
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

/**
 * One continuous calculator at every screen size. Trip changes recalculate
 * the quote and update its URL; section links leave all fields available.
 */
export function Calculator({ catalog, initialTrip, minDate }: CalculatorProps) {
  const [trip, setTrip] = useState<TripRequest>(() => ({
    ...initialTrip,
    // A cleared share link still needs editable pickup and drop fields.
    stops: [initialTrip.stops[0] ?? "", initialTrip.stops[1] ?? "", ...initialTrip.stops.slice(2)],
  }));
  const lastSyncedTrip = useRef(trip);
  const [activeStep, setActiveStep] = useState("route");

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
    if (total === 2 && trip.tripType === "round") return "Destination";
    if (index === total - 1) return "Final drop";
    return `Stop ${index}`;
  };

  const vehicleStops = useMemo(() => vehicleRouteStops(catalog, trip), [catalog, trip]);
  const routePointsKey = useMemo(
    () => vehicleStops.map((stop) => `${stop.lat.toFixed(5)},${stop.lng.toFixed(5)}`).join(";"),
    [vehicleStops],
  );
  const routingKey = `${trip.carSlug}:${trip.tripType}:${routePointsKey}`;

  const [directions, setDirections] = useState<{ key: string; trip: RoutedTrip } | null>(null);
  const [routing, setRouting] = useState(false);
  const routed = directions?.key === routingKey ? directions.trip : null;

  useEffect(() => {
    if (routePointsKey.split(";").length < 2) return;

    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setRouting(true);
      try {
        const response = await fetch(`/api/directions?stops=${encodeURIComponent(routePointsKey)}&scope=vehicle`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
        });
        if (!response.ok) throw new Error("Route lookup failed.");
        const data = (await response.json()) as { routed?: boolean } & RoutedTrip;
        if (cancelled) return;
        setDirections(data.routed ? { key: routingKey, trip: data } : null);
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
  }, [routePointsKey, routingKey]);

  const resolved = useMemo(() => resolveQuote(catalog, trip, routed), [catalog, trip, routed]);
  const { quote } = resolved;
  const garage = garagePoint(catalog, resolved.car);
  const returnsToPickup = trip.stops.length === 2 && resolved.stops.length === 3;

  useEffect(() => {
    // Preserve the incoming fragment until the customer edits the trip. The
    // shared navigation handler needs it to reveal/focus a linked section.
    if (lastSyncedTrip.current === trip) return;
    lastSyncedTrip.current = trip;
    const params = tripToParams(trip);
    window.history.replaceState(null, "", `/price-calculator?${params.toString()}`);
  }, [trip]);

  const routeLine = resolved.complete
    ? resolved.stops.map((stop) => shortPlace(stop.name)).join(" → ")
    : trip.tripType === "round" && trip.stops.length === 2 ? "Add a pickup and a destination" : "Add a pickup and a drop";
  const summaryHref = `/booking-summary?${tripToParams(trip).toString()}`;
  const bookingPrompt = bookingIssue(trip, catalog.locations, minDate);
  const activePackage = catalog.packages.find((pkg) => pkg.slug === trip.packageSlug);
  const focusMissingDetail = () => {
    const missingStop = trip.stops.findIndex((stop) => !resolvePlace(stop, catalog.locations));
    const id = missingStop >= 0 ? `calc-stop-${missingStop}`
      : !isISODate(trip.date) || trip.date < minDate ? "calc-date"
        : !isTime(trip.time) ? "calc-time" : "calc-return-date";
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
    focusPageTarget(id);
  };

  const mapNote = !resolved.complete
    ? trip.tripType === "round" && trip.stops.length === 2
      ? "Select pickup and destination to include your round trip in the estimate."
      : "Select pickup and drop to include your route in the estimate."
    : resolved.routed
      ? "Road route includes the car’s trip to pickup and return after drop-off."
      : routing
        ? "Finding the driving route…"
        : "Estimated distance, including pickup and return travel. Final distance and pricing will be confirmed.";

  return (
    <>
      <div className={styles.page}>
        {/* Header Title */}
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Chauffeur-driven travel / Price calculator</p>
            <h1>
              Plan your journey
            </h1>
          </div>
          <div className={styles.headerAside}>
            <p>Add your route and dates to see the full journey estimate.</p>
            <a href="#calc-map" className={styles.mapLink}><Icon name="ph-map-trifold" size={17} />Route map<Icon name="ph-arrow-up-right" size={15} /></a>
          </div>
        </div>

        {/* The map stays alongside a continuous, editable journey roadmap. */}
        <div className={styles.layout}>
          <div id="calc-journey" className={styles.journey}>
            <div className={styles.roadmap}>
              <JourneyRoadmap label="Calculator sections" steps={[
                { label: "Route & schedule", href: "#calc-route", current: activeStep === "route", complete: !bookingPrompt },
                { label: "Car & package", href: "#calc-vehicle", current: activeStep === "vehicle", complete: !bookingPrompt && Boolean(activePackage && resolved.car) },
                { label: "Your quote", href: "#calc-quote", current: activeStep === "quote" },
              ]} />
            </div>
            <div className={styles.roadmapSteps}>
            <section
              id="calc-route" className={`${styles.step} ${styles.routeSection}`} data-current={activeStep === "route"} onFocusCapture={() => setActiveStep("route")} tabIndex={-1} aria-labelledby="calc-route-heading"
            >
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <span className={styles.stepNumber} aria-hidden="true">
                    1
                  </span>
                  <h2 id="calc-route-heading">
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

              <div className={styles.routeFields}>
                {trip.stops.map((token, index) => (
                  <div key={index} className={`${styles.stopRow} ${trip.stops.length > 2 ? styles.multipleStops : ""}`}>
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
                    <div className={styles.stopActions}>
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

                {trip.tripType === "round" && trip.stops.length === 2 && (
                  <p className={styles.routeNote}>
                    {returnsToPickup ? "Your round trip returns to the pickup location after the destination." : "Two-stop round trips return to your pickup location after the destination."}
                  </p>
                )}

                <button
                  type="button"
                  className={`btn btn-secondary ${styles.addStop}`}
                  onClick={addStop}
                  disabled={trip.stops.length >= MAX_TRIP_STOPS}
                >
                  <Icon name="ph-plus-circle" size={15} color="var(--color-accent)" />
                  {trip.stops.length >= MAX_TRIP_STOPS ? `Maximum ${MAX_TRIP_STOPS} stops` : "Add another stop"}
                </button>

                <p className={styles.fieldDivider}>
                  Your travel schedule
                </p>

                <div className={styles.dateFields}>
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
                    <label htmlFor="calc-time">Pickup time</label>
                    <input
                      id="calc-time"
                      className="input"
                      type="time"
                      value={trip.time}
                      onChange={(event) => update("time", event.target.value)}
                    />
                  </div>
                  <div className={`field ${styles.returnField}`}>
                    <label htmlFor="calc-return-date">Return date (optional)</label>
                    <input id="calc-return-date" className="input" type="date" min={trip.date || minDate}
                      max={isISODate(trip.date) ? addDays(trip.date, MAX_TRIP_DAYS - 1) : undefined}
                      value={trip.returnDate ?? ""} onChange={(event) => update("returnDate", event.target.value)} />
                  </div>
                </div>
                <ResponsiveDisclosure id="calc-options" title="Additional trip details" headingLevel={3} defaultOpen={Boolean(trip.customerPlace || trip.haltHours)} className={styles.options}>
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
                <div className={styles.optionalField}>
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
                </div>
                </ResponsiveDisclosure>
              </div>
            </section>



            {/* ── SECTION 2: VEHICLE & PACKAGE ─────────────────────── */}
            <section
              id="calc-vehicle" className={`${styles.step} ${styles.vehicleSection}`} data-current={activeStep === "vehicle"} onFocusCapture={() => setActiveStep("vehicle")} tabIndex={-1} aria-labelledby="calc-vehicle-heading"
            >
              <div className={styles.sectionTitle}>
                <span className={styles.stepNumber} aria-hidden="true">
                  2
                </span>
                <h2 id="calc-vehicle-heading">
                  Car &amp; package
                </h2>
              </div>

              <div className={styles.vehiclePreview}>
                <Media src={heroImage(resolved.car)} alt={resolved.car.name} placeholder={resolved.car.name} className={styles.vehiclePhoto} sizes="(max-width: 639px) 96px, 130px" />
                <div className={styles.vehicleCaption}><strong>{resolved.car.name}</strong><span>{resolved.car.seats} seats / {resolved.car.transmission}</span></div>
              </div>

              {/* Searchable Car Combobox */}
              <div className={styles.vehicleSearch}>
                <label
                  htmlFor="calc-car"
                  className={styles.vehicleLabel}
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

              {/* Package Selection */}
              <div className={styles.packageSection}>
                <p className={styles.fieldDivider}>Choose your package</p>
                <div className={styles.packages}>
                  {catalog.packages.map((pkg) => {
                    const active = pkg.slug === trip.packageSlug;
                    const price = carPrice(catalog, resolved.car, pkg);
                    return (
                      <button
                        key={pkg.slug}
                        type="button"
                        onClick={() => update("packageSlug", pkg.slug)}
                        aria-pressed={active}
                        className={`${styles.package} ${active ? styles.packageActive : ""}`}
                      >
                        <span className={styles.packageHeading}><Icon name={pkg.icon} size={18} /><span>{active ? "Selected" : "Select package"}</span><Icon name={active ? "ph-check-circle" : "ph-circle"} size={17} /></span>
                        <strong className={styles.packageName}>{pkg.label}</strong>
                        <span className={styles.packageDescription}>{pkg.sub}</span>
                        <span className={styles.packagePrice}>{formatINR(price)}<small>Base package rate</small></span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Night Charge Advisory */}
              <div className={styles.nightNote}>
                <Icon name="ph-moon-stars" size={16} color="var(--color-accent)" />
                <span>
                  {!trip.time ? "Choose a pickup time to check night charges." : quote.nightStart
                    ? `Night pickup charge applies (${nightWindowLabel(catalog.settings.pricingRules)}).`
                    : "No pickup-time night charge applies."}
                </span>
              </div>

            </section>

          <aside id="calc-quote" className={styles.quote} data-current={activeStep === "quote"} onFocusCapture={() => setActiveStep("quote")} tabIndex={-1} aria-label="Live journey estimate">
            <div className={styles.quoteHeader}>
              <div className={styles.sectionTitle}><span className={styles.stepNumber} aria-hidden="true">3</span><div><p className={styles.quoteHeading}>Live estimate</p><h2>Your quote</h2></div></div>
              <Media src={heroImage(resolved.car)} alt={resolved.car.name} placeholder={resolved.car.name} className={styles.quotePhoto} sizes="76px" />
            </div>
            <div className={styles.quoteType}><span>{resolved.car.name}</span><span className="tag tag-accent">{tripTypeLabel(trip.tripType)}</span></div>
            <div className={styles.mobileTotal}><span>Estimated total</span><strong>{formatINR(quote.total)}</strong></div>
            <p className={styles.quoteRoute}>
              {routeLine}
            </p>
            <p className={styles.selectedPackage}>{activePackage?.label} <span>· {resolved.city.name} base</span></p>

            <div className={styles.quoteMetrics}>
              <div>
                <span>Full distance</span>
                <strong>
                  {resolved.complete ? `${quote.km} km` : "—"}
                </strong>
                {resolved.complete && resolved.transferKm > 0 && (
                  <small>
                    incl. {Math.round(resolved.transferKm)} km transfer
                  </small>
                )}
              </div>
              <div>
                <span>Trip duration</span>
                <strong>{resolved.complete ? `${quote.hours} hr` : "—"}</strong>
              </div>
              <div>
                <span>Package covers</span>
                <strong>
                  {quote.includedKm} km / {quote.includedHours} hr
                </strong>
              </div>
            </div>
            <div className={styles.quoteLines}>
            <QuoteLines
              quote={quote}
              gstPercent={catalog.settings.gstPercent}
              showSubtotal
              totalLabel="Estimated total"
            />
            </div>

            <p className={styles.quoteNotice}>
              <Icon name="ph-info" size={15} color="var(--color-accent)" />
              <span>
                This is an <strong>estimated rate</strong>. Final pricing and car availability
                confirmed by our team.
              </span>
            </p>

            <p className={styles.quoteHelp}>
              Review the inclusions and charges in your booking summary before sending.
            </p>

            <div className={styles.quoteActions}>
              {!bookingPrompt ? (
                <Link
                  href={summaryHref}
                  prefetch={false}
                  className={`btn btn-solid ${styles.reviewAction}`}
                >
                  Review &amp; confirm on WhatsApp
                  <Icon name="ph-arrow-right" size={16} />
                </Link>
              ) : (
                <button
                  type="button"
                  className={`btn btn-solid ${styles.reviewAction}`}
                  aria-describedby="calc-booking-guidance"
                  disabled
                >
                  Review &amp; confirm on WhatsApp
                </button>
              )}
              {bookingPrompt && <p id="calc-booking-guidance" className={styles.bookingGuidance}>{bookingPrompt}</p>}

              <div className={styles.confirmationTerms}>
                <span className="inline-flex items-center gap-1">
                  <Icon name="ph-lock-simple" size={13} />
                  No payment on site
                </span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="ph-currency-inr" size={13} />
                  Indicative advance {formatINR(quote.advance)}
                </span>
              </div>
            </div>
          </aside>
            </div>
          {resolved.complete && <ResponsiveDisclosure id="calc-distance" title="How the distance is calculated" hideTitleOnDesktop className={styles.distancePanel}><RouteDistanceBreakdown resolved={resolved} /></ResponsiveDisclosure>}
          </div>
            <ResponsiveDisclosure id="calc-map" title="Route map & live distance" hideTitleOnDesktop className={styles.mapDisclosure}>
            <section
              className={`${styles.step} ${styles.mapPanel}`} tabIndex={-1} aria-labelledby="calc-map-heading"
            >
              <div className={styles.mapHeading}>
                <div>
                  <p className={styles.mapKicker}>Your journey at a glance</p>
                  <h2 id="calc-map-heading">Route Map &amp; Live Distance</h2>
                </div>
                <span className={styles.mapStatus}>
                  <Icon name="ph-path" size={14} />
                  {resolved.complete && routing ? "Updating route" : resolved.routed ? "Road route" : "Route preview"}
                </span>
              </div>

              <div className={styles.map}>
                <RouteMap
                  fill
                  stops={resolved.stops}
                  previewCenter={garage ? [garage.lat, garage.lng] : undefined}
                  path={routed?.path}
                />
              </div>

              <div className={styles.mapSummary}>
                <div><span>Full journey</span><strong>{resolved.complete ? `${quote.km.toLocaleString("en-IN")} km` : "Add your route"}</strong></div>
                <div><span>{resolved.drivingMinutes ? "Driving time" : "Vehicle base"}</span><strong>{resolved.drivingMinutes ? formatDuration(resolved.drivingMinutes) : resolved.city.name}</strong></div>
              </div>
              <p className={styles.mapNote}>{mapNote}</p>
            </section>
            </ResponsiveDisclosure>
        </div>
      </div>

      {/* Mobile Fixed Action Bar (< 1024px) */}
      <section className={`stickybar hidden max-lg:flex ${styles.mobileAction}`} aria-label="Journey action">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-neutral-500)]">
              Estimated total
            </span>
            <a
              href="#calc-quote"
              className="inline-flex items-center gap-0.5 text-[10.5px] text-[var(--color-accent-300)] underline"
            >
              Details
            </a>
          </div>
          <span className="font-[family-name:var(--font-heading)] text-[20px] font-semibold text-[var(--color-accent-300)]">
            {formatINR(quote.total)}
          </span>
        </div>

        <Link
          href={bookingPrompt ? "#calc-route" : summaryHref}
          prefetch={false}
          className="btn btn-solid min-h-[44px] px-5"
          onClick={(event) => { if (bookingPrompt) { event.preventDefault(); focusMissingDetail(); } }}
        >
          <span>{!bookingPrompt ? "Review & send" : "Complete trip details"}</span>
          <Icon name="ph-arrow-right" size={15} />
        </Link>
      </section>
    </>
  );
}
