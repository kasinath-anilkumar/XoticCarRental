import type { Metadata } from "next";
import Link from "next/link";

import { CarCard } from "@/components/CarCard";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { FilterSidebar } from "@/components/browse/FilterSidebar";
import { MobileFilters } from "@/components/browse/MobileFilters";
import { ChargesExplained } from "@/components/trust/ChargesExplained";
import { Icon } from "@/components/ui/Icon";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { Pagination } from "@/components/ui/Pagination";
import {
  budgetLabel,
  browseFilterOptions,
  cityBySlug,
  filterCars,
  occasionBySlug,
  packageBySlug,
  parseFilters,
  parseBrowseDate,
  type CarFilters,
} from "@/lib/catalog";
import { getCatalog } from "@/lib/content";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { CARS_PAGE_SIZE, pageBounds, parsePage } from "@/lib/pagination";
import { resolvePlace } from "@/lib/places";
import { getStore } from "@/lib/store";


export const metadata: Metadata = {
  title: "Browse cars with drivers",
  description:
    "Every car in the Xotic fleet with its package rate, extra-km charge and driver bata. Filter by city, type and seats.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SORT_OPTIONS = [
  { key: "popular", label: "Popular", icon: "ph-sparkle" },
  { key: "low", label: "Price low", icon: "ph-caret-up" },
  { key: "high", label: "Price high", icon: "ph-caret-down" },
] as const;

