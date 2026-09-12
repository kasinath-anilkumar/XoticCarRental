"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/ui/Icon";
import {
  BUDGET_BANDS,
  type CarFilters,
  type BrowseFilterOptions,
} from "@/lib/catalog";

import styles from "./MobileFilters.module.css";
import { saveCustomerLocation } from "@/lib/userLocation";
import { filterByZone, ZONES, type IndiaZone } from "@/lib/geo/zones";

interface MobileFiltersProps {
  catalog: BrowseFilterOptions;
  filters: CarFilters;
  /** Query string kept from the current browse session (package, pickup, etc.). */
  baseQuery: string;
}

const FILTER_KEYS = [
  "city",
  "state",
  "type",
  "occasion",
  "seats",
  "budget",
  "date",
  "sort",
] as const;

type FilterTab = "type" | "city" | "seats" | "budget" | "date" | "sort";

const TABS: Array<{ id: FilterTab; label: string; icon: string }> = [
  { id: "type", label: "Car Type", icon: "ph-car-profile" },
  { id: "city", label: "Location", icon: "ph-map-pin" },
  { id: "seats", label: "Capacity", icon: "ph-users-three" },
  { id: "budget", label: "Budget", icon: "ph-wallet" },
  { id: "date", label: "Trip Date", icon: "ph-calendar-blank" },
  { id: "sort", label: "Sort", icon: "ph-arrows-down-up" },
];

const emptySubscribe = () => () => {};

