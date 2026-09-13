"use client";

import { useId, useMemo, useRef, useState, useEffect } from "react";

import { Icon } from "@/components/ui/Icon";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { Media } from "@/components/ui/Media";
import { formatINR } from "@/lib/format";
import { carPrice, heroImage, homeCity, packageBySlug, type Catalog } from "@/lib/catalog";
import type { Car } from "@/lib/types";

export interface CarSearchProps {
  catalog: Catalog;
  selectedCarSlug: string;
  onSelectCar: (carSlug: string) => void;
  packageSlug?: string;
  id?: string;
  className?: string;
}

/**
 * Interactive car search and selection combobox for Transparent Pricing.
 *
 * Replaces the static native <select> dropdown with an instant, searchable
 * vehicle selector. Allows filtering by brand, model, body type, home city,
 * seating capacity, and fuel/transmission. Includes quick-filter category pills,
 * visual vehicle thumbnails, home-city indicators, and package price previews.
 */
export function CarSearch({
  catalog,
  selectedCarSlug,
  onSelectCar,
  packageSlug,
  id,
  className = "",
}: CarSearchProps) {
  const generatedId = useId();
  const inputId = id ?? `car-search-${generatedId}`;
  const listboxId = `car-listbox-${generatedId}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  // Resolved current package for live price previews in the dropdown
  const currentPkg = useMemo(() => {
    if (packageSlug) return packageBySlug(catalog, packageSlug);
    return catalog.packages[0];
  }, [catalog, packageSlug]);

  // Resolve currently selected car
  const selectedCar = useMemo(() => {
    return catalog.cars.find((c) => c.slug === selectedCarSlug) ?? catalog.cars[0];
  }, [catalog, selectedCarSlug]);

  const selectedCity = selectedCar ? homeCity(catalog, selectedCar) : null;

  // Distinct car types for quick-filter pills
  const carTypes = useMemo(() => {
    const types = [...new Set(catalog.cars.map((c) => c.type))];
    return ["all", ...types];
  }, [catalog]);

  // Filtered cars matching search query and active category
  const filteredCars = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

    return catalog.cars.filter((car) => {
      // Filter by category pill if selected
      if (selectedType !== "all" && car.type.toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }

      if (words.length === 0) return true;

      const city = homeCity(catalog, car);
      const searchableString = [
        car.name,
        car.type,
        car.badge,
        city.name,
        city.state,
        `${car.seats} seats`,
        `${car.seats} seater`,
        car.transmission,
        car.fuel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return words.every((word) => searchableString.includes(word));
    });
  }, [catalog, query, selectedType]);

  const activeHighlightedIndex = filteredCars.length > 0
    ? Math.min(Math.max(0, highlightedIndex), filteredCars.length - 1)
    : 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const highlightedEl = listRef.current.children[activeHighlightedIndex] as HTMLElement | undefined;
    if (highlightedEl) {
      highlightedEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeHighlightedIndex, isOpen]);

  const handleSelect = (car: Car) => {
    onSelectCar(car.slug);
    setIsOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredCars.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % filteredCars.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredCars.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + filteredCars.length) % filteredCars.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCars[activeHighlightedIndex]) {
        handleSelect(filteredCars[activeHighlightedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setQuery("");
    }
  };

  const displayValue = isOpen
    ? query
    : selectedCar
      ? `${selectedCar.name} — ${selectedCity?.name ?? ""}`
      : "";

  return (
    <div ref={containerRef} className={`relative w-full max-w-[440px] ${className}`}>
      {/* Combobox Search Input */}
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-[12px] flex text-[var(--color-accent)]">
          <Icon name="ph-magnifying-glass" size={16} />
        </span>

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          value={displayValue}
          placeholder={isOpen ? "Type car name, brand, city or type..." : "Search or pick a car..."}
          onFocus={() => {
            setIsOpen(true);
          }}
          onClick={() => {
            if (!isOpen) setIsOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedIndex(0);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="input h-[42px] w-full rounded-md border-[var(--color-divider)] bg-[var(--color-surface)] pr-[72px] pl-[38px] text-[13.5px] font-medium text-text placeholder:text-[var(--color-neutral-500)] focus:border-[var(--color-accent)] focus:outline-none"
        />

        {/* Right side buttons */}
        <div className="absolute right-[8px] flex items-center gap-1">
          {/* Clear query button */}
          {isOpen && query.length > 0 && (
            <button
              type="button"
              className="grid size-[26px] cursor-pointer place-items-center rounded text-[var(--color-neutral-400)] transition-colors hover:bg-[var(--color-neutral-800)] hover:text-text"
              aria-label="Clear car search query"
              onClick={() => {
                setQuery("");
                setHighlightedIndex(0);
                inputRef.current?.focus();
              }}
            >
              <Icon name="ph-x" size={13} />
            </button>
          )}

          {/* Chevron dropdown trigger button */}
          <button
            type="button"
            className="grid size-[28px] cursor-pointer place-items-center rounded text-[var(--color-neutral-400)] transition-colors hover:bg-[var(--color-neutral-800)] hover:text-text"
            aria-label={isOpen ? "Close car selection" : "Open car selection"}
            onClick={() => {
              setIsOpen((prev) => !prev);
              if (!isOpen) {
                inputRef.current?.focus();
              }
            }}
          >
            <Icon
              name="ph-caret-down"
              size={14}
              className={`transition-transform duration-150 ${isOpen ? "rotate-180 text-[var(--color-accent)]" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 flex max-h-[380px] flex-col overflow-hidden rounded-md border border-[var(--color-neutral-800)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
          {/* Quick Category Filter Bar */}
          <HorizontalScroll label="Vehicle categories" className="shrink-0 border-b border-[var(--color-divider)] bg-[var(--color-surface)] p-2.5" contentClassName="flex items-center gap-1.5 py-1">
            {carTypes.map((type) => {
              const isActive = selectedType === type;
              const count =
                type === "all"
                  ? catalog.cars.length
                  : catalog.cars.filter((c) => c.type === type).length;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSelectedType(type);
                    setHighlightedIndex(0);
                  }}
                  className={`flex shrink-0 cursor-pointer items-center gap-1 rounded-sm px-2.5 py-1 text-[11px] font-medium transition-all ${
                    isActive
                      ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-xs"
                      : "bg-[var(--color-neutral-900)] text-[var(--color-neutral-400)] hover:bg-[var(--color-neutral-800)] hover:text-text"
                  }`}
                >
                  <span className="capitalize">{type}</span>
                  <span className={`text-[10px] ${isActive ? "opacity-90" : "opacity-60"}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </HorizontalScroll>

          {/* Result Count Info Bar */}
          <div className="flex items-center justify-between border-b border-[var(--color-divider)] bg-[var(--color-neutral-900)]/60 px-3 py-1.5 text-[11px] text-[var(--color-neutral-500)]">
            <span>
              {query.trim().length > 0
                ? `${filteredCars.length} result${filteredCars.length === 1 ? "" : "s"} for "${query}"`
                : `${filteredCars.length} available vehicles`}
            </span>
            {currentPkg && (
              <span className="text-[10.5px] text-[var(--color-accent-400)]">
                Rates for {currentPkg.label}
              </span>
            )}
          </div>

          {/* Car Results List */}
          <ul
            ref={listRef}
            id={listboxId}
            className="scroll-shadows m-0 flex min-h-0 flex-1 list-none flex-col overflow-y-auto p-1.5"
          >
            {filteredCars.length === 0 ? (
              <li className="flex flex-col items-center justify-center gap-2 py-8 text-center text-[13px] text-[var(--color-neutral-400)]">
                <Icon name="ph-car-profile" size={32} className="text-[var(--color-neutral-600)]" />
                <p>
                  No vehicles found matching <strong className="text-text">&ldquo;{query}&rdquo;</strong>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSelectedType("all");
                    setHighlightedIndex(0);
                    inputRef.current?.focus();
                  }}
                  className="mt-1 cursor-pointer rounded-sm border border-[var(--color-divider)] px-3 py-1 text-[12px] text-[var(--color-accent-300)] hover:border-[var(--color-accent)] hover:text-text"
                >
                  Reset search & show all cars
                </button>
              </li>
            ) : (
              filteredCars.map((car, index) => {
                const isSelected = car.slug === selectedCarSlug;
                const isHighlighted = activeHighlightedIndex === index;
                const city = homeCity(catalog, car);
                const price = currentPkg ? carPrice(catalog, car, currentPkg) : null;
                const imgUrl = heroImage(car);

                return (
                  <li key={car.slug}>
                    <button
                      type="button"
                      onClick={() => handleSelect(car)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                        isSelected
                          ? "bg-[var(--color-accent-900)]/40 text-text"
                          : isHighlighted
                            ? "bg-[var(--color-neutral-800)]/70 text-text"
                            : "text-[var(--color-neutral-300)] hover:bg-[var(--color-neutral-800)]/50"
                      }`}
                    >
                      {/* Left: Thumbnail & Details */}
                      <div className="flex min-w-0 items-center gap-3">
                        {/* Vehicle Thumbnail */}
                        <div className="relative h-[34px] w-[50px] shrink-0 overflow-hidden rounded bg-[var(--color-slot)] border border-[var(--color-neutral-800)]">
                          <Media
                            src={imgUrl}
                            alt={car.name}
                            placeholder={car.name}
                            className="size-full object-cover"
                            sizes="50px"
                          />
                        </div>

                        {/* Car Name, Specs & City */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[13px] font-semibold text-text">
                              {car.name}
                            </p>
                            {car.badge && (
                              <span className="shrink-0 rounded bg-[var(--color-accent-950)] px-1.5 py-0.2 text-[9.5px] font-medium text-[var(--color-accent-300)]">
                                {car.badge}
                              </span>
                            )}
                          </div>

                          <p className="flex items-center gap-1.5 truncate text-[11px] text-[var(--color-neutral-400)]">
                            <span>{car.type}</span>
                            <span className="opacity-40">·</span>
                            <span>{car.seats} seats</span>
                            <span className="opacity-40">·</span>
                            <span className="flex items-center gap-0.5 text-[var(--color-neutral-300)]">
                              <Icon name="ph-map-pin" size={10} color="var(--color-accent)" />
                              {city.name}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Price Preview & Checkmark */}
                      <div className="flex shrink-0 items-center gap-2 text-right">
                        {price !== null && (
                          <div>
                            <p className="font-[family-name:var(--font-heading)] text-[13px] font-semibold tabular-nums text-[var(--color-accent-300)]">
                              {formatINR(price)}
                            </p>
                            <p className="text-[10px] text-[var(--color-neutral-500)]">base rate</p>
                          </div>
                        )}

                        <div className="grid size-[20px] place-items-center">
                          {isSelected ? (
                            <span className="grid size-[18px] place-items-center rounded-sm bg-[var(--color-accent)] text-[var(--color-accent-ink)]">
                              <Icon name="ph-check" size={11} />
                            </span>
                          ) : isHighlighted ? (
                            <span className="text-[var(--color-neutral-500)]">
                              <Icon name="ph-arrow-right" size={12} />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
