"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { CarCard } from "@/components/CarCard";
import { Icon } from "@/components/ui/Icon";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import type { Catalog } from "@/lib/catalog";
import type { Package } from "@/lib/types";
import styles from "./WholeFleet.module.css";

export interface WholeFleetProps {
  catalog: Catalog;
  defaultPackage: Package;
}

const FLEET_PAGE_SIZE = 6;

/**
 * Redesigned "The Whole Fleet" showcase for the homepage.
 *
 * Provides interactive category switching (All, Sedan, SUV, MUV, etc.),
 * an elevated showroom spotlight, and a responsive luxury fleet grid
 * across mobile, tablet, and desktop screens.
 */
export function WholeFleet({ catalog, defaultPackage }: WholeFleetProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(FLEET_PAGE_SIZE);
  const gridId = useId();

  const categories = useMemo(() => {
    const types = new Map<string, { key: string; label: string; count: number }>();
    for (const car of catalog.cars) {
      const key = car.type;
      const category = types.get(key);
      if (category) category.count += 1;
      else types.set(key, { key, label: car.type, count: 1 });
    }
    return [{ key: "all", label: "All Fleet", count: catalog.cars.length }, ...types.values()];
  }, [catalog.cars]);

  const filteredCars = useMemo(() => {
    if (activeCategory === "all") return catalog.cars;
    return catalog.cars.filter((car) => car.type.toLowerCase() === activeCategory.toLowerCase());
  }, [catalog.cars, activeCategory]);
  const visibleCars = filteredCars.slice(0, visibleCount);

  const uniqueHomeCitiesCount = useMemo(() => {
    return new Set(catalog.cars.map((car) => car.homeCitySlug)).size;
  }, [catalog.cars]);

  return (
    <div className={styles.fleet}>
      {/* Fleet Stats Banner */}
      <div className={styles.stats}>
        <div className="px-4 py-3.5 text-center max-md:px-2 max-md:py-2.5">
          <p className="font-[family-name:var(--font-heading)] text-[24px] font-semibold text-[var(--color-accent-300)] max-md:text-[18px]">
            {catalog.cars.length}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-[var(--color-neutral-400)] max-md:text-[9.5px]">
            Chauffeur-driven cars
          </p>
        </div>
        <div className="px-4 py-3.5 text-center max-md:px-2 max-md:py-2.5">
          <p className="font-[family-name:var(--font-heading)] text-[24px] font-semibold text-[var(--color-accent-300)] max-md:text-[18px]">
            {uniqueHomeCitiesCount}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-[var(--color-neutral-400)] max-md:text-[9.5px]">
            Home cities served
          </p>
        </div>
        <div className="px-4 py-3.5 text-center max-md:px-2 max-md:py-2.5">
          <p className="font-[family-name:var(--font-heading)] text-[24px] font-semibold text-[var(--color-accent-300)] max-md:text-[18px]">
            {catalog.packages.length}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-[var(--color-neutral-400)] max-md:text-[9.5px]">
            Rental packages
          </p>
        </div>
      </div>

      {/* Interactive Category Filter Pills */}
      <div className={styles.categories}>
        <HorizontalScroll label="Fleet categories" contentClassName={styles.categoryChoices}>
          {categories.map((category) => {
            const isActive = activeCategory === category.key;

            return (
              <button
                key={category.key}
                type="button"
                onClick={() => {
                  if (isActive) return;
                  setActiveCategory(category.key);
                  setVisibleCount(FLEET_PAGE_SIZE);
                }}
                aria-pressed={isActive}
                aria-controls={gridId}
                className={`flex max-w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-4 py-1.5 text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-xs"
                    : "border border-[var(--color-divider)] bg-surface text-[var(--color-neutral-400)] hover:border-[var(--color-accent)] hover:text-text"
                }`}
              >
                <span className="min-w-0 break-words capitalize">{category.label}</span>
                <span className="shrink-0 text-[11px]">
                  ({category.count})
                </span>
              </button>
            );
          })}
        </HorizontalScroll>

        <Link
          href={activeCategory === "all" ? "/cars" : `/cars?type=${encodeURIComponent(activeCategory)}`}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--color-accent-300)] hover:text-[var(--color-accent-200)]"
        >
          <span>Explore all with filters</span>
          <Icon name="ph-arrow-right" size={13} />
        </Link>
      </div>

      {/* Responsive Luxury Fleet Grid */}
      <div id={gridId} className={styles.grid}>
        {visibleCars.map((car) => (
          <CarCard
            key={car.slug}
            catalog={catalog}
            car={car}
            pkg={defaultPackage}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <output className="text-[13px] text-[var(--color-neutral-400)]">
          Showing {visibleCars.length} of {filteredCars.length} cars
        </output>
        {filteredCars.length > FLEET_PAGE_SIZE && (
          <button
            type="button"
            className="btn btn-secondary min-h-[44px]"
            aria-controls={gridId}
            disabled={visibleCars.length >= filteredCars.length}
            onClick={() => setVisibleCount((count) => count + FLEET_PAGE_SIZE)}
          >
            {visibleCars.length < filteredCars.length ? "Show more cars" : "All cars shown"}
          </button>
        )}
      </div>

      {/* Pricing Transparency Footnote */}
      <p className="mt-2 max-w-[85ch] text-[12px] text-[var(--color-neutral-500)]">
        {catalog.cars.length} cars across {uniqueHomeCitiesCount} cities. Starting rates reflect the{" "}
        {defaultPackage.label} package at each car&rsquo;s home-city rate, before driver&rsquo;s
        allowance and {catalog.settings.gstPercent}% GST. Use our{" "}
        <Link href="/price-calculator" className="text-[var(--color-accent-300)] underline">
          live price calculator
        </Link>{" "}
        to itemise an exact route before booking.
      </p>
    </div>
  );
}
