"use client";

import { useMemo, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { formatINR } from "@/lib/format";
import { rateFor } from "@/lib/pricing";
import type { Car, City, Package, SiteSettings } from "@/lib/types";
import {
  saveCustomerLocation,
  useCustomerLocation,
} from "@/lib/userLocation";
import { filterByZone, ZONES, type IndiaZone } from "@/lib/geo/zones";

export interface RateCardProps {
  car: Car;
  cities: City[];
  packages: Package[];
  settings: SiteSettings;
  /** The car's home city — where the switcher starts if nothing else is selected. */
  homeCitySlug: string;
  weddingSurcharge: number;
}

/**
 * Everything this car costs, in one table.
 *
 * Replaces the legacy <select> dropdown with a responsive, searchable
 * location selector that automatically detects and applies the customer's
 * location selected from the home page. If not selected, provides an
 * instant search and state filter chips to pick the destination city.
 */
export function RateCard({
  car,
  cities,
  packages,
  settings,
  homeCitySlug,
  weddingSurcharge,
}: RateCardProps) {
  const { location: customerLocation } = useCustomerLocation();

  // Check URL query param ?city= as initial override if present
  const [overrideCitySlug, setOverrideCitySlug] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const urlCity = new URLSearchParams(window.location.search).get("city");
      if (urlCity && cities.some((c) => c.slug === urlCity)) {
        return urlCity;
      }
    }
    return null;
  });

  // Determine current active city: manual override -> customer location from home -> home garage base
  const effectiveCitySlug = useMemo(() => {
    if (overrideCitySlug && cities.some((c) => c.slug === overrideCitySlug)) {
      return overrideCitySlug;
    }
    if (customerLocation?.citySlug && cities.some((c) => c.slug === customerLocation.citySlug)) {
      return customerLocation.citySlug;
    }
    return homeCitySlug;
  }, [overrideCitySlug, customerLocation, cities, homeCitySlug]);

  const isFromHome = Boolean(
    customerLocation?.citySlug &&
    effectiveCitySlug === customerLocation.citySlug &&
    customerLocation.isFromHome
  );

  // If no customer location was chosen from home, show search module initially
  const [isSearching, setIsSearching] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const urlCity = new URLSearchParams(window.location.search).get("city");
      if (urlCity) return false;
    }
    return !customerLocation?.citySlug;
  });

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeZone, setActiveZone] = useState<IndiaZone>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const city = useMemo(
    () => cities.find((c) => c.slug === effectiveCitySlug) ?? cities[0],
    [cities, effectiveCitySlug]
  );

  const availableStates = useMemo(() => {
    const zoneCities = filterByZone(cities, activeZone);
    return [...new Set(zoneCities.map((c) => c.state))];
  }, [cities, activeZone]);

  const filteredCities = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = cities;
    if (!q && activeZone !== "all") {
      result = filterByZone(result, activeZone);
    }
    if (!q && selectedState !== "all") {
      result = result.filter((c) => c.state === selectedState);
    }
    if (q) {
      result = cities.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q)
      );
    }
    return result;
  }, [cities, activeZone, selectedState, searchQuery]);

  const handleSelectCity = (selected: City) => {
    setOverrideCitySlug(selected.slug);
    setIsSearching(false);
    setSearchQuery("");

    // Persist choice so other pages and calculators stay in sync
    saveCustomerLocation({
      citySlug: selected.slug,
      cityName: selected.name,
      state: selected.state,
      isFromHome: true,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header and Active Location Status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-[24px] font-medium max-md:text-[20px]">Rate card</h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-neutral-400)]">
            Package rates reflect local operating multipliers. Tolls, parking and permits at actuals.
          </p>
        </div>

        {/* Selected Location Pill (Visible when not actively searching) */}
        {!isSearching && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-accent-800)] bg-[var(--color-accent-900)]/70 py-1.5 pr-3 pl-3 shadow-xs">
              <span className="grid size-6 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-ink)]">
                <Icon name="ph-map-pin" size={13} />
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--color-neutral-400)]">
                    Rates for
                  </span>
                  {isFromHome ? (
                    <span className="rounded bg-[var(--color-accent-900)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-[var(--color-accent-300)] border border-[var(--color-accent-800)]">
                      Selected from trip
                    </span>
                  ) : (
                    <span className="rounded bg-[var(--color-neutral-800)] px-1.5 py-0.5 text-[9.5px] text-[var(--color-neutral-300)]">
                      Garage base
                    </span>
                  )}
                </div>
                <span className="text-[13.5px] font-semibold text-text">
                  {city.name}, {city.state}{" "}
                  <span className="text-[11.5px] font-medium text-[var(--color-accent-300)]">
                    (×{city.multiplier.toFixed(2)})
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSearching(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="ml-2 inline-flex items-center gap-1 rounded-md border border-[var(--color-divider)] bg-surface px-2.5 py-1 text-[11.5px] font-medium text-[var(--color-neutral-300)] hover:border-[var(--color-accent)] hover:text-text cursor-pointer transition-colors"
                aria-label="Search and select a different location"
              >
                <Icon name="ph-magnifying-glass" size={12} />
                <span>Change</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Location Search Box (When searching, or if no location set yet) */}
      {isSearching && (
        <div className="rounded-lg border border-[var(--color-divider)] bg-surface p-4 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full bg-[var(--color-accent-900)] text-[var(--color-accent-300)]">
                <Icon name="ph-magnifying-glass" size={13} />
              </span>
              <span className="text-[13px] font-semibold text-text">
                {isFromHome
                  ? "Change rate card city"
                  : "Search & select your destination city for exact local rates"}
              </span>
            </div>
            {/* Allow collapsing if already has an active selection */}
            {effectiveCitySlug && (
              <button
                type="button"
                onClick={() => setIsSearching(false)}
                className="inline-flex items-center gap-1 text-[11.5px] text-[var(--color-neutral-400)] hover:text-text cursor-pointer"
              >
                <span>Done</span>
                <Icon name="ph-x" size={12} />
              </button>
            )}
          </div>

          {/* Search Input Bar */}
          <div className="relative mb-3">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <Icon name="ph-magnifying-glass" size={14} color="var(--color-neutral-500)" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city (e.g. Kochi, Bengaluru, Madurai, Coimbatore...)"
              className="input w-full pl-9 pr-8 text-[13px] min-h-[40px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-2.5 flex items-center text-[var(--color-neutral-400)] hover:text-text cursor-pointer"
                aria-label="Clear search"
              >
                <Icon name="ph-x" size={13} />
              </button>
            )}
          </div>

          {/* Zone & State Filter Controls */}
          {!searchQuery && (
            <div className="mb-3 space-y-2">
              {/* Zone Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[var(--color-neutral-500)] mr-1">Zone:</span>
                {ZONES.map((z) => {
                  const active = activeZone === z.key;
                  return (
                    <button
                      key={z.key}
                      type="button"
                      onClick={() => {
                        setActiveZone(z.key);
                        setSelectedState("all");
                      }}
                      className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] transition-all ${
                        active
                          ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-semibold shadow-xs"
                          : "bg-well text-[var(--color-neutral-400)] hover:text-text border border-[var(--color-divider)]"
                      }`}
                    >
                      {z.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* Sub-State Pills (if zone has states) */}
              {availableStates.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-[var(--color-neutral-500)] mr-1">State:</span>
                  {["all", ...availableStates].map((s) => {
                    const active = selectedState === s;
                    const label = s === "all" ? "All in Zone" : s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedState(s)}
                        className={`cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] transition-all ${
                          active
                            ? "bg-[var(--color-accent-900)] text-[var(--color-accent-300)] font-semibold border border-[var(--color-accent)]"
                            : "bg-well text-[var(--color-neutral-400)] hover:text-text border border-[var(--color-divider)]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Filtered Cities Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 max-h-[220px] overflow-y-auto pr-1">
            {filteredCities.map((c) => {
              const active = c.slug === effectiveCitySlug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => handleSelectCity(c)}
                  className={`flex items-center justify-between gap-2 rounded-md border p-2.5 text-left transition-all cursor-pointer ${
                    active
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-900)] text-text shadow-xs"
                      : "border-[var(--color-divider)] bg-well text-text hover:border-[var(--color-accent)]"
                  }`}
                >
                  <div className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{c.name}</span>
                    <span className="block truncate text-[10.5px] text-[var(--color-neutral-500)]">
                      {c.state} · ×{c.multiplier.toFixed(2)}
                    </span>
                  </div>
                  {active && (
                    <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-ink)]">
                      <Icon name="ph-check" size={10} />
                    </span>
                  )}
                </button>
              );
            })}
            {filteredCities.length === 0 && (
              <div className="col-span-full py-4 text-center text-[12px] text-[var(--color-neutral-400)]">
                No cities found matching &quot;{searchQuery}&quot;. Try another search term.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rates Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--color-divider)] bg-surface">
        <table className="table">
          <thead>
            <tr>
              <th>Charge</th>
              <th>Rate</th>
              <th style={{ textAlign: "right" }}>When it applies</th>
            </tr>
          </thead>
          <tbody>
            <tr className="[&_td]:pt-[14px] [&_td]:text-[11px] [&_td]:tracking-[0.08em] [&_td]:uppercase [&_td]:text-[var(--color-neutral-500)]">
              <td colSpan={3}>
                Packages — {city.name} ({city.state}) ×{city.multiplier.toFixed(2)} multiplier
              </td>
            </tr>
            {packages.map((pkg) => (
              <tr key={pkg.slug}>
                <td>{pkg.label}</td>
                <td className="whitespace-nowrap tabular-nums text-accent-text font-semibold">
                  {formatINR(rateFor(car, pkg.rateKey) * city.multiplier)}
                </td>
                <td className="text-right text-[12px] text-[var(--color-neutral-500)]">{pkg.sub}</td>
              </tr>
            ))}

            <tr className="[&_td]:pt-[14px] [&_td]:text-[11px] [&_td]:tracking-[0.08em] [&_td]:uppercase [&_td]:text-[var(--color-neutral-500)]">
              <td colSpan={3}>Beyond the package — same in every city</td>
            </tr>
            <tr>
              <td>Extra distance</td>
              <td className="whitespace-nowrap tabular-nums text-accent-text">{formatINR(car.extraKmRate)} / km</td>
              <td className="text-right text-[12px] text-[var(--color-neutral-500)]">Past the package km</td>
            </tr>
            <tr>
              <td>Extra time</td>
              <td className="whitespace-nowrap tabular-nums text-accent-text">{formatINR(car.extraHrRate)} / hr</td>
              <td className="text-right text-[12px] text-[var(--color-neutral-500)]">Past the package hours</td>
            </tr>
            <tr>
              <td>Driver bata</td>
              <td className="whitespace-nowrap tabular-nums text-accent-text">{formatINR(car.bata)} / day</td>
              <td className="text-right text-[12px] text-[var(--color-neutral-500)]">His food and stay</td>
            </tr>
            <tr>
              <td>Night charge</td>
              <td className="whitespace-nowrap tabular-nums text-accent-text">{formatINR(car.nightCharge)}</td>
              <td className="text-right text-[12px] text-[var(--color-neutral-500)]">Pickup 10pm–6am, or an overnight halt</td>
            </tr>
            <tr>
              <td>Wedding handling</td>
              <td className="whitespace-nowrap tabular-nums text-accent-text">{formatINR(weddingSurcharge)}</td>
              <td className="text-right text-[12px] text-[var(--color-neutral-500)]">Decor clearance and morning detailing</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 max-w-[68ch] text-[12px] text-[var(--color-neutral-500)]">
        Package rates carry {city.name}&rsquo;s ×{city.multiplier.toFixed(2)} operating multiplier.
        Extra km, extra hours, bata and the night charge are the car&rsquo;s own rates and are the
        same everywhere. {settings.gstPercent}% GST applies to the total; tolls, parking and permits
        are at actuals.
      </p>
    </div>
  );
}
