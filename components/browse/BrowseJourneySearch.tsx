"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LocationCombobox } from "@/components/ui/LocationCombobox";
import { Icon } from "@/components/ui/Icon";
import { ResponsiveDisclosure } from "@/components/ui/ResponsiveDisclosure";
import { maxBrowseReturnDate } from "@/lib/browse-filters";
import type { LocationPoint, Package } from "@/lib/types";
import styles from "./Browse.module.css";

interface Props {
  baseQuery: string;
  pickup: string;
  date: string;
  returnDate: string;
  packageSlug: string;
  packages: Pick<Package, "slug" | "label">[];
  locations: LocationPoint[];
  minDate: string;
}

/** Update the search in one navigation while retaining all downstream stops. */
export function BrowseJourneySearch({ baseQuery, pickup: initialPickup, date: initialDate, returnDate: initialReturn, packageSlug, packages, locations, minDate }: Props) {
  const router = useRouter();
  const [pickup, setPickup] = useState(initialPickup);
  const [date, setDate] = useState(initialDate);
  const [returnDate, setReturnDate] = useState(initialReturn);
  const [pkg, setPackage] = useState(packageSlug);
  const [pending, startTransition] = useTransition();

  return <ResponsiveDisclosure title="Edit journey" hideTitleOnDesktop className={styles.journeyEditor}>
  <form className={styles.journeySearch} aria-label="Update your journey" aria-busy={pending} onSubmit={(event) => {
    event.preventDefault();
    const params = new URLSearchParams(baseQuery);
    params.delete("page");
    if (pickup !== initialPickup) {
      if (pickup) params.set("from", pickup);
      else params.delete("from");
      if (params.has("stops")) {
        const stops = params.get("stops")!.split("~");
        stops[0] = pickup;
        params.set("stops", stops.join("~"));
      }
    }
    if (date) params.set("date", date);
    else params.delete("date");
    if (returnDate && date) params.set("returnDate", returnDate);
    else params.delete("returnDate");
    params.set("pkg", pkg);
    startTransition(() => router.push(`/cars?${params}#fleet-results`, { scroll: false }));
  }}>
    <div className={styles.pickupField}>
      <LocationCombobox id="browse-pickup" label="Pickup location" value={pickup || null} onChange={(value) => setPickup(value ?? "")} locations={locations} placeholder="City, address or landmark" />
    </div>
    <div className={styles.searchField}><label htmlFor="browse-pickup-date">Pickup date</label><input id="browse-pickup-date" type="date" value={date} min={minDate} onChange={(event) => {
      const next = event.target.value;
      setDate(next);
      if (!next || returnDate < next || returnDate > maxBrowseReturnDate(next)) setReturnDate("");
    }} /></div>
    <div className={styles.searchField}><label htmlFor="browse-return-date">Return date (optional)</label><input id="browse-return-date" type="date" value={returnDate} min={date || minDate} max={maxBrowseReturnDate(date) || undefined} disabled={!date} onChange={(event) => setReturnDate(event.target.value)} /></div>
    <div className={styles.searchField}><label htmlFor="browse-package">Rental package</label><select id="browse-package" value={pkg} onChange={(event) => setPackage(event.target.value)}>{packages.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></div>
    <button type="submit" className={styles.searchButton} disabled={pending}><Icon name={pending ? "ph-arrows-clockwise" : "ph-magnifying-glass"} size={18} />{pending ? "Updating…" : "Update search"}</button>
  </form>
  </ResponsiveDisclosure>;
}
