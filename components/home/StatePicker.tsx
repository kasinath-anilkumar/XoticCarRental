"use client";

import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { filterByZone, ZONES, type IndiaZone } from "@/lib/geo/zones";

export interface StateCity {
  slug: string;
  name: string;
  state: string;
}

/**
 * Scalable Pan-India Zone, State & City Navigator.
 *
 * Replaces the static horizontal button row with a structured 4-zone hierarchy
 * (North, South, West, East & Central) and real-time search, supporting
 * 28 states & 8 UTs seamlessly across mobile and desktop.
 */
export function StatePicker({
  cities,
  onPick,
}: {
  cities: StateCity[];
  onPick: (citySlug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeZone, setActiveZone] = useState<IndiaZone>("all");
  const [activeState, setActiveState] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const matchingCities = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      return filterByZone(cities, activeZone);
    }
    return cities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
    );
  }, [cities, activeZone, query]);

  const availableStates = useMemo(() => {
    return [...new Set(matchingCities.map((c) => c.state))];
  }, [matchingCities]);

  if (!open) {
    return (
      <button
        type="button"
        className="flex cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent p-0 text-inherit [font:inherit] hover:text-accent-text max-md:min-h-[44px]"
        onClick={() => setOpen(true)}
      >
        <Icon name="ph-map-trifold" size={14} color="var(--color-accent)" />
        <span>Explore by state / zone</span>
      </button>
    );
  }

  return (
    <div className="order-1 flex flex-[1_0_100%] flex-col gap-3 rounded-lg border border-[var(--color-divider)] bg-surface p-4 shadow-sm">
      {/* Top Bar: Title, Search, and Close */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-divider)] pb-3">
        <div className="flex items-center gap-2">
          <Icon name="ph-map-trifold" size={16} color="var(--color-accent)" />
          <span className="text-[13px] font-semibold text-text">Pan-India State &amp; Hub Navigator</span>
        </div>

        <button
          type="button"
          className="cursor-pointer rounded-sm border-0 bg-transparent p-1 text-inherit opacity-70 hover:opacity-100"
          onClick={() => {
            setOpen(false);
            setActiveState(null);
            setQuery("");
          }}
          aria-label="Close the state navigator"
        >
          <Icon name="ph-x" size={15} />
        </button>
      </div>

      {/* Search Input & Zone Tabs */}
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter state or city (e.g. Maharashtra, Mumbai, Delhi)..."
            className="input h-[34px] w-full pl-8 text-[12px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-[var(--color-neutral-400)] hover:text-text cursor-pointer"
            >
              <Icon name="ph-x" size={11} />
            </button>
          )}
        </div>

        {/* Zone Pills (active when no text query) */}
        {!query && (
          <div className="flex flex-wrap items-center gap-1.5">
            {ZONES.map((zone) => {
              const active = activeZone === zone.key;
              const zoneCitiesCount = filterByZone(cities, zone.key).length;
              return (
                <button
                  key={zone.key}
                  type="button"
                  onClick={() => {
                    setActiveZone(zone.key);
                    setActiveState(null);
                  }}
                  className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                    active
                      ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-xs"
                      : "border border-[var(--color-divider)] bg-well text-[var(--color-neutral-400)] hover:border-[var(--color-accent)] hover:text-text"
                  }`}
                >
                  {zone.shortLabel} ({zoneCitiesCount})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* State Pills Grid */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {availableStates.map((name) => {
          const stateCount = cities.filter((c) => c.state === name).length;
          const isSelected = activeState === name;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={isSelected}
              className={`cursor-pointer rounded-full border px-3 py-1 text-[12px] transition-all ${
                isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-900)] font-semibold text-text shadow-xs"
                  : "border-[var(--color-divider)] bg-well text-[var(--color-neutral-300)] hover:border-[var(--color-accent)] hover:text-text"
              }`}
              onClick={() => setActiveState(isSelected ? null : name)}
            >
              <span>{name}</span>
              <span className="ml-1.5 text-[10.5px] opacity-70">({stateCount})</span>
            </button>
          );
        })}
        {availableStates.length === 0 && (
          <span className="py-2 text-[12px] text-[var(--color-neutral-400)]">
            No states found matching &quot;{query}&quot;.
          </span>
        )}
      </div>

      {/* Selected State's Cities or Direct Query Matches */}
      {(activeState || query) && (
        <div className="mt-1 rounded-md border border-[var(--color-divider)] bg-well p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-[var(--color-neutral-400)]">
            <span>
              {activeState ? `Pickup hubs in ${activeState}:` : `Cities matching "${query}":`}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-accent-300)]">
              1-tap pickup selection
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {cities
              .filter((city) => (activeState ? city.state === activeState : matchingCities.includes(city)))
              .map((city) => (
                <button
                  key={city.slug}
                  type="button"
                  className="flex items-center gap-2 rounded-md border border-[var(--color-divider)] bg-surface p-2.5 text-left text-[12.5px] font-medium text-text transition-all hover:border-[var(--color-accent)] hover:shadow-xs cursor-pointer"
                  onClick={() => {
                    onPick(city.slug);
                    setOpen(false);
                    setActiveState(null);
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
      )}
    </div>
  );
}