export function MobileFilters({ catalog, filters, baseQuery }: MobileFiltersProps) {
  const router = useRouter();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("type");
  const [draft, setDraft] = useState(filters);

  const close = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const activeCount = FILTER_KEYS.filter((key) => {
    const value = filters[key];
    if (key === "date") return Boolean(value);
    if (key === "sort") return value !== "popular";
    return value !== "all";
  }).length;

  const [activeZone, setActiveZone] = useState<IndiaZone>("all");
  const [citySearch, setCitySearch] = useState("");

  const carTypes = useMemo(
    () => catalog.carTypes.map((type) => type.name),
    [catalog.carTypes],
  );

  const states = useMemo(() => {
    const zoneCities = filterByZone(catalog.cities, activeZone);
    return [...new Set(zoneCities.map((c) => c.state))];
  }, [catalog.cities, activeZone]);

  const filteredCities = useMemo(() => {
    const q = citySearch.toLowerCase().trim();
    let result = catalog.cities;
    if (!q && activeZone !== "all") {
      result = filterByZone(result, activeZone);
    }
    if (!q && draft.state !== "all") {
      result = result.filter((c) => c.state === draft.state);
    }
    if (q) {
      result = catalog.cities.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q) ||
          c.slug.toLowerCase().includes(q)
      );
    }
    return result;
  }, [catalog.cities, activeZone, draft.state, citySearch]);

  const choose = (param: keyof CarFilters, value: string) => {
    setDraft((current) => {
      const next = { ...current, [param]: value };
      if (param === "state" && value !== "all") {
        const city = catalog.cities.find((item) => item.slug === next.city);
        if (city && city.state !== value) next.city = "all";
      }
      return next;
    });
  };

  const clear = () =>
    setDraft((current) => ({
      ...current,
      city: "all",
      state: "all",
      type: "all",
      occasion: "all",
      seats: "all",
      budget: "all",
      date: "",
      sort: "popular",
    }));

  const apply = () => {
    const params = new URLSearchParams(baseQuery);
    params.delete("page");
    if (!draft.date) params.delete("returnDate");
    for (const key of FILTER_KEYS) {
      const value = draft[key];
      if (
        (key === "date" && !value) ||
        (key === "sort" && value === "popular") ||
        (key !== "date" && key !== "sort" && value === "all")
      ) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    if (draft.city && draft.city !== "all") {
      const matched = catalog.cities.find((c) => c.slug === draft.city);
      saveCustomerLocation({
        citySlug: draft.city,
        cityName: matched?.name,
        state: matched?.state,
        isFromHome: false,
      });
    }
    const query = params.toString();
    setOpen(false);
    router.push(query ? `/cars?${query}` : "/cars", { scroll: false });
  };

  const isTabActive = (tabId: FilterTab) => {
    switch (tabId) {
      case "type":
        return draft.type !== "all";
      case "city":
        return draft.city !== "all" || draft.state !== "all";
      case "seats":
        return draft.seats !== "all";
      case "budget":
        return draft.budget !== "all";
      case "date":
        return Boolean(draft.date);
      case "sort":
        return draft.sort !== "popular";
      default:
        return false;
    }
  };

  // Date calculation helpers for 1-tap presets
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const weekendStr = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSaturday);
    return d.toISOString().slice(0, 10);
  }, []);

  // Summary of active draft choices
  const summaryTokens: string[] = [];
  if (draft.type !== "all") summaryTokens.push(draft.type);
  if (draft.city !== "all") {
    const cityName = catalog.cities.find((c) => c.slug === draft.city)?.name;
    if (cityName) summaryTokens.push(cityName);
  } else if (draft.state !== "all") {
    summaryTokens.push(draft.state);
  }
  if (draft.seats !== "all") {
    summaryTokens.push(
      draft.seats === "4" ? "Up to 4 seats" : draft.seats === "7" ? "5–7 seats" : "8+ seats",
    );
  }
  if (draft.budget !== "all") {
    summaryTokens.push(`Under ₹${draft.budget}`);
  }
  if (draft.date) {
    summaryTokens.push(draft.date);
  }

  const summaryText = summaryTokens.length > 0 ? summaryTokens.join(" · ") : "All vehicles in fleet";

  const modal = open ? (
    <div
      className={styles.overlay}
      aria-modal="true"
      aria-labelledby="mobile-filter-title"
    >
      <div className={styles.backdrop} onClick={close} aria-hidden="true" />

      <div className={styles.sheet}>
        <div className={styles.handle} aria-hidden="true" />

        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <p className={styles.eyebrow}>Refine fleet</p>
            <div className={styles.headerTitleRow}>
              <h2 id="mobile-filter-title">Filters</h2>
              {activeCount > 0 && <span className={styles.count}>{activeCount}</span>}
            </div>
          </div>

          <div className={styles.headerRight}>
            {summaryTokens.length > 0 && (
              <button type="button" className={styles.clearBtn} onClick={clear}>
                Clear all
              </button>
            )}
            <button
              type="button"
              className={styles.close}
              onClick={close}
              aria-label="Close filters"
            >
              <Icon name="ph-x" size={17} />
            </button>
          </div>
        </header>

        {/* Category Tabs (UI/UX Layers) */}
        <nav className={styles.tabNav} aria-label="Filter categories">
          {TABS.map((tab) => {
            const isCurrent = activeTab === tab.id;
            const hasFilter = isTabActive(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                className={`${styles.tabButton} ${isCurrent ? styles.tabButtonActive : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon name={tab.icon} size={14} />
                <span>{tab.label}</span>
                {hasFilter && <span className={styles.tabDot} />}
              </button>
            );
          })}
        </nav>

        {/* Tab Body Content */}
        <div className={styles.body}>
          {/* TAB 1: VEHICLE TYPE */}
          {activeTab === "type" && (
            <div>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Vehicle Class</h3>
                  <p className={styles.sectionSubtitle}>
                    Select your preferred luxury body style &amp; category
                  </p>
                </div>
                {draft.type !== "all" && (
                  <button
                    type="button"
                    className={styles.resetSectionBtn}
                    onClick={() => choose("type", "all")}
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className={styles.cardGrid}>
                {/* All types card */}
                <button
                  type="button"
                  className={`${styles.optionCard} ${draft.type === "all" ? styles.optionCardActive : ""}`}
                  onClick={() => choose("type", "all")}
                >
                  <div className={styles.cardIconBox}>
                    <Icon name="ph-car-simple" size={20} />
                  </div>
                  <div className={styles.cardContent}>
                    <p className={styles.cardTitle}>All Types</p>
                    <p className={styles.cardSubtitle}>
                      {catalog.carCount} cars in fleet
                    </p>
                  </div>
                  {draft.type === "all" && (
                    <div className={styles.checkBadge}>
                      <Icon name="ph-check" size={12} />
                    </div>
                  )}
                </button>

                {/* Individual types */}
                {carTypes.map((type) => {
                  const active = draft.type === type;
                  const count = catalog.carTypes.find((item) => item.name === type)?.count ?? 0;
                  const iconName =
                    type.toLowerCase().includes("sedan")
                      ? "ph-car-profile"
                      : type.toLowerCase().includes("suv")
                        ? "ph-car-profile"
                        : type.toLowerCase().includes("convertible")
                          ? "ph-sparkle"
                          : "ph-package";

                  return (
                    <button
                      key={type}
                      type="button"
                      className={`${styles.optionCard} ${active ? styles.optionCardActive : ""}`}
                      onClick={() => choose("type", type)}
                    >
                      <div className={styles.cardIconBox}>
                        <Icon name={iconName} size={20} />
                      </div>
                      <div className={styles.cardContent}>
                        <p className={styles.cardTitle}>{type}</p>
                        <p className={styles.cardSubtitle}>{count} {count === 1 ? "car" : "cars"}</p>
                      </div>
                      {active && (
                        <div className={styles.checkBadge}>
                          <Icon name="ph-check" size={12} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: LOCATION */}
          {activeTab === "city" && (
            <div>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Home City &amp; State</h3>
                  <p className={styles.sectionSubtitle}>
                    Chauffeur-driven delivery across Pan-India hubs
                  </p>
                </div>
                {(draft.city !== "all" || draft.state !== "all" || citySearch) && (
                  <button
                    type="button"
                    className={styles.resetSectionBtn}
                    onClick={() => {
                      choose("state", "all");
                      choose("city", "all");
                      setActiveZone("all");
                      setCitySearch("");
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* City Search Bar */}
              <div className="relative mb-3">
                <Icon
                  name="ph-magnifying-glass"
                  size={14}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-neutral-400)]"
                />
                <input
                  type="text"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder="Search city or airport (e.g. Mumbai, Delhi, BLR)..."
                  className="input h-[38px] w-full pl-9 pr-8 text-[13px]"
                />
                {citySearch && (
                  <button
                    type="button"
                    onClick={() => setCitySearch("")}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[var(--color-neutral-400)] hover:text-text cursor-pointer"
                  >
                    <Icon name="ph-x" size={13} />
                  </button>
                )}
              </div>

              {/* Zone Filter Pills (when not searching text) */}
              {!citySearch && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  {ZONES.map((zone) => {
                    const active = activeZone === zone.key;
                    return (
                      <button
                        key={zone.key}
                        type="button"
                        onClick={() => {
                          setActiveZone(zone.key);
                          choose("state", "all");
                        }}
                        className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                          active
                            ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-xs"
                            : "border border-[var(--color-divider)] bg-well text-[var(--color-neutral-400)] hover:text-text"
                        }`}
                      >
                        {zone.shortLabel}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* State Filter Pills */}
              {!citySearch && (
                <div className={styles.statePills}>
                  <button
                    type="button"
                    className={`${styles.statePill} ${draft.state === "all" ? styles.statePillActive : ""}`}
                    onClick={() => choose("state", "all")}
                  >
                    All States
                  </button>
                  {states.map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`${styles.statePill} ${draft.state === st ? styles.statePillActive : ""}`}
                      onClick={() => choose("state", st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}

              {/* Cities Grid */}
              <div className={styles.cardGrid}>
                <button
                  type="button"
                  className={`${styles.optionCard} ${draft.city === "all" ? styles.optionCardActive : ""}`}
                  onClick={() => choose("city", "all")}
                >
                  <div className={styles.cardIconBox}>
                    <Icon name="ph-buildings" size={20} />
                  </div>
                  <div className={styles.cardContent}>
                    <p className={styles.cardTitle}>All Cities</p>
                    <p className={styles.cardSubtitle}>Nationwide fleet</p>
                  </div>
                  {draft.city === "all" && (
                    <div className={styles.checkBadge}>
                      <Icon name="ph-check" size={12} />
                    </div>
                  )}
                </button>

                {filteredCities.map((city) => {
                  const active = draft.city === city.slug;
                  const count = city.carCount;

                  return (
                    <button
                      key={city.slug}
                      type="button"
                      className={`${styles.optionCard} ${active ? styles.optionCardActive : ""}`}
                      onClick={() => choose("city", city.slug)}
                    >
                      <div className={styles.cardIconBox}>
                        <Icon name="ph-map-pin" size={19} />
                      </div>
                      <div className={styles.cardContent}>
                        <p className={styles.cardTitle}>{city.name}</p>
                        <p className={styles.cardSubtitle}>
                          {city.state} · {count} {count === 1 ? "car" : "cars"}
                        </p>
                      </div>
                      {active && (
                        <div className={styles.checkBadge}>
                          <Icon name="ph-check" size={12} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: SEATS */}
          {activeTab === "seats" && (
            <div>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Seating Capacity</h3>
                  <p className={styles.sectionSubtitle}>
                    Comfortable passenger capacity for your journey
                  </p>
                </div>
                {draft.seats !== "all" && (
                  <button
                    type="button"
                    className={styles.resetSectionBtn}
                    onClick={() => choose("seats", "all")}
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className={styles.cardGrid}>
                {[
                  {
                    key: "all",
                    title: "Any Capacity",
                    sub: "All vehicle configurations",
                    icon: "ph-users-three",
                  },
                  {
                    key: "4",
                    title: "Up to 4 Seats",
                    sub: "Executive & couple travel",
                    icon: "ph-car-profile",
                  },
                  {
                    key: "7",
                    title: "5 to 7 Seats",
                    sub: "Families & business delegates",
                    icon: "ph-users-three",
                  },
                  {
                    key: "8",
                    title: "8+ Seats",
                    sub: "Entourages & wedding guests",
                    icon: "ph-package",
                  },
                ].map((item) => {
                  const active = draft.seats === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`${styles.optionCard} ${active ? styles.optionCardActive : ""}`}
                      onClick={() => choose("seats", item.key)}
                    >
                      <div className={styles.cardIconBox}>
                        <Icon name={item.icon} size={20} />
                      </div>
                      <div className={styles.cardContent}>
                        <p className={styles.cardTitle}>{item.title}</p>
                        <p className={styles.cardSubtitle}>{item.sub}</p>
                      </div>
                      {active && (
                        <div className={styles.checkBadge}>
                          <Icon name="ph-check" size={12} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: BUDGET */}
          {activeTab === "budget" && (
            <div>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Trip Budget Ceiling</h3>
                  <p className={styles.sectionSubtitle}>
                    Estimated all-in package rate with chauffeur, fuel &amp; tax
                  </p>
                </div>
                {draft.budget !== "all" && (
                  <button
                    type="button"
                    className={styles.resetSectionBtn}
                    onClick={() => choose("budget", "all")}
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className={styles.cardGrid}>
                <button
                  type="button"
                  className={`${styles.optionCard} ${draft.budget === "all" ? styles.optionCardActive : ""}`}
                  onClick={() => choose("budget", "all")}
                >
                  <div className={styles.cardIconBox}>
                    <Icon name="ph-wallet" size={20} />
                  </div>
                  <div className={styles.cardContent}>
                    <p className={styles.cardTitle}>Any Budget</p>
                    <p className={styles.cardSubtitle}>Explore entire luxury fleet</p>
                  </div>
                  {draft.budget === "all" && (
                    <div className={styles.checkBadge}>
                      <Icon name="ph-check" size={12} />
                    </div>
                  )}
                </button>

                {BUDGET_BANDS.map((band) => {
                  const active = draft.budget === band.key;
                  const isUltra = band.key === "30000+";

                  return (
                    <button
                      key={band.key}
                      type="button"
                      className={`${styles.optionCard} ${active ? styles.optionCardActive : ""}`}
                      onClick={() => choose("budget", band.key)}
                    >
                      <div className={styles.cardIconBox}>
                        <Icon name={isUltra ? "ph-sparkle" : "ph-currency-inr"} size={19} />
                      </div>
                      <div className={styles.cardContent}>
                        <p className={styles.cardTitle}>{band.label}</p>
                        <p className={styles.cardSubtitle}>
                          {isUltra ? "Flagship VIP & exotics" : "All-in package estimate"}
                        </p>
                      </div>
                      {active && (
                        <div className={styles.checkBadge}>
                          <Icon name="ph-check" size={12} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: DATE & SCHEDULE */}
          {activeTab === "date" && (
            <div>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Travel Date &amp; Hold</h3>
                  <p className={styles.sectionSubtitle}>
                    Real-time garage availability holds for your itinerary
                  </p>
                </div>
                {draft.date && (
                  <button
                    type="button"
                    className={styles.resetSectionBtn}
                    onClick={() => choose("date", "")}
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Quick Presets */}
              <div className={styles.datePresets}>
                <button
                  type="button"
                  className={`${styles.datePresetBtn} ${!draft.date ? styles.datePresetBtnActive : ""}`}
                  onClick={() => choose("date", "")}
                >
                  <span className={styles.datePresetTitle}>Flexible</span>
                  <span className={styles.datePresetSub}>Any date</span>
                </button>
                <button
                  type="button"
                  className={`${styles.datePresetBtn} ${draft.date === todayStr ? styles.datePresetBtnActive : ""}`}
                  onClick={() => choose("date", todayStr)}
                >
                  <span className={styles.datePresetTitle}>Today</span>
                  <span className={styles.datePresetSub}>Immediate</span>
                </button>
                <button
                  type="button"
                  className={`${styles.datePresetBtn} ${draft.date === tomorrowStr ? styles.datePresetBtnActive : ""}`}
                  onClick={() => choose("date", tomorrowStr)}
                >
                  <span className={styles.datePresetTitle}>Tomorrow</span>
                  <span className={styles.datePresetSub}>Next day</span>
                </button>
                <button
                  type="button"
                  className={`${styles.datePresetBtn} ${draft.date === weekendStr ? styles.datePresetBtnActive : ""}`}
                  onClick={() => choose("date", weekendStr)}
                >
                  <span className={styles.datePresetTitle}>This Weekend</span>
                  <span className={styles.datePresetSub}>Saturday</span>
                </button>
              </div>

              {/* Custom Date Input Block */}
              <div className={styles.customDateBlock}>
                <label className={styles.customDateLabel} htmlFor="mobile-filter-date">
                  Pick specific travel date
                </label>
                <div className={styles.dateInputRow}>
                  <input
                    id="mobile-filter-date"
                    className="input flex-1 text-[14px]"
                    type="date"
                    value={draft.date}
                    min={todayStr}
                    onChange={(event) => choose("date", event.target.value)}
                  />
                  {draft.date && (
                    <button
                      type="button"
                      className="btn btn-secondary text-[12px] px-3 py-1.5"
                      onClick={() => choose("date", "")}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className={styles.hint}>
                  Vehicles booked or undergoing maintenance on this day will be filtered out.
                </p>
              </div>
            </div>
          )}

          {/* TAB 6: SORT */}
          {activeTab === "sort" && (
            <div>
              <div className={styles.sectionHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Sort Preference</h3>
                  <p className={styles.sectionSubtitle}>
                    Order the vehicles according to your priority
                  </p>
                </div>
              </div>

              <div className={styles.cardGrid}>
                {[
                  {
                    key: "popular",
                    title: "Most Popular",
                    sub: "Proximity & customer favorites",
                    icon: "ph-sparkle",
                  },
                  {
                    key: "low",
                    title: "Price: Low to High",
                    sub: "Most affordable package first",
                    icon: "ph-caret-up",
                  },
                  {
                    key: "high",
                    title: "Price: High to Low",
                    sub: "Flagship luxury & exotics first",
                    icon: "ph-caret-down",
                  },
                ].map((item) => {
                  const active = draft.sort === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`${styles.optionCard} ${active ? styles.optionCardActive : ""}`}
                      onClick={() => choose("sort", item.key)}
                    >
                      <div className={styles.cardIconBox}>
                        <Icon name={item.icon} size={20} />
                      </div>
                      <div className={styles.cardContent}>
                        <p className={styles.cardTitle}>{item.title}</p>
                        <p className={styles.cardSubtitle}>{item.sub}</p>
                      </div>
                      {active && (
                        <div className={styles.checkBadge}>
                          <Icon name="ph-check" size={12} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Smart Pinned Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerSummary}>
            <span className={styles.footerSummaryLabel}>Active Filters</span>
            <span className={styles.footerSummaryPills} title={summaryText}>
              {summaryText}
            </span>
          </div>

          <button
            type="button"
            className={`btn btn-primary min-h-[44px] px-5 ${styles.applyBtn}`}
            onClick={apply}
          >
            Show matching cars
          </button>
        </footer>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary inline-flex min-h-[40px] items-center gap-2 px-3 py-1.5 text-[13px] font-medium"
        onClick={() => {
          setDraft(filters);
          setOpen(true);
        }}
      >
        <Icon name="ph-funnel-simple" size={15} />
        <span>Filters</span>
        {activeCount > 0 && <span className={styles.count}>{activeCount}</span>}
      </button>

      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
