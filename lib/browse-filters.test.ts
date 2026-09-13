import { describe, expect, it } from "vitest";
import { parseFilters, type BrowseFilterOptions } from "./catalog";
import {
  countBrowseFilters,
  createFilterDraft,
  filterDraftHref,
  invalidFilterBudget,
  maxBrowseReturnDate,
  removeBrowseFilters,
  resetFilterDraft,
  updateFilterDraft,
} from "./browse-filters";

const options: BrowseFilterOptions = {
  cities: [
    { slug: "harbour", name: "Harbour city", state: "South state", carCount: 2 },
    { slug: "hills", name: "Hill city", state: "South state", carCount: 1 },
    { slug: "capital", name: "Capital city", state: "North state", carCount: 3 },
  ],
  carTypes: [{ name: "Sedan", count: 3 }, { name: "Van", count: 3 }],
  carCount: 6,
};

const pickup = "@10.0889,76.35,Pickup + landmark & entrance";
const customer = "@10.1,76.4,Customer location";
const context = {
  from: pickup, cust: customer, to: "@10.2,76.5,Drop", ret: "@10.3,76.6,Return",
  stops: `${pickup}~`, pkg: "custom-package", time: "09:45", trip: "round", occ: "wedding", halt: "2.5",
  campaign: "Summer + autumn", empty: "",
};

function draftFor(values: Record<string, string> = {}) {
  const query = new URLSearchParams({ ...context, ...values });
  return { query, draft: createFilterDraft(parseFilters(Object.fromEntries(query)), query.toString()) };
}

function params(href: string) {
  return new URL(href, "https://example.test").searchParams;
}

function expectContext(query: URLSearchParams) {
  for (const [key, value] of Object.entries(context)) expect(query.get(key), key).toBe(value);
  expect(query.has("near")).toBe(false);
}

describe("browse filter URL contracts", () => {
  it("applies the draft atomically while preserving encoded journey context and removing pagination", () => {
    const { query, draft } = draftFor({ page: "8", sort: "high", occasion: "wedding" });
    const original = query.toString();
    const selected = updateFilterDraft(updateFilterDraft(draft, "type", "Van", options), "budget", "0015000.50", options);
    const applied = params(filterDraftHref(original, selected));
    expectContext(applied);
    expect(applied.get("type")).toBe("Van");
    expect(applied.get("budget")).toBe("15000.5");
    expect(applied.get("sort")).toBe("high");
    expect(applied.get("occasion")).toBe("wedding");
    expect(applied.has("page")).toBe(false);
    expect(query.toString()).toBe(original);
    expect(draft.type).toBe("all");
    expect(draft.budget).toBe("all");
  });

  it("preserves a legacy budget floor when another field changes", () => {
    const { query, draft } = draftFor({ budget: "030000.00+", page: "2", sort: "low" });
    const selected = updateFilterDraft(draft, "seats", "4", options);
    const applied = params(filterDraftHref(query.toString(), selected));
    expect(applied.get("budget")).toBe("30000+");
    expect(applied.get("seats")).toBe("4");
    expect(applied.get("sort")).toBe("low");
    expect(invalidFilterBudget(selected)).toBe(false);
    expectContext(applied);
  });

  it("treats an explicitly cleared budget as any amount without losing other choices", () => {
    const { query, draft } = draftFor({ budget: "30000+", type: "Sedan" });
    const cleared = updateFilterDraft(draft, "budget", "", options);
    expect(invalidFilterBudget(cleared)).toBe(false);
    const applied = params(filterDraftHref(query.toString(), cleared));
    expect(applied.has("budget")).toBe(false);
    expect(applied.get("type")).toBe("Sedan");
    expectContext(applied);
  });

  it.each(["-1", "0", "1.001", "1e4", "100000000.01", "12,000", "Infinity"])(
    "marks the invalid draft budget %s for form validation", (budget) => {
      expect(invalidFilterBudget(draftFor({ budget: "30000+" }).draft)).toBe(false);
      const { draft } = draftFor();
      expect(invalidFilterBudget({ ...draft, budget })).toBe(true);
    },
  );

  it("resets filters and sort while retaining the pickup, package and distinct journey occasion", () => {
    const { query, draft } = draftFor({ city: "harbour", state: "South state", type: "Sedan", seats: "4", budget: "30000+", occasion: "corporate", date: "2030-04-10", returnDate: "2030-04-12", sort: "high", page: "4" });
    const reset = resetFilterDraft(draft);
    expect(reset.near).toBe(customer);
    expect(draft.city).toBe("harbour");
    expect(countBrowseFilters(reset)).toBe(0);
    const applied = params(filterDraftHref(query.toString(), reset));
    expectContext(applied);
    for (const key of ["city", "state", "type", "seats", "budget", "occasion", "date", "returnDate", "sort", "page"]) expect(applied.has(key), key).toBe(false);
    expect(applied.get("occ")).toBe("wedding");
  });

  it("removes a single applied chip without clearing other filters or changing sorting", () => {
    const { query } = draftFor({ city: "harbour", state: "South state", budget: "10000", date: "2030-04-10", returnDate: "2030-04-12", sort: "low", page: "3" });
    const removed = params(removeBrowseFilters(query.toString(), ["budget"]));
    expectContext(removed);
    expect(removed.has("budget")).toBe(false);
    expect(removed.has("page")).toBe(false);
    expect(removed.get("city")).toBe("harbour");
    expect(removed.get("state")).toBe("South state");
    expect(removed.get("sort")).toBe("low");
    expect(removed.get("date")).toBe("2030-04-10");
    expect(removed.get("returnDate")).toBe("2030-04-12");
  });

  it("removes both rental dates when the applied date chip is removed", () => {
    const { query } = draftFor({ date: "2030-04-10", returnDate: "2030-04-12", sort: "low", page: "3" });
    const removed = params(removeBrowseFilters(query.toString(), ["date"]));
    expectContext(removed);
    expect(removed.has("date")).toBe(false);
    expect(removed.has("returnDate")).toBe(false);
    expect(removed.has("page")).toBe(false);
    expect(removed.get("sort")).toBe("low");
  });

  it("serializes default filters without all or popular sentinel parameters", () => {
    const { draft } = draftFor();
    expect(filterDraftHref("page=2&sort=popular&type=all", draft)).toBe("/cars");
  });
});

