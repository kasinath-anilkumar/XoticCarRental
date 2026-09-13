import type { Metadata } from "next";
import Link from "next/link";

import { CarCard } from "@/components/CarCard";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { FilterSidebar } from "@/components/browse/FilterSidebar";
import { MobileFilters } from "@/components/browse/MobileFilters";
import { BrowseSort } from "@/components/browse/BrowseSort";
import { BrowseJourneySearch } from "@/components/browse/BrowseJourneySearch";
import styles from "@/components/browse/Browse.module.css";
import { ChargesExplained } from "@/components/trust/ChargesExplained";
import { Icon } from "@/components/ui/Icon";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { Pagination } from "@/components/ui/Pagination";
import { ResponsiveDisclosure } from "@/components/ui/ResponsiveDisclosure";
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
import { BROWSE_FILTER_KEYS, removeBrowseFilters } from "@/lib/browse-filters";
import { businessDate } from "@/lib/dates";


export const metadata: Metadata = {
  title: "Browse cars with drivers",
  description:
    "Every car in the Xotic fleet with its package rate, extra-km charge and driver bata. Filter by city, type and seats.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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

  const baseQuery = baseParams.toString();
  const filterOptions = browseFilterOptions(catalog);
  const minDate = businessDate();
  const clearHref = `${removeBrowseFilters(baseQuery, BROWSE_FILTER_KEYS)}#fleet-results`;
  const pickup = single(params.stops)?.split("~")[0] ?? single(params.from) ?? "";

  const typeHref = (type: string) => {
    const next = new URLSearchParams(baseParams);
    next.delete("page");
    if (type === "all") next.delete("type");
    else next.set("type", type);
    const query = next.toString();
    return `${query ? `/cars?${query}` : "/cars"}#fleet-results`;
  };

  const carTypes = [{ key: "all", name: "All types", count: filterOptions.carCount },
    ...filterOptions.carTypes.map((type) => ({ key: type.name, ...type }))];

  const title =
    filters.city !== "all"
      ? `Cars with drivers in ${cityBySlug(catalog, filters.city).name}`
      : filters.state !== "all"
        ? `Cars with drivers in ${filters.state}`
        : "Cars with drivers across India";

  // What is currently narrowing the list, so it can be shown and undone.
  const applied: Array<{ category: string; label: string; param: keyof CarFilters }> = [];
  if (filters.state !== "all") applied.push({ category: "State", label: filters.state, param: "state" });
  if (filters.city !== "all") {
    applied.push({ category: "City", label: cityBySlug(catalog, filters.city).name, param: "city" });
  }
  if (filters.type !== "all") applied.push({ category: "Type", label: filters.type, param: "type" });
  if (filters.budget !== "all") {
    applied.push({ category: "Budget", label: budgetLabel(filters.budget), param: "budget" });
  }
  if (filters.date) {
    const label =
      returnDateParam && returnDateParam >= filters.date
        ? `${dateLabel(filters.date)} – ${dateLabel(returnDateParam)}`
        : dateLabel(filters.date);
    applied.push({ category: "Dates", label, param: "date" });
  }
  if (filters.occasion !== "all") {
    applied.push({ category: "Occasion", label: occasionBySlug(catalog, filters.occasion).name, param: "occasion" });
  }
  if (filters.seats !== "all") {
    const seatLabel =
      filters.seats === "4" ? "Up to 4 seats" : filters.seats === "7" ? "5–7 seats" : "8+ seats";
    applied.push({ category: "Seats", label: seatLabel, param: "seats" });
  }

  return (
    <div className={styles.surface}><div className={styles.page}>
      <p className={styles.breadcrumb}>
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
          Home
        </Link>{" "}
        / Browse cars
      </p>
      <header className={styles.intro}>
        <div><p className={styles.kicker}>Find your next ride</p><h1 className={styles.title}><span className={styles.fullTitle}>{title}</span><span className={styles.mobileTitle}>{filters.city === "all" && filters.state === "all" && filters.type === "all" ? "Cars with drivers" : title}</span></h1><p className={styles.description}>Choose your car. A chauffeur takes care of the drive.</p></div>
      </header>

      <BrowseJourneySearch key={baseQuery} baseQuery={baseQuery} pickup={pickup} date={filters.date}
        returnDate={filters.date && returnDateParam >= filters.date ? returnDateParam : ""} packageSlug={pkg.slug}
        packages={catalog.packages.map(({ slug, label }) => ({ slug, label }))}
        locations={catalog.locations.filter((location) => location.slug === pickup)} minDate={minDate} />

      <HorizontalScroll label="Car types" className={styles.typeRail} contentClassName={styles.typeRailContent}>
        {carTypes.map((type) => {
          const active = filters.type === type.key;
          return (
            <Link
              key={type.key}
              href={typeHref(type.key)}
              prefetch={false}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={`${styles.typeLink} ${active ? styles.typeActive : ""}`}
            >
              <span className={styles.typeIcon}><Icon name={type.key === "all" ? "ph-steering-wheel" : "ph-car-profile"} size={19} /></span>
              <span className={styles.typeName}>{type.name}</span><span className={styles.typeCount}>{type.count}<span className="visually-hidden"> in fleet</span></span>
            </Link>
          );
        })}
      </HorizontalScroll>

      <div className={styles.layout}>
        <FilterSidebar key={baseQuery} catalog={filterOptions} filters={filters} baseQuery={baseQuery} minDate={minDate} />

        <div className={styles.results}>
            <section id="fleet-results" tabIndex={-1} className={styles.toolbarTop} aria-label="Fleet results and controls">
              <div className={styles.resultSummary}>
                <p className={styles.resultCount}>
                  <strong>{cars.length}</strong> {cars.length === 1 ? "car" : "cars"}{filters.date ? " for your dates" : " to explore"}
                </p>
                {!filters.date && <p className={styles.resultHint}>Add travel dates to check availability.</p>}
                {(hiddenByDate > 0 || (customer && filters.sort === "popular")) && (
                  <p className={styles.resultHint}>
                    {hiddenByDate > 0 && (
                      <>
                        {hiddenByDate} {hiddenByDate === 1 ? "car is" : "cars are"} booked for your selected dates.{" "}
                      </>
                    )}
                    {customer && filters.sort === "popular" && <>Nearest to {customer.name} first.</>}
                  </p>
                )}
              </div>

              <div className={styles.toolbarActions}>
                <div className={styles.mobileFilter}>
                  <MobileFilters key={baseQuery} catalog={filterOptions} filters={filters} baseQuery={baseQuery} minDate={minDate} />
                </div>
                <BrowseSort key={baseQuery} value={filters.sort} baseQuery={baseQuery} />
              </div>
            </section>

          <div className={styles.toolbar}>
            <p className={styles.rateNote}><Icon name="ph-info" size={16} />{pkg.label} base rates in each car&rsquo;s home city. Driver allowance, {catalog.settings.gstPercent}% GST and route extras are additional.</p>

            {applied.length > 0 && (
              <section className={styles.selection} aria-label="Your selection">
                <div className={styles.selectionHead}>
                  <h2>Your selection <span>{applied.length}</span></h2>
                  <Link href={clearHref} scroll={false} prefetch={false} className={styles.clearFilters}>Clear all</Link>
                </div>
                <div className={styles.selectionChips}>
                {applied.map((chip) => (
                  <Link
                    key={chip.param}
                    href={`${removeBrowseFilters(baseQuery, [chip.param])}#fleet-results`}
                    scroll={false}
                    prefetch={false}
                    className={styles.selectionChip}
                    aria-label={`Remove the ${chip.label} filter`}
                  >
                    <span className={styles.chipCopy}><span className={styles.chipCategory}>{chip.category}</span><span>{chip.label}</span></span>
                    <Icon name="ph-x" size={15} />
                  </Link>
                ))}
                </div>
              </section>
            )}
          </div>

          {cars.length > 0 ? (
            <div className={styles.cars}>
              {visibleCars.map((car) => (
                <CarCard
                  key={car.slug}
                  catalog={catalog}
                  car={car}
                  pkg={pkg}
                  citySlug={filters.city !== "all" ? filters.city : undefined}
                  journeyQuery={baseQuery}
                />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <Icon name="ph-car-profile" size={34} color="var(--color-neutral-600)" />
              <p className="mt-4 mb-2 font-[family-name:var(--font-heading)] text-[18px] sm:text-[19px]">
                No cars match those filters
              </p>
              <p className="mb-6 text-[13px] text-[var(--color-neutral-500)] max-w-[50ch] mx-auto">
                Try another vehicle type, widen your service area, or adjust your travel dates.
              </p>
              <Link
                href={clearHref}
                prefetch={false}
                className="btn btn-secondary"
              >
                Clear filters
              </Link>
            </div>
          )}
          <Pagination total={cars.length} page={pagination.page} pageSize={CARS_PAGE_SIZE} path="/cars" query={baseQuery} label="cars" targetId="fleet-results" />
        </div>
      </div>

      <ResponsiveDisclosure title="How prices work" hideTitleOnDesktop className={styles.chargesInfo}>
        <ChargesExplained settings={catalog.settings} />
      </ResponsiveDisclosure>
    </div></div>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
