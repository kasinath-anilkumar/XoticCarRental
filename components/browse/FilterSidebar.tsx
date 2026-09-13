import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { MAX_BUDGET_AMOUNT, budgetLabel, statesOf, type CarFilters, type Catalog } from "@/lib/catalog";
import { GENERAL_ENQUIRY_MESSAGE, whatsappLink } from "@/lib/whatsapp";


export interface FilterSidebarProps {
  catalog: Catalog;
  filters: CarFilters;
  /** Everything already in the URL, so a filter link keeps the rest. */
  baseParams: URLSearchParams;
}

interface ChipOption {
  key: string;
  label: string;
}

/**
 * The browse filters: city, car type, seats.
 *
 * Occasion is deliberately not among them. It filtered on a curation tag, so
 * "Wedding" hid cars that would do a wedding perfectly well — and someone
 * browsing for a price is not thinking in those terms anyway. An `?occasion=`
 * still narrows the list for anyone arriving from an occasion landing page, it
 * still shows as a removable chip above the grid, and Clear still drops it.
 */
export function FilterSidebar({ catalog, filters, baseParams }: FilterSidebarProps) {
  const groups: Array<{ label: string; param: keyof CarFilters; options: ChipOption[] }> = [
    {
      // §3 — state first, then city. Picking a state shortens the city row to
      // the cities in it, which is the whole reason the step exists.
      label: "State",
      param: "state",
      options: [
        { key: "all", label: "All states" },
        ...statesOf(catalog).map((state) => ({ key: state, label: state })),
      ],
    },
    {
      label: "City",
      param: "city",
      options: [
        { key: "all", label: "All cities" },
        ...catalog.cities
          .filter((c) => filters.state === "all" || c.state === filters.state)
          .map((c) => ({ key: c.slug, label: c.name })),
      ],
    },
    {
      label: "Car type",
      param: "type",
      options: [
        { key: "all", label: "All types" },
        // Only the types the fleet actually has, so no filter leads nowhere.
        ...[...new Set(catalog.cars.map((car) => car.type))].map((t) => ({ key: t, label: t })),
      ],
    },
    {
      label: "Seats",
      param: "seats",
      options: [
        { key: "all", label: "Any" },
        { key: "4", label: "Up to 4" },
        { key: "7", label: "5–7" },
        { key: "8", label: "8+" },
      ],
    },
  ];

  const hrefFor = (param: string, value: string) => {
    const params = new URLSearchParams(baseParams);
    params.delete("page");
    if (value === "all") params.delete(param);
    else params.set(param, value);
    if (param === "state") {
      const city = catalog.cities.find((c) => c.slug === params.get("city"));
      if (city && value !== "all" && city.state !== value) params.delete("city");
    }
    const query = params.toString();
    return query ? `/cars?${query}` : "/cars";
  };

  const clearHref = (() => {
    const params = new URLSearchParams(baseParams);
    for (const key of ["city", "state", "type", "occasion", "seats", "sort", "budget", "date", "returnDate", "page"]) {
      params.delete(key);
    }
    const query = params.toString();
    return query ? `/cars?${query}` : "/cars";
  })();

  return (
    <aside
      className="rounded-md bg-surface p-6 shadow-[var(--shadow-sm)] max-lg:hidden"
      aria-label="Filters"
    >
      <div className="mb-6 flex items-center justify-between max-lg:mb-4">
        <span className="font-[family-name:var(--font-heading)] text-[15px]">Filters</span>
        <Link href={clearHref} className="btn btn-ghost" style={{ fontSize: "12px" }}>
          Clear
        </Link>
      </div>

      {/* §17 — the one filter that is a value rather than a choice. A plain GET
          form so it works before any JavaScript arrives; the rest of the query
          rides along as hidden fields so picking a date keeps your filters. */}
      <form method="get" action="/cars" className="mb-6 max-lg:mb-4">
        <label className="mb-3 text-[11px] tracking-[0.1em] uppercase text-[var(--color-neutral-500)]" htmlFor="filter-date">
          Travelling on
        </label>
        {[...baseParams].map(([key, value]) =>
          key === "date" || key === "page" ? null : <input key={key} type="hidden" name={key} value={value} />,
        )}
        <div className="flex flex-wrap gap-2">
          <input
            id="filter-date"
            className="input min-w-[130px] flex-1 text-[13px]"
            type="date"
            name="date"
            defaultValue={filters.date}
            min={new Date().toISOString().slice(0, 10)}
          />
          <button type="submit" className="btn btn-secondary" style={{ fontSize: "12px" }}>
            Check
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-neutral-400)]">
          Hides vehicles already booked that day.
        </p>
      </form>

      <form method="get" action="/cars" aria-label="Budget filter" className="mb-6">
        <label htmlFor="filter-budget" className="mb-2 block text-[12px] text-[var(--color-neutral-400)]">Maximum estimated amount (₹)</label>
        {[...baseParams].map(([key, value]) => key === "budget" || key === "page" ? null : <input key={key} type="hidden" name={key} value={value} />)}
        <input key={filters.budget} id="filter-budget" name="budget" className="input w-full" type="number" inputMode="decimal"
          min="0.01" max={MAX_BUDGET_AMOUNT} step="0.01" placeholder="Any amount"
          defaultValue={filters.budget === "all" || filters.budget.endsWith("+") ? "" : filters.budget}
          aria-describedby="filter-budget-help" />
        <p id="filter-budget-help" className="mt-2 text-[11px] text-[var(--color-neutral-400)]">Leave blank for any budget. Filters the estimated trip rate, including applicable driver allowance and tax.</p>
        {filters.budget.endsWith("+") && <p className="mt-2 text-[12px]">Current link filter: {budgetLabel(filters.budget)}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="submit" className="btn btn-secondary text-[12px]">Apply budget</button>
          {filters.budget !== "all" && <Link href={hrefFor("budget", "all")} className="btn btn-ghost text-[12px]">Clear budget</Link>}
        </div>
      </form>

      {groups.map((group) => (
        <div key={group.param} className="mb-6 max-lg:mb-4">
          <p className="mb-3 text-[11px] tracking-[0.1em] uppercase text-[var(--color-neutral-500)]">{group.label}</p>
          <div className={`flex flex-wrap gap-2 ${group.param === "city" || group.param === "state" ? "max-h-[150px] overflow-y-auto pr-1 [scrollbar-width:thin]" : ""}`}>
            {group.options.map((option) => {
              const active = filters[group.param] === option.key;
              return (
                <Link
                  key={option.key}
                  href={hrefFor(group.param, option.key)}
                  className={`max-w-full cursor-pointer rounded-sm border px-[10px] py-[5px] text-[12px] break-words no-underline max-lg:inline-flex max-lg:min-h-[44px] max-lg:items-center max-lg:px-[14px] ${active ? "border-[var(--color-accent)] bg-[var(--color-accent-800)] text-[var(--color-accent-100)]" : "border-[var(--color-divider)] bg-transparent text-[var(--color-neutral-300)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent-200)]"}`}
                  aria-current={active ? "true" : undefined}
                  scroll={false}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="border-t border-[var(--color-divider)] pt-6 text-[12px] text-[var(--color-neutral-500)] max-lg:hidden">
        Not finding the car? Send us the model on WhatsApp — we source from partner fleets.
        <a
          className="btn wa btn-block"
          href={whatsappLink(catalog.settings.whatsappNumber, GENERAL_ENQUIRY_MESSAGE)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginTop: "11.2px" }}
        >
          <Icon name="ph-whatsapp-logo" size={16} />
          Ask for a car
        </a>
      </div>
    </aside>
  );
}