describe("dependent location and date choices", () => {
  it("clears an incompatible city when switching states", () => {
    const { draft } = draftFor({ city: "harbour", state: "South state" });
    expect(updateFilterDraft(draft, "state", "North state", options)).toMatchObject({ city: "all", state: "North state" });
    expect(draft.city).toBe("harbour");
  });

  it("retains a compatible city when selecting its state or all states", () => {
    const { draft } = draftFor({ city: "harbour" });
    const state = updateFilterDraft(draft, "state", "South state", options);
    expect(state.city).toBe("harbour");
    expect(updateFilterDraft(state, "state", "all", options)).toMatchObject({ state: "all", city: "harbour" });
  });

  it.each([
    { date: "", returnDate: "2030-04-12" },
    { date: "2030-04-10", returnDate: "2030-04-09" },
    { date: "2030-04-10", returnDate: "2030-02-30" },
  ])("drops an orphan, earlier or invalid return date from the initial URL: %j", (dates) => {
    expect(draftFor(dates).draft.returnDate).toBe("");
  });

  it("keeps a valid return date when moving pickup within the selected rental interval", () => {
    const { query, draft } = draftFor({ date: "2030-04-10", returnDate: "2030-04-12" });
    const changed = updateFilterDraft(draft, "date", "2030-04-11", options);
    expect(changed.returnDate).toBe("2030-04-12");
    const applied = params(filterDraftHref(query.toString(), changed));
    expect(applied.get("date")).toBe("2030-04-11");
    expect(applied.get("returnDate")).toBe("2030-04-12");
  });

  it.each(["", "2030-04-13", "2030-03-01"])("clears the return date after an incompatible pickup change to %s", (date) => {
    const { query, draft } = draftFor({ date: "2030-04-10", returnDate: "2030-04-12" });
    const changed = updateFilterDraft(draft, "date", date, options);
    expect(changed.returnDate).toBe("");
    const applied = params(filterDraftHref(query.toString(), changed));
    expect(applied.has("returnDate")).toBe(false);
    expect(applied.get("date")).toBe(date || null);
    expectContext(applied);
  });

  it("allows an inclusive thirty-day range across leap day and removes a longer range", () => {
    const { query, draft } = draftFor({ date: "2028-02-28", returnDate: "2028-03-28" });
    expect(params(filterDraftHref(query.toString(), draft)).get("returnDate")).toBe("2028-03-28");
    expect(params(filterDraftHref(query.toString(), { ...draft, returnDate: "2028-03-29" })).has("returnDate")).toBe(false);
  });
});

describe("return dates at the supported calendar boundary", () => {
  it.each([
    ["2030-04-10", "2030-05-09"],
    ["2028-02-28", "2028-03-28"],
    ["9999-12-02", "9999-12-31"],
    ["9999-12-03", "9999-12-31"],
    ["9999-12-31", "9999-12-31"],
  ])("bounds the maximum for %s to %s", (pickup, maximum) => {
    expect(maxBrowseReturnDate(pickup)).toBe(maximum);
  });

  it.each(["", "invalid", "2030-02-30", "10000-01-01"])("does not calculate a return limit for invalid pickup %s", (pickup) => {
    expect(maxBrowseReturnDate(pickup)).toBe("");
  });

  it("applies and changes a rental at the last supported date without overflowing", () => {
    const { query, draft } = draftFor({ date: "9999-12-31", returnDate: "9999-12-31", page: "2" });
    const applied = params(filterDraftHref(query.toString(), draft));
    expect(applied.get("date")).toBe("9999-12-31");
    expect(applied.get("returnDate")).toBe("9999-12-31");
    expect(applied.has("page")).toBe(false);
    expectContext(applied);
    const changed = updateFilterDraft(draft, "date", "9999-12-30", options);
    expect(changed.returnDate).toBe("9999-12-31");
    expect(params(filterDraftHref(query.toString(), changed)).get("returnDate")).toBe("9999-12-31");
  });
});