export default async function BrowsePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const catalog = await getCatalog();
  if (!isPricingAvailable(catalog)) {
    return <section className="sec"><h1 className="mb-6">Browse cars with a driver</h1><PricingUnavailable /></section>;
  }

  const filters = parseFilters(params);
  const pkg = packageBySlug(catalog, single(params.pkg));
  const returnDateParam = parseBrowseDate(single(params.returnDate));

  // Availability is live even though this page is cached content: the holds are
  // read per request, and a car booked for the customer's date drops out.
  const held = filters.date
    ? await getStore().listAvailability(undefined, {
        from: filters.date,
        to: returnDateParam >= filters.date ? returnDateParam : filters.date,
      })
    : [];
  const unavailable = new Set(held.map((entry) => entry.carSlug));

  // Where the customer is, if the search carried it — ranks the fleet by which
  // yard can reach them (§7), and never appears on the page.
  const customer = resolvePlace(filters.near, catalog.locations);

  const point = customer ? { lat: customer.lat, lng: customer.lng } : null;
  const cars = filterCars(catalog, filters, pkg, {
    unavailable,
    customer: point,
    wantedCity: filters.city === "all" ? (customer?.citySlug ?? "") : filters.city,
  });
  const pagination = pageBounds(cars.length, parsePage(params.page), CARS_PAGE_SIZE);
  const visibleCars = cars.slice(pagination.offset, pagination.offset + CARS_PAGE_SIZE);

  // Say what the date took away rather than quietly showing a shorter list.
  const hiddenByDate =
    unavailable.size === 0
      ? 0
      : filterCars(catalog, filters, pkg, {
          customer: point,
          wantedCity: filters.city === "all" ? (customer?.citySlug ?? "") : filters.city,
        }).length - cars.length;

  // Preserved across every filter and sort link so a chosen package or pickup
  // date survives the whole browsing session.
  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) baseParams.set(key, first);
  }

  const hrefWithout = (keys: string[]) => {
    const next = new URLSearchParams(baseParams);
    next.delete("page");
    if (keys.includes("date")) next.delete("returnDate");
    for (const key of keys) next.delete(key);
    const query = next.toString();
    return query ? `/cars?${query}` : "/cars";
  };

  const sortHref = (key: string) => {
    const next = new URLSearchParams(baseParams);
    next.delete("page");
    if (key === "popular") next.delete("sort");
    else next.set("sort", key);
    const query = next.toString();
    return query ? `/cars?${query}` : "/cars";
  };

  const typeHref = (type: string) => {
    const next = new URLSearchParams(baseParams);
    next.delete("page");
    if (type === "all") next.delete("type");
    else next.set("type", type);
    const query = next.toString();
    return query ? `/cars?${query}` : "/cars";
  };

  const carTypes = ["all", ...new Set(catalog.cars.map((car) => car.type))];

  const title =
    filters.city !== "all"
      ? `Cars with drivers in ${cityBySlug(catalog, filters.city).name}`
      : filters.state !== "all"
        ? `Cars with drivers in ${filters.state}`
        : "Cars with drivers across India";

  // What is currently narrowing the list, so it can be shown and undone.
  const applied: Array<{ label: string; param: keyof CarFilters }> = [];
  if (filters.state !== "all") applied.push({ label: filters.state, param: "state" });
  if (filters.city !== "all") {
    applied.push({ label: cityBySlug(catalog, filters.city).name, param: "city" });
  }
  if (filters.type !== "all") applied.push({ label: filters.type, param: "type" });
  if (filters.budget !== "all") {
    applied.push({ label: budgetLabel(filters.budget), param: "budget" });
  }
  if (filters.date) {
    const label =
      returnDateParam && returnDateParam >= filters.date
        ? `${filters.date} → ${returnDateParam}`
        : `Free on ${filters.date}`;
    applied.push({ label, param: "date" });
  }
  if (filters.occasion !== "all") {
    applied.push({ label: occasionBySlug(catalog, filters.occasion).name, param: "occasion" });
  }
  if (filters.seats !== "all") {
    const seatLabel =
      filters.seats === "4" ? "Up to 4 seats" : filters.seats === "7" ? "5–7 seats" : "8+ seats";
    applied.push({ label: seatLabel, param: "seats" });
  }

  return (
    <div className="px-[var(--gutter-mobile)] sm:px-6 md:px-8 lg:px-[var(--gutter-desktop)] pt-6 sm:pt-8 md:pt-12 pb-14">
      <p className="mb-4 text-[12px] text-[var(--color-neutral-600)]">
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
          Home
        </Link>{" "}
        / Browse cars
      </p>
      <h1 className="mb-2 text-[26px] sm:text-[30px] lg:text-[34px]">{title}</h1>
      <p className="mb-6 sm:mb-8 max-w-[70ch] text-[12px] sm:text-[13px] text-[var(--color-neutral-500)]">
        Rates are the {pkg.label} package in each car&rsquo;s home city, before the driver&rsquo;s
        bata and {catalog.settings.gstPercent}% GST. Your exact price depends on the route — the
        calculator works it out line by line.
      </p>

      {/* Quick Type Filter Bar for fast switching */}
      <HorizontalScroll label="Car types" className="mb-5" contentClassName="flex items-center gap-2 py-1">
        {carTypes.map((type) => {
          const active = filters.type === type;
          const label = type === "all" ? "All types" : type;
          return (
            <Link
              key={type}
              href={typeHref(type)}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={`inline-flex flex-none items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] sm:text-[13px] whitespace-nowrap transition-colors no-underline ${
                active
                  ? "border border-[var(--color-accent)] bg-[var(--color-accent-800)] font-medium text-[var(--color-accent-100)] shadow-xs"
                  : "border border-[var(--color-divider)] bg-surface text-[var(--color-neutral-300)] hover:border-[var(--color-neutral-600)] hover:text-text"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </HorizontalScroll>

      <div className="grid grid-cols-[264px_1fr] gap-8 lg:gap-12 max-lg:grid-cols-1 [&>*]:min-w-0">
        <div className="min-w-0 max-lg:hidden">
          <div className="sticky top-[calc(var(--header-height)+16.8px)] max-h-[calc(100dvh-var(--header-height)-33.6px)] overflow-y-auto [scrollbar-color:var(--color-neutral-700)_transparent] [scrollbar-width:thin]">
            <FilterSidebar catalog={catalog} filters={filters} baseParams={baseParams} />
          </div>
        </div>

        <div>
          <div className="sticky top-[var(--header-height)] z-20 mb-6 -mx-[var(--gutter-mobile)] sm:-mx-6 md:-mx-8 lg:mx-0 border-b border-[var(--color-divider)] bg-bg px-[var(--gutter-mobile)] sm:px-6 md:px-8 lg:px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-[var(--color-neutral-400)] truncate [&_strong]:font-[family-name:var(--font-heading)] [&_strong]:text-[16px] sm:[&_strong]:text-[17px] [&_strong]:text-text">
                  <strong>{cars.length}</strong> {cars.length === 1 ? "car" : "cars"} available
                </p>
                {(hiddenByDate > 0 || customer) && (
                  <p className="mt-[1px] text-[11px] sm:text-[12px] text-[var(--color-neutral-400)] truncate">
                    {hiddenByDate > 0 && (
                      <>
                        {hiddenByDate} {hiddenByDate === 1 ? "car is" : "cars are"} booked on {filters.date}.{" "}
                      </>
                    )}
                    {customer && <>Nearest to {customer.name} first.</>}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-none">
                <div className="lg:hidden">
                  <MobileFilters catalog={browseFilterOptions(catalog)} filters={filters} baseQuery={baseParams.toString()} />
                </div>

                <div className="inline-flex gap-[2px] rounded-md bg-well p-[3px]">
                  {SORT_OPTIONS.map((option) => {
                    const active = filters.sort === option.key;
                    return (
                      <Link
                        key={option.key}
                        href={sortHref(option.key)}
                        scroll={false}
                        aria-current={active ? "true" : undefined}
                        title={`Sort by ${option.label}`}
                        className={`inline-flex items-center gap-1 rounded-sm px-2 sm:px-[10px] py-1 sm:py-[5px] text-[12px] sm:text-[13px] whitespace-nowrap no-underline transition-colors ${
                          active
                            ? "bg-surface text-accent-text shadow-[var(--shadow-sm)] font-medium"
                            : "text-[var(--color-neutral-400)] hover:text-text"
                        }`}
                      >
                        <Icon name={option.icon} size={13} />
                        <span className="max-sm:hidden">{option.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {applied.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pb-0.5">
                <span className="text-[11px] text-[var(--color-neutral-500)] whitespace-nowrap flex-none">
                  Filtered:
                </span>
                {applied.map((chip) => (
                  <Link
                    key={chip.param}
                    href={hrefWithout([chip.param])}
                    scroll={false}
                    className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--color-accent-800)] bg-[var(--color-accent-900)] py-0.5 pr-2 pl-2.5 text-[11px] sm:text-[12px] text-accent-text no-underline hover:border-[var(--color-accent)]"
                    aria-label={`Remove the ${chip.label} filter`}
                  >
                    <span className="min-w-0 break-words">{chip.label}</span>
                    <span className="flex shrink-0 opacity-70 group-hover:opacity-100">
                      <Icon name="ph-x" size={10} />
                    </span>
                  </Link>
                ))}
                <Link
                  href={hrefWithout(["city", "state", "type", "occasion", "seats", "sort", "budget", "date"])}
                  scroll={false}
                  className="flex-none px-1.5 py-0.5 text-[11px] sm:text-[12px] text-[var(--color-neutral-500)] whitespace-nowrap no-underline hover:text-accent-text"
                >
                  Clear all
                </Link>
              </div>
            )}
          </div>

          {cars.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {visibleCars.map((car) => (
                <CarCard
                  key={car.slug}
                  catalog={catalog}
                  car={car}
                  pkg={pkg}
                  citySlug={filters.city !== "all" ? filters.city : undefined}
                  journeyQuery={baseParams.toString()}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md bg-surface p-[48px] sm:p-[56px] text-center shadow-[var(--shadow-sm)] max-md:px-5 max-md:py-[28px]">
              <Icon name="ph-car-profile" size={34} color="var(--color-neutral-600)" />
              <p className="mt-4 mb-2 font-[family-name:var(--font-heading)] text-[18px] sm:text-[19px]">
                No cars match those filters
              </p>
              <p className="mb-6 text-[13px] text-[var(--color-neutral-500)] max-w-[50ch] mx-auto">
                Clear a filter, or tell us the car on WhatsApp and we will source it from a partner
                fleet.
              </p>
              <Link
                href={hrefWithout(["city", "state", "type", "occasion", "seats", "budget", "date"])}
                className="btn btn-secondary"
              >
                Clear filters
              </Link>
            </div>
          )}
          <Pagination total={cars.length} page={pagination.page} pageSize={CARS_PAGE_SIZE} path="/cars" query={baseParams.toString()} label="cars" />
        </div>
      </div>

      <section style={{ marginTop: "56px" }}>
        <ChargesExplained settings={catalog.settings} />
      </section>
    </div>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
