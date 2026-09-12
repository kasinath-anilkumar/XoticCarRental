"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CarCard } from "@/components/CarCard";
import { Icon } from "@/components/ui/Icon";
import type { Catalog } from "@/lib/catalog";
import type { Package } from "@/lib/types";

export interface WholeFleetProps {
  catalog: Catalog;
  defaultPackage: Package;
}

/**
 * Redesigned "The Whole Fleet" showcase for the homepage.
 *
 * Provides interactive category switching (All, Sedan, SUV, MUV, etc.),
 * an elevated showroom spotlight, and a responsive luxury fleet grid
 * across mobile, tablet, and desktop screens.
 */
export function WholeFleet({ catalog, defaultPackage }: WholeFleetProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const types = [...new Set(catalog.cars.map((car) => car.type))];
    return ["all", ...types];
  }, [catalog.cars]);

  const filteredCars = useMemo(() => {
    if (activeCategory === "all") return catalog.cars;
    return catalog.cars.filter((car) => car.type.toLowerCase() === activeCategory.toLowerCase());
  }, [catalog.cars, activeCategory]);

  const uniqueHomeCitiesCount = useMemo(() => {
    return new Set(catalog.cars.map((car) => car.homeCitySlug)).size;
  }, [catalog.cars]);

  return (
    <div className="flex flex-col gap-6">
      {/* Fleet Stats Banner */}
      <div className="grid grid-cols-3 divide-x divide-[var(--color-neutral-800)] border-y border-[var(--color-neutral-800)] max-md:grid-cols-3 max-md:divide-x">
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
            24/7
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-[var(--color-neutral-400)] max-md:text-[9.5px]">
            Concierge support
          </p>
        </div>
      </div>

      {/* Interactive Category Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-divider)] pb-4">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          {categories.map((category) => {
            const isActive = activeCategory === category;
            const count =
              category === "all"
                ? catalog.cars.length
                : catalog.cars.filter((c) => c.type.toLowerCase() === category.toLowerCase()).length;

            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={isActive}
                className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-xs"
                    : "border border-[var(--color-divider)] bg-surface text-[var(--color-neutral-400)] hover:border-[var(--color-accent)] hover:text-text"
                }`}
              >
                <span className="capitalize">{category === "all" ? "All Fleet" : category}</span>
                <span className="text-[11px]">
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        <Link
          href={activeCategory === "all" ? "/cars" : `/cars?type=${encodeURIComponent(activeCategory)}`}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--color-accent-300)] hover:text-[var(--color-accent-200)]"
        >
          <span>Explore all with filters</span>
          <Icon name="ph-arrow-right" size={13} />
        </Link>
      </div>

      {/* Responsive Luxury Fleet Grid */}
      <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1 max-md:gap-4">
        {filteredCars.map((car, index) => (
          <CarCard
            key={car.slug}
            catalog={catalog}
            car={car}
            pkg={defaultPackage}
            priority={index < 3}
          />
        ))}
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
