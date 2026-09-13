"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Media } from "@/components/ui/Media";
import { formatINR } from "@/lib/format";
import { filterServiceCities, serviceStates } from "@/lib/service-areas";
import styles from "./CitiesDirectory.module.css";

export interface CityDirectoryItem {
  slug: string;
  name: string;
  state: string;
  multiplier: number;
  heroImage: string | null;
  carCount: number;
  basedCount: number;
  pickupsCount: number;
  airportName: string | null;
  fromPrice: number | null;
  topRoute: { name: string; km: number; price: number } | null;
  fares: Array<{
    name: string;
    fromSlug: string;
    toSlug: string;
    packageSlug: string;
    km: number;
    price: number;
  }>;
}

export interface CitiesDirectoryProps {
  cities: CityDirectoryItem[];
  states: string[];
  totalRoutes: number;
  defaultPackageLabel: string;
  gstPercent: number;
}

const PAGE_SIZE = 12;

/** Published service-city search with state filters and progressive rendering. */
export function CitiesDirectory({
  cities,
  states,
  totalRoutes,
  defaultPackageLabel,
  gstPercent: _gstPercent,
}: CitiesDirectoryProps) {
  const [activeState, setActiveState] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  const filteredCities = useMemo(() => filterServiceCities(cities, activeState, searchQuery), [cities, activeState, searchQuery]);
  const availableStates = useMemo(() => serviceStates(cities), [cities]);

  const visibleCities = useMemo(() => {
    return filteredCities.slice(0, visibleCount);
  }, [filteredCities, visibleCount]);

  return (
    <div>
      <p className={styles.summary}><span><strong>{cities.length}</strong> service cities</span><span><strong>{states.length}</strong> states</span><span><strong>{totalRoutes}</strong> published routes</span></p>
      <div className={styles.filters}>
        <label className="field"><span>State or territory</span><select className="input" value={activeState} onChange={(event) => { setActiveState(event.target.value); setVisibleCount(PAGE_SIZE); }}><option value="all">All states</option>{availableStates.map((state) => <option key={state.name} value={state.name}>{state.name} ({state.count})</option>)}</select></label>
        <label className="field"><span>Find your city</span><div className={styles.search}><input className="input w-full" type="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Search service cities or airports" aria-label="Search service cities or airports" />{searchQuery && <button type="button" aria-label="Clear search" onClick={() => setSearchQuery("")}><Icon name="ph-x" size={17} /></button>}</div></label>
      </div>
      <output className={styles.count}>Showing {visibleCities.length} of {filteredCities.length} service cities{activeState !== "all" ? ` in ${activeState}` : ""}{searchQuery ? ` matching "${searchQuery}"` : ""}</output>
      {visibleCities.length ? <div className={styles.grid}>{visibleCities.map((city) => <article key={city.slug} className={styles.card}>
        <Link href={`/cities/${city.slug}`} prefetch={false} className={styles.photo} aria-label={`Explore ${city.name}`}><Media src={city.heroImage} alt="" placeholder={city.name} className="absolute inset-0" icon="ph-map-pin" sizes="(max-width: 767px) 76px, (max-width: 1000px) 50vw, 33vw" /></Link>
        <div className={styles.body}><p className={styles.state}>{city.state}</p><h2 className={styles.name}><Link href={`/cities/${city.slug}`} prefetch={false}>{city.name}</Link></h2><p className={styles.meta}><span>{city.basedCount} cars based here</span><span>{city.pickupsCount} pickup points</span></p>
        <div className={styles.price}><small>{defaultPackageLabel} from</small><strong>{city.fromPrice !== null ? formatINR(city.fromPrice) : "Enquire for pricing"}</strong></div><div className={styles.links}><Link href={`/cities/${city.slug}`} prefetch={false}>City &amp; rates</Link><Link href={`/cars?city=${city.slug}`} prefetch={false}>View cars <Icon name="ph-arrow-right" size={16} /></Link></div></div>
      </article>)}</div> : <div className={styles.empty}><Icon name="ph-map-pin" size={32} /><h3>No hubs found matching &quot;{searchQuery}&quot;</h3><p>Try another service area, or contact our team to check your destination.</p><button type="button" className="btn btn-secondary" onClick={() => { setSearchQuery(""); setVisibleCount(PAGE_SIZE); setActiveState("all"); }}>Clear filters &amp; view all hubs</button></div>}
      {filteredCities.length > visibleCount && <div className={styles.more}><button type="button" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)} className="btn btn-secondary">Show more hubs ({filteredCities.length - visibleCount} remaining) <Icon name="ph-plus" size={17} /></button></div>}
    </div>
  );
}
