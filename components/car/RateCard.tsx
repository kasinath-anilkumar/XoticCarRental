"use client";

import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Icon } from "@/components/ui/Icon";
import { ResponsiveDisclosure } from "@/components/ui/ResponsiveDisclosure";
import { formatINR } from "@/lib/format";
import { nightWindowLabel, rateFor } from "@/lib/pricing";
import { filterServiceCities, serviceStates } from "@/lib/service-areas";
import type { Car, City, Occasion, Package, SiteSettings } from "@/lib/types";

import { usePackageSelection } from "./PackageSelection";
import styles from "./RateCard.module.css";

export interface RateCardProps {
  car: Car;
  cities: City[];
  packages: Package[];
  settings: SiteSettings;
  /** The booking estimate uses the car's home city. */
  homeCitySlug: string;
  occasions: Occasion[];
}

const CITY_PAGE_SIZE = 8;

export function RateCard({ car, cities, packages, settings, homeCitySlug, occasions }: RateCardProps) {
  const { selected, select } = usePackageSelection();
  const [overrideCitySlug, setOverrideCitySlug] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState("all");
  const [visibleCityCount, setVisibleCityCount] = useState(CITY_PAGE_SIZE);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cityToggleRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const headingId = `${id}-title`;
  const cityPickerId = `${id}-cities`;

  const homeCity = cities.find((item) => item.slug === homeCitySlug);
  const city = cities.find((item) => item.slug === overrideCitySlug) ?? homeCity ?? cities[0];
  const availableStates = useMemo(() => serviceStates(cities), [cities]);
  const filteredCities = useMemo(
    () => filterServiceCities(cities, selectedState, searchQuery),
    [cities, selectedState, searchQuery],
  );

  useEffect(() => {
    if (!isSearching) return;
    const frame = requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [isSearching]);

  const closeCityPicker = () => {
    setIsSearching(false);
    cityToggleRef.current?.focus({ preventScroll: true });
  };

  if (!city || packages.length === 0) {
    return <section id="rate-card" tabIndex={-1} aria-labelledby={headingId} className={styles.rateCard}><h2 id={headingId}>Rate card</h2><p>Contact our team for this vehicle’s package rates.</p></section>;
  }

  const charges = [
    { key: "distance", name: "Extra distance", amount: `${formatINR(car.extraKmRate)} / km`, note: "Beyond the package distance" },
    { key: "time", name: "Extra time", amount: `${formatINR(car.extraHrRate)} / hr`, note: "Beyond the package hours" },
    { key: "driver", name: "Driver allowance", amount: `${formatINR(car.bata)} / day`, note: "For the chauffeur’s food and stay" },
    { key: "night", name: "Night charge", amount: formatINR(car.nightCharge), note: `Pickup between ${nightWindowLabel(settings.pricingRules)}, or an overnight halt` },
    ...occasions.filter((occasion) => occasion.surcharge > 0).map((occasion) => ({
      key: `occasion-${occasion.slug}`,
      name: `${occasion.name} handling`,
      amount: formatINR(occasion.surcharge),
      note: occasion.handlingNote,
    })),
  ];

  return (
    <section id="rate-card" tabIndex={-1} className={styles.rateCard} aria-labelledby={headingId}>
      <Suspense fallback={null}><RateCityFromQuery cities={cities} onSelect={setOverrideCitySlug} /></Suspense>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Plan with a clear price</p>
        <h2 id={headingId}>Rate card</h2>
        <p>Select a package to use it in your booking estimate.</p>
      </header>

      <div className={styles.citySummary}>
        <div className={styles.cityInfo}>
          <span className={styles.cityIcon} aria-hidden="true"><Icon name="ph-map-pin" size={18} /></span>
          <div><span className={styles.cityLabel}>Package city</span><strong>{city.name}</strong><span className={styles.cityState}>{city.state}</span></div>
        </div>
        <button
          ref={cityToggleRef}
          type="button"
          className={`btn btn-secondary ${styles.changeCity}`}
          aria-expanded={isSearching}
          aria-controls={isSearching ? cityPickerId : undefined}
          onClick={() => {
            if (isSearching) closeCityPicker();
            else { setVisibleCityCount(CITY_PAGE_SIZE); setIsSearching(true); }
          }}
        >
          Change package city
          <Icon name={isSearching ? "ph-caret-up" : "ph-caret-down"} size={14} />
        </button>
      </div>

      {isSearching && (
        <section id={cityPickerId} className={styles.cityPicker} aria-label="Package city choices">
          <div className={styles.cityPickerHeading}><h3>Choose a service city</h3><button type="button" className={styles.closePicker} onClick={closeCityPicker} aria-label="Close package city chooser"><Icon name="ph-x" size={18} /></button></div>
          <div className={styles.cityFields}>
            <label className="field">
              <span>Search service cities</span>
              <input
                ref={searchInputRef}
                className="input"
                type="search"
                placeholder="City or airport"
                value={searchQuery}
                onChange={(event) => { setSearchQuery(event.target.value); setVisibleCityCount(CITY_PAGE_SIZE); }}
              />
            </label>
            <div className="field">
              <label htmlFor={`${id}-state`}>State or territory</label>
              <select id={`${id}-state`} className="input" value={selectedState} onChange={(event) => { setSelectedState(event.target.value); setVisibleCityCount(CITY_PAGE_SIZE); }}>
                <option value="all">All states</option>
                {availableStates.map((state) => <option key={state.name} value={state.name}>{state.name} ({state.count})</option>)}
              </select>
            </div>
          </div>
          <div className={styles.cityOptions}>
            {filteredCities.slice(0, visibleCityCount).map((option) => (
              <button
                key={option.slug}
                type="button"
                className={`${styles.cityOption} ${option.slug === city.slug ? styles.cityOptionActive : ""}`}
                aria-label={`Use ${option.name} for package rates`}
                aria-pressed={option.slug === city.slug}
                onClick={() => {
                  setOverrideCitySlug(option.slug);
                  setSearchQuery("");
                  closeCityPicker();
                }}
              >
                <span><strong>{option.name}</strong><small>{option.state}</small></span>
                {option.slug === city.slug && <Icon name="ph-check" size={16} />}
              </button>
            ))}
          </div>
          {filteredCities.length === 0 && <p className={styles.noCities}>No service cities match this search. Try a different name or state.</p>}
          <div className={styles.cityResults}>
            <output>Showing {Math.min(visibleCityCount, filteredCities.length)} of {filteredCities.length} service cities</output>
            {filteredCities.length > visibleCityCount && <button type="button" className="btn btn-secondary" onClick={() => setVisibleCityCount((count) => count + CITY_PAGE_SIZE)}>Show more service cities</button>}
          </div>
        </section>
      )}

      <p className={styles.homeNote}>Booking estimate uses {homeCity?.name ?? city.name}. Choose your route for the final quote.</p>

      <div className={styles.packages}>
        {packages.map((pkg) => {
          const active = selected?.slug === pkg.slug;
          const priceId = `${id}-price-${pkg.slug}`;
          return (
            <button
              key={pkg.slug}
              type="button"
              className={`${styles.package} ${active ? styles.packageActive : ""}`}
              aria-label={`Select ${pkg.label} package`}
              aria-describedby={priceId}
              aria-pressed={active}
              data-package-slug={pkg.slug}
              onClick={() => select(pkg.slug)}
            >
              <span className={styles.packageName}>{pkg.label}</span>
              <span className={styles.packageDescription}>{pkg.sub}</span>
              <span className={styles.packagePrice} id={priceId}>{formatINR(rateFor(car, pkg.rateKey) * city.multiplier)}</span>
              <span className={styles.packageAction}>{active ? "Selected" : "Select package"}<Icon name={active ? "ph-check-circle" : "ph-arrow-right"} size={17} /></span>
            </button>
          );
        })}
      </div>

      <ResponsiveDisclosure title="Extra charges" headingLevel={3} hideTitleOnDesktop className={styles.extras}>
        <div className={styles.extrasHeading}><h3 id={`${id}-extras`}>Extra charges</h3><p>Applied according to your trip.</p></div>
        <dl className={styles.charges}>
          {charges.map((charge) => <div key={charge.key} className={styles.charge}><dt>{charge.name}{charge.note && <span>{charge.note}</span>}</dt><dd>{charge.amount}</dd></div>)}
        </dl>
      </ResponsiveDisclosure>
      <p className={styles.taxNote}>{settings.gstPercent}% GST applies to the quoted charges. Tolls, parking and permits are paid at actuals.</p>
    </section>
  );
}

function RateCityFromQuery({ cities, onSelect }: { cities: City[]; onSelect: (slug: string) => void }) {
  const params = useSearchParams();
  const slug = params.get("city");
  useEffect(() => {
    if (slug && cities.some((city) => city.slug === slug)) onSelect(slug);
  }, [slug, cities, onSelect]);
  return null;
}
