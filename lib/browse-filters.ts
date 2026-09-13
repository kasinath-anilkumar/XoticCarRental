import { DEFAULT_FILTERS, parseBudget, parseBrowseDate, type BrowseFilterOptions, type CarFilters } from "./catalog";
import { addDays, isISODate } from "./dates";
import { MAX_TRIP_DAYS } from "./trip-limits";

export type BrowseFilterDraft = CarFilters & { returnDate: string };

export const BROWSE_FILTER_KEYS = ["city", "state", "type", "occasion", "seats", "budget", "date", "returnDate", "sort"] as const;

const LAST_SUPPORTED_DATE = "9999-12-31";
const LAST_FULL_RANGE_START = addDays(LAST_SUPPORTED_DATE, -(MAX_TRIP_DAYS - 1));

/** Keep the inclusive rental window within the four-digit ISO date contract. */
export function maxBrowseReturnDate(pickupDate: string): string {
  if (!isISODate(pickupDate)) return "";
  return pickupDate > LAST_FULL_RANGE_START ? LAST_SUPPORTED_DATE : addDays(pickupDate, MAX_TRIP_DAYS - 1);
}

export function createFilterDraft(filters: CarFilters, baseQuery: string): BrowseFilterDraft {
  const returnDate = parseBrowseDate(new URLSearchParams(baseQuery).get("returnDate") ?? undefined);
  return { ...filters, returnDate: filters.date && returnDate >= filters.date ? returnDate : "" };
}

export function resetFilterDraft(draft: BrowseFilterDraft): BrowseFilterDraft {
  return { ...draft, ...DEFAULT_FILTERS, near: draft.near, returnDate: "" };
}

export function updateFilterDraft(draft: BrowseFilterDraft, key: keyof BrowseFilterDraft, value: string, options: BrowseFilterOptions): BrowseFilterDraft {
  const next = { ...draft, [key]: value };
  if (key === "state" && value !== "all") {
    const city = options.cities.find((item) => item.slug === next.city);
    if (city && city.state.trim() !== value) next.city = "all";
  }
  if (key === "date" && (!isISODate(value) || next.returnDate < value || next.returnDate > maxBrowseReturnDate(value))) {
    next.returnDate = "";
  }
  return next;
}

export function invalidFilterBudget(draft: BrowseFilterDraft): boolean {
  return draft.budget !== "all" && draft.budget.trim() !== "" && parseBudget(draft.budget) === "all";
}

export function countBrowseFilters(draft: BrowseFilterDraft): number {
  return ["city", "state", "type", "occasion", "seats", "budget"].filter((key) => {
    const value = draft[key as keyof BrowseFilterDraft];
    return value !== "all" && value !== "";
  }).length + Number(Boolean(draft.date));
}

/** Only applied choices reach the server; pickup and package context stay intact. */
export function filterDraftHref(baseQuery: string, draft: BrowseFilterDraft): string {
  const params = new URLSearchParams(baseQuery);
  params.delete("page");
  for (const key of BROWSE_FILTER_KEYS) {
    let value = key === "budget" ? parseBudget(draft.budget) : draft[key];
    if (key === "returnDate" && (!draft.date || value < draft.date || !isISODate(value) || value > maxBrowseReturnDate(draft.date))) value = "";
    if (!value || value === "all" || (key === "sort" && value === "popular")) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `/cars?${query}` : "/cars";
}

export function removeBrowseFilters(baseQuery: string, keys: readonly string[]): string {
  const params = new URLSearchParams(baseQuery);
  params.delete("page");
  for (const key of keys) params.delete(key);
  if (keys.includes("date")) params.delete("returnDate");
  const query = params.toString();
  return query ? `/cars?${query}` : "/cars";
}
