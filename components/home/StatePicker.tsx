"use client";

import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { filterServiceCities, serviceStates } from "@/lib/service-areas";

export interface StateCity {
  slug: string;
  name: string;
  state: string;
}

/** State options and search results come only from published service cities. */
export function StatePicker({
  cities,
  onPick,
}: {
  cities: StateCity[];
  onPick: (citySlug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeState, setActiveState] = useState("all");
  const [visibleCount, setVisibleCount] = useState(12);
  const [query, setQuery] = useState("");

  const matchingCities = useMemo(() => filterServiceCities(cities, activeState, query), [cities, activeState, query]);
  const availableStates = useMemo(() => serviceStates(cities), [cities]);

  if (!open) {
    return (
      <button
        type="button"
        className="flex cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent p-0 text-inherit [font:inherit] hover:text-accent-text max-md:min-h-[44px]"
        onClick={() => setOpen(true)}
      >
        <Icon name="ph-map-trifold" size={14} color="var(--color-accent)" />
        <span>Browse service areas</span>
      </button>
    );
  }

  return (
    <div className="order-1 flex flex-[1_0_100%] flex-col gap-3 rounded-lg border border-[var(--color-divider)] bg-surface p-4 shadow-sm">
      {/* Top Bar: Title, Search, and Close */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-divider)] pb-3">
        <div className="flex items-center gap-2">
          <Icon name="ph-map-trifold" size={16} color="var(--color-accent)" />
          <span className="text-[13px] font-semibold text-text">Browse our service cities</span>
        </div>

        <button
          type="button"
          className="cursor-pointer rounded-sm border-0 bg-transparent p-1 text-inherit opacity-70 hover:opacity-100"
          onClick={() => {
            setOpen(false);
            setActiveState("all");
            setVisibleCount(12);
            setQuery("");
          }}
          aria-label="Close the state navigator"
        >
          <Icon name="ph-x" size={15} />
        </button>
      </div>

      {/* Search and configured state options */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Icon
            name="ph-magnifying-glass"
            size={13}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--color-neutral-400)]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setVisibleCount(12); }}
            placeholder="Filter published states or cities"
            aria-label="Filter service areas"
            className="input min-h-[44px] w-full pl-8 pr-8 text-[12px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear service area search"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-[var(--color-neutral-400)] hover:text-text cursor-pointer"
            >
              <Icon name="ph-x" size={11} />
            </button>
          )}
        </div>

        <label className="field min-w-[180px] flex-1">
          <span>State or territory</span>
          <select className="input min-h-[44px]" value={activeState} onChange={(event) => { setActiveState(event.target.value); setVisibleCount(12); }}>
            <option value="all">All states</option>
            {availableStates.map((state) => <option key={state.name} value={state.name}>{state.name} ({state.count})</option>)}
          </select>
        </label>
      </div>

      {/* Selected State's Cities or Direct Query Matches */}
      <section aria-label="Service city results">
        <div className="mt-1 rounded-md border border-[var(--color-divider)] bg-well p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-[var(--color-neutral-400)]">
            <span>
              {activeState !== "all" ? `Service cities in ${activeState}:` : "Published service cities:"}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-accent-300)]">
              Browse available cars
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {matchingCities.slice(0, visibleCount).map((city) => (
                <button
                  key={city.slug}
                  type="button"
                  className="flex items-center gap-2 rounded-md border border-[var(--color-divider)] bg-surface p-2.5 text-left text-[12.5px] font-medium text-text transition-all hover:border-[var(--color-accent)] hover:shadow-xs cursor-pointer"
                  onClick={() => {
                    onPick(city.slug);
                    setOpen(false);
                    setActiveState("all");
                    setVisibleCount(12);
                    setQuery("");
                  }}
                >
                  <Icon name="ph-map-pin" size={13} color="var(--color-accent)" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate">{city.name}</span>
                    <span className="block truncate text-[10px] text-[var(--color-neutral-500)]">
                      {city.state}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </div>
        <output className="mt-3 block text-[12px] text-[var(--color-neutral-400)]">Showing {Math.min(visibleCount, matchingCities.length)} of {matchingCities.length} service cities</output>
        {matchingCities.length === 0 && <p className="mt-2 text-[12px] text-[var(--color-neutral-400)]">No published cities match these filters. Try another state or search.</p>}
        {matchingCities.length > visibleCount && <button type="button" className="btn btn-secondary mt-3 min-h-[44px] text-[12px]" onClick={() => setVisibleCount((count) => count + 12)}>Show more service cities</button>}
      </section>
    </div>
  );
}
