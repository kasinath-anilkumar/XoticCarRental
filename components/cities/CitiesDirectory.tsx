"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Media } from "@/components/ui/Media";
import { formatINR } from "@/lib/format";
import { filterServiceCities, serviceStates } from "@/lib/service-areas";

export interface CityDirectoryItem {
  slug: string;
  name: string;
  state: string;
  multiplier: number;
  heroImage: string | null;
  carCount: number;
  basedCount: number;
  pickupsCount: number;
  airportName: string | null;
  fromPrice: number | null;
  topRoute: { name: string; km: number; price: number } | null;
  fares: Array<{
    name: string;
    fromSlug: string;
    toSlug: string;
    packageSlug: string;
    km: number;
    price: number;
  }>;
}

export interface CitiesDirectoryProps {
  cities: CityDirectoryItem[];
  states: string[];
  totalRoutes: number;
  defaultPackageLabel: string;
  gstPercent: number;
}

const PAGE_SIZE = 12;

/** Published service-city search with state filters and progressive rendering. */
export function CitiesDirectory({
  cities,
  states,
  totalRoutes,
  defaultPackageLabel,
  gstPercent: _gstPercent,
}: CitiesDirectoryProps) {
  const [activeState, setActiveState] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  const filteredCities = useMemo(() => filterServiceCities(cities, activeState, searchQuery), [cities, activeState, searchQuery]);
  const availableStates = useMemo(() => serviceStates(cities), [cities]);

  const visibleCities = useMemo(() => {
    return filteredCities.slice(0, visibleCount);
  }, [filteredCities, visibleCount]);

  return (
    <div>
      {/* Pan-India Fleet & Hubs Metrics Strip */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 max-md:mb-5">
        <div className="rounded-lg border border-[var(--color-divider)] bg-surface p-3.5 shadow-xs">
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-neutral-500)]">Service coverage</p>
          <p className="font-[family-name:var(--font-heading)] text-[22px] font-semibold text-text max-md:text-[18px]">
            {cities.length} cities
          </p>
          <p className="text-[10.5px] text-[var(--color-neutral-400)]">Published service areas</p>
        </div>
        <div className="rounded-lg border border-[var(--color-divider)] bg-surface p-3.5 shadow-xs">
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-neutral-500)]">Geographic Reach</p>
          <p className="font-[family-name:var(--font-heading)] text-[22px] font-semibold text-text max-md:text-[18px]">
            {states.length} states
          </p>
          <p className="text-[10.5px] text-[var(--color-neutral-400)]">Across our service cities</p>
        </div>
        <div className="rounded-lg border border-[var(--color-divider)] bg-surface p-3.5 shadow-xs">
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-neutral-500)]">Published fleet</p>
          <p className="font-[family-name:var(--font-heading)] text-[22px] font-semibold text-[var(--color-accent-300)] max-md:text-[18px]">
            {cities.reduce((total, city) => total + city.basedCount, 0)} cars
          </p>
          <p className="text-[10.5px] text-[var(--color-neutral-400)]">Chauffeur-driven luxury</p>
        </div>
        <div className="rounded-lg border border-[var(--color-divider)] bg-surface p-3.5 shadow-xs">
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-neutral-500)]">Route fares</p>
          <p className="font-[family-name:var(--font-heading)] text-[22px] font-semibold text-text max-md:text-[18px]">
            {totalRoutes} routes
          </p>
          <p className="text-[10.5px] text-[var(--color-neutral-400)]">Published journey estimates</p>
        </div>
      </div>

      {/* Configured state choices and city search */}
      <div className="mb-6 space-y-3.5 border-b border-[var(--color-divider)] pb-6 max-md:mb-4 max-md:pb-4">
        {/* State and live search controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="field min-w-[220px] flex-1">
            <span>State or territory</span>
            <select className="input min-h-[44px]" value={activeState} onChange={(event) => { setActiveState(event.target.value); setVisibleCount(PAGE_SIZE); }}>
              <option value="all">All states</option>
              {availableStates.map((state) => <option key={state.name} value={state.name}>{state.name} ({state.count})</option>)}
            </select>
          </label>

          {/* Instant Search Bar */}
          <div className="relative flex min-w-[260px] items-center max-md:w-full">
            <span className="pointer-events-none absolute left-3 flex text-[var(--color-neutral-500)]">
              <Icon name="ph-magnifying-glass" size={15} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Search service cities or airports"
              aria-label="Search service cities or airports"
              className="input w-full pl-9 pr-8 text-[13px] min-h-[38px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 flex text-[var(--color-neutral-400)] hover:text-text cursor-pointer"
                aria-label="Clear search"
              >
                <Icon name="ph-x" size={13} />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* City Results Header */}
      <div className="mb-4 flex items-center justify-between text-[12px] text-[var(--color-neutral-500)]">
        <output>
          Showing {visibleCities.length} of {filteredCities.length} operational hubs
          {activeState !== "all" ? ` in ${activeState}` : ""}{searchQuery ? ` matching "${searchQuery}"` : ""}
        </output>
        <span className="max-md:hidden">Base fares include car, chauffeur &amp; fuel</span>
      </div>

      {/* Grid of City Destination Cards */}
      {visibleCities.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleCities.map((city) => (
            <article
              key={city.slug}
              className="group flex flex-col overflow-hidden rounded-lg border border-[var(--color-divider)] bg-surface shadow-sm transition-all hover:border-[var(--color-accent)] hover:shadow-md"
            >
              {/* Card Hero Media */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-slot">
                <Media
                  src={city.heroImage}
                  alt={`Chauffeur cars in ${city.name}`}
                  placeholder={city.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  icon="ph-map-pin"
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                {/* Floating Multiplier & State Tags */}
                <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                  <span className="rounded-sm bg-neutral-900/80 px-2 py-0.5 text-[10px] font-medium text-neutral-200 backdrop-blur-xs">
                    {city.state}
                  </span>
                  <span className="rounded-sm bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-accent-ink)]">
                    ×{city.multiplier.toFixed(2)} rate card
                  </span>
                </div>

                {/* Bottom Overlay: City Name & Airport */}
                <div className="absolute right-3 bottom-2.5 left-3">
                  <Link
                    href={`/cities/${city.slug}`}
                    className="font-[family-name:var(--font-heading)] text-[20px] font-medium text-white hover:text-[var(--color-accent-300)] no-underline"
                  >
                    {city.name}
                  </Link>
                  {city.airportName && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-300 truncate">
                      <Icon name="ph-airplane-takeoff" size={11} color="var(--color-accent)" />
                      <span>{city.airportName}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Card Body & Pricing Details */}
              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  {/* Fleet Stats Strip */}
                  <div className="flex items-center justify-between border-b border-[var(--color-divider)] pb-2.5 text-[11px] text-[var(--color-neutral-400)]">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="ph-car" size={13} color="var(--color-accent)" />
                      {city.basedCount} cars based
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="ph-map-pin" size={13} />
                      {city.pickupsCount} pickup points
                    </span>
                  </div>

                  {/* Starting Rate Row */}
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-[11px] text-[var(--color-neutral-500)]">
                      {defaultPackageLabel}
                    </span>
                    <div className="text-right">
                      <span className="text-[10px] text-[var(--color-neutral-400)] mr-1">from</span>
                      <span className="font-[family-name:var(--font-heading)] text-[17px] font-semibold text-[var(--color-accent-300)] tabular-nums">
                        {city.fromPrice ? formatINR(city.fromPrice) : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Top Popular Route Highlight */}
                  {city.topRoute && (
                    <div className="mt-2.5 rounded-md bg-well p-2 text-[11px]">
                      <div className="flex items-center justify-between text-[var(--color-neutral-400)]">
                        <span className="truncate pr-2">Most requested: {city.topRoute.name}</span>
                        <span className="shrink-0 font-medium text-text">{formatINR(city.topRoute.price)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="mt-4 grid grid-cols-2 gap-2 pt-2 border-t border-[var(--color-divider)]">
                  <Link
                    href={`/cities/${city.slug}`}
                    className="btn btn-outline min-h-[36px] py-1.5 text-[11.5px] justify-center"
                  >
                    <span>Hub details</span>
                  </Link>
                  <Link
                    href={`/cars?city=${city.slug}`}
                    className="btn btn-primary min-h-[36px] py-1.5 text-[11.5px] justify-center"
                  >
                    <span>View fleet</span>
                    <Icon name="ph-arrow-right" size={12} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--color-divider)] bg-surface p-12 text-center shadow-xs">
          <Icon name="ph-map-pin" size={32} color="var(--color-neutral-500)" />
          <p className="mt-3 font-[family-name:var(--font-heading)] text-[18px] font-medium">
            No hubs found matching &quot;{searchQuery}&quot;
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-neutral-400)]">
            Try another published service area, or contact our team to check your destination.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setVisibleCount(PAGE_SIZE);
              setActiveState("all");
            }}
            className="btn btn-outline mt-4 inline-flex text-[12px]"
          >
            Clear filters &amp; view all hubs
          </button>
        </div>
      )}

      {/* Progressive Load More Hubs Button (if more cities remain) */}
      {filteredCities.length > visibleCount && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="btn btn-outline min-h-[44px] px-8 text-[13px] font-medium inline-flex items-center gap-2"
          >
            <span>Show more hubs ({filteredCities.length - visibleCount} remaining)</span>
            <Icon name="ph-caret-down" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
