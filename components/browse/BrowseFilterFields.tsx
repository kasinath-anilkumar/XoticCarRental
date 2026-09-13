"use client";

import { useState, type ReactNode, type InvalidEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { MAX_BUDGET_AMOUNT, budgetLabel, type BrowseFilterOptions } from "@/lib/catalog";
import { invalidFilterBudget, maxBrowseReturnDate, type BrowseFilterDraft } from "@/lib/browse-filters";
import { addDays, isISODate } from "@/lib/dates";
import { filterServiceCities, serviceStates } from "@/lib/service-areas";
import styles from "./BrowseFilterFields.module.css";

interface Props {
  options: BrowseFilterOptions;
  draft: BrowseFilterDraft;
  onChange: (key: keyof BrowseFilterDraft, value: string) => void;
  minDate: string;
  idPrefix: string;
}

const OPTION_PAGE_SIZE = 8;
const SEATS = [{ value: "all", label: "Any" }, { value: "4", label: "Up to 4" }, { value: "7", label: "5–7" }, { value: "8", label: "8+" }];

export function BrowseFilterFields({ options, draft, onChange, minDate, idPrefix }: Props) {
  const [citySearch, setCitySearch] = useState("");
  const [typeSearch, setTypeSearch] = useState("");
  const [cityLimit, setCityLimit] = useState(OPTION_PAGE_SIZE);
  const [typeLimit, setTypeLimit] = useState(OPTION_PAGE_SIZE);
  const cities = filterServiceCities(options.cities, draft.state, citySearch);
  const types = options.carTypes.filter((item) => item.name.toLocaleLowerCase().includes(typeSearch.trim().toLocaleLowerCase()));
  const selectedCity = options.cities.find((city) => city.slug === draft.city);
  const floor = draft.budget.endsWith("+");
  const amount = draft.budget === "all" ? "" : draft.budget.replace(/\+$/, "");
  const dateSummary = draft.date ? `${dateLabel(draft.date)}${draft.returnDate ? ` – ${dateLabel(draft.returnDate)}` : ""}` : "Choose your dates";
  const seatsSummary = draft.seats === "all" ? "Any group size" : `${SEATS.find((item) => item.value === draft.seats)?.label ?? draft.seats} passengers`;

  const revealInvalid = (event: InvalidEvent<HTMLDivElement>) => {
    let ancestor = (event.target as HTMLElement).parentElement;
    while (ancestor && ancestor !== event.currentTarget) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
  };

  return <div className={styles.fields} onInvalidCapture={revealInvalid}>
    <FilterGroup title="Location" icon="ph-map-pin" value={selectedCity?.name ?? (draft.state === "all" ? "All service areas" : draft.state)} active={draft.city !== "all" || draft.state !== "all"} initiallyOpen>
      <p className={styles.help}>Choose where the car is based. Your pickup address stays with your journey.</p>
      <div className={styles.field}><label htmlFor={`${idPrefix}-state`}>State or territory</label>
        <select id={`${idPrefix}-state`} name={`${idPrefix}-state`} value={draft.state} onChange={(event) => { onChange("state", event.target.value); setCitySearch(""); setCityLimit(OPTION_PAGE_SIZE); }}>
          <option value="all">All states</option>
          {serviceStates(options.cities).map((state) => <option key={state.name} value={state.name}>{state.name}</option>)}
        </select>
      </div>
      <details className={styles.picker} key={draft.state}>
        <summary><span><small>Service city</small>{selectedCity?.name ?? "Any service city"}</span><Icon name="ph-caret-down" size={15} /></summary>
        <div className={styles.pickerBody}>
          <SearchField id={`${idPrefix}-city-search`} label="Search service cities" placeholder="Search a city" value={citySearch} onChange={(value) => { setCitySearch(value); setCityLimit(OPTION_PAGE_SIZE); }} />
          <fieldset className={styles.options}><legend className="visually-hidden">Service city</legend>
            <RadioOption name={`${idPrefix}-city`} value="all" checked={draft.city === "all"} onChange={() => onChange("city", "all")} label="Any service city" />
            {cities.slice(0, cityLimit).map((city) => <RadioOption key={city.slug} name={`${idPrefix}-city`} value={city.slug} checked={draft.city === city.slug} onChange={() => onChange("city", city.slug)} label={city.name} description={city.state} count={city.carCount} />)}
          </fieldset>
          {!cities.length && <output className={styles.empty}>No cities match this search.</output>}
          {cities.length > cityLimit && <button className={styles.more} type="button" onClick={() => setCityLimit((limit) => limit + OPTION_PAGE_SIZE)}>Show more cities <span>{cities.length - cityLimit} more</span><Icon name="ph-plus-circle" size={16} /></button>}
        </div>
      </details>
    </FilterGroup>

    <FilterGroup title="Vehicle type" icon="ph-car-profile" value={draft.type === "all" ? "Explore every style" : draft.type} active={draft.type !== "all"}>
      <p className={styles.help}>Choose a style for your journey. Counts show the full fleet.</p>
      {options.carTypes.length > OPTION_PAGE_SIZE && <SearchField id={`${idPrefix}-type-search`} label="Search vehicle types" placeholder="Find a vehicle type" value={typeSearch} onChange={(value) => { setTypeSearch(value); setTypeLimit(OPTION_PAGE_SIZE); }} />}
      <fieldset className={styles.options}><legend className="visually-hidden">Vehicle type</legend>
        <RadioOption name={`${idPrefix}-type`} value="all" checked={draft.type === "all"} onChange={() => onChange("type", "all")} label="All types" count={options.carCount} />
        {types.slice(0, typeLimit).map((type) => <RadioOption key={type.name} name={`${idPrefix}-type`} value={type.name} checked={draft.type === type.name} onChange={() => onChange("type", type.name)} label={type.name} count={type.count} />)}
      </fieldset>
      {!types.length && <output className={styles.empty}>No vehicle types match this search.</output>}
      {types.length > typeLimit && <button className={styles.more} type="button" onClick={() => setTypeLimit((limit) => limit + OPTION_PAGE_SIZE)}>Show more types <span>{types.length - typeLimit} more</span><Icon name="ph-plus-circle" size={16} /></button>}
    </FilterGroup>

    <FilterGroup title="Passengers" icon="ph-users-three" value={seatsSummary} active={draft.seats !== "all"}>
      <fieldset className={styles.seats}><legend className="visually-hidden">Passenger capacity</legend>
        {SEATS.map((seat) => <label key={seat.value} className={draft.seats === seat.value ? styles.seatSelected : styles.seat}>
          <input type="radio" name={`${idPrefix}-seats`} value={seat.value} checked={draft.seats === seat.value} onChange={() => onChange("seats", seat.value)} />
          <Icon name="ph-users-three" size={19} /><span>{seat.label}</span>
        </label>)}
      </fieldset>
      <p className={styles.help}>Passenger seating, excluding the chauffeur.</p>
    </FilterGroup>

    <FilterGroup title="Budget" icon="ph-wallet" value={invalidFilterBudget(draft) ? "Check your amount" : budgetLabel(draft.budget)} active={draft.budget !== "all" && draft.budget !== ""}>
      <label className={styles.field} htmlFor={`${idPrefix}-budget`}><span>{floor ? "Minimum" : "Maximum"} estimated amount (₹)</span>
        <span className={styles.currencyInput}><span aria-hidden="true">₹</span><input id={`${idPrefix}-budget`} name="budget" type="number" inputMode="decimal" min="0.01" step="0.01" max={MAX_BUDGET_AMOUNT} placeholder="Any amount" value={amount} onChange={(event) => onChange("budget", event.target.value ? `${event.target.value}${floor ? "+" : ""}` : "all")} aria-describedby={`${idPrefix}-budget-help`} aria-invalid={invalidFilterBudget(draft) || undefined} /></span>
      </label>
      <p className={styles.help} id={`${idPrefix}-budget-help`}>Estimated trip rate, including applicable driver allowance and tax. Leave blank for any budget.</p>
      {invalidFilterBudget(draft) && <output className={styles.error}>Enter a positive amount with up to two decimal places.</output>}
      {floor && <button type="button" className={styles.textButton} onClick={() => onChange("budget", amount || "all")}>Use this amount as a maximum instead</button>}
      {amount && <button type="button" className={styles.textButton} onClick={() => onChange("budget", "all")}>Clear budget</button>}
    </FilterGroup>

    <FilterGroup title="Travel dates" icon="ph-calendar-blank" value={dateSummary} active={Boolean(draft.date)}>
      <div className={styles.dateFields}>
        <label className={styles.field} htmlFor={`${idPrefix}-date`}><span>Pickup date</span><input id={`${idPrefix}-date`} name="date" type="date" value={draft.date} min={minDate} onChange={(event) => onChange("date", event.target.value)} /></label>
        <label className={styles.field} htmlFor={`${idPrefix}-return-date`}><span>Return date (optional)</span><input id={`${idPrefix}-return-date`} name="returnDate" type="date" value={draft.returnDate} min={draft.date || minDate} max={maxBrowseReturnDate(draft.date) || undefined} disabled={!draft.date} onChange={(event) => onChange("returnDate", event.target.value)} /></label>
      </div>
      <div className={styles.presets}><button type="button" onClick={() => onChange("date", minDate)}>Today</button><button type="button" onClick={() => onChange("date", addDays(minDate, 1))}>Tomorrow</button>{draft.date && <button type="button" onClick={() => onChange("date", "")}>Clear dates</button>}</div>
      <p className={styles.help}>Hide cars already held for these dates. The team confirms availability before booking.</p>
    </FilterGroup>

    <FilterGroup title="Sort" icon="ph-arrows-down-up" value={draft.sort === "low" ? "Price: low to high" : draft.sort === "high" ? "Price: high to low" : "Recommended"} active={draft.sort !== "popular"}>
      <div className={styles.field}><label htmlFor={`${idPrefix}-sort`}>Sort order</label><select id={`${idPrefix}-sort`} name="sort" value={draft.sort} onChange={(event) => onChange("sort", event.target.value)}><option value="popular">Recommended</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>
    </FilterGroup>
  </div>;
}

function FilterGroup({ title, value, icon, active, initiallyOpen = false, children }: { title: string; value: string; icon: string; active: boolean; initiallyOpen?: boolean; children: ReactNode }) {
  return <details className={styles.group} open={initiallyOpen}>
    <summary><span className={`${styles.groupIcon} ${active ? styles.groupActive : ""}`}><Icon name={icon} size={20} /></span><span className={styles.groupLabel}><span>{title}</span><small>{value}</small></span><Icon name="ph-caret-down" size={14} className={styles.chevron} /></summary>
    <div className={styles.groupBody}>{children}</div>
  </details>;
}

function RadioOption({ name, value, checked, onChange, label, description, count }: { name: string; value: string; checked: boolean; onChange: () => void; label: string; description?: string; count?: number }) {
  return <label className={`${styles.option} ${checked ? styles.selected : ""}`}><input type="radio" name={name} value={value} checked={checked} onChange={onChange} /><span className={styles.optionLabel}><span>{label}</span>{description && <small>{description}</small>}</span>{count !== undefined && <span className={styles.optionCount}>{count}<span className="visually-hidden"> cars in the fleet</span></span>}</label>;
}

function SearchField({ id, label, placeholder, value, onChange }: { id: string; label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return <div className={styles.search}><Icon name="ph-magnifying-glass" size={16} /><input id={id} type="search" aria-label={label} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function dateLabel(date: string): string {
  if (!isISODate(date)) return date;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
