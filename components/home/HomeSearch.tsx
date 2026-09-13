"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { DateField } from "@/components/ui/DateField";
import { Icon } from "@/components/ui/Icon";
import { LocationCombobox } from "@/components/ui/LocationCombobox";
import { useCurrentPlace } from "@/components/ui/useCurrentPlace";
import { resolvePlace, type PlaceToken } from "@/lib/places";
import { addDays, isISODate } from "@/lib/dates";
import { MAX_TRIP_DAYS } from "@/lib/trip-limits";
import type { LocationPoint, Package } from "@/lib/types";

import { StatePicker, type StateCity } from "./StatePicker";
import { saveCustomerLocation, useCustomerLocation } from "@/lib/userLocation";
import styles from "./HomeSearch.module.css";

export interface HomeSearchProps {
  /** Only used to name a pickup point that arrived in a link. */
  locations: LocationPoint[];
  /** For the State → city path (§3), beside the free-text search. */
  cities: StateCity[];
  packages: Array<Pick<Package, "slug" | "label" | "sub">>;
  defaults: { from: PlaceToken; date: string; packageSlug: string };
  /** Today, from the server, so the calendar's floor is not a hydration guess. */
  minDate: string;
}

/**
 * The hero's search card.
 *
 * It does not search — it hands the visitor to the browse page with what they
 * picked. Three things changed from the version this replaces: the pickup field
 * is a combobox over every place in India instead of a 33-item select, the date
 * is a calendar instead of a `dd-mm-yyyy` mask, and the package is a row of
 * visible choices instead of a dropdown, because which package you want moves
 * the price more than anything else here and should not be hidden behind a
 * click.
 *
 * Trip type, drop-off and pickup time deliberately stay in the calculator. This
 * card leads to a fleet list, and none of those three change which cars show.
 *
 * Neither does what the trip is for, which is why the four occasion tabs that
 * used to sit on top of this card are gone. An occasion still colours a quote
 * for someone who arrives from an occasion page; it is no longer a question
 * asked of someone who only wants to know what a car costs.
 */
export function HomeSearch({
  locations,
  cities,
  packages,
  defaults,
  minDate,
}: HomeSearchProps) {
  const router = useRouter();
  const { location, clearLocation } = useCustomerLocation();
  const [chosenFrom, setFrom] = useState<PlaceToken | null | undefined>(defaults.from || undefined);
  // useSyncExternalStore supplies the server snapshot during hydration, then
  // restores the browser's saved pickup without rendering mismatched markup.
  const from = chosenFrom === undefined ? location?.token ?? null : chosenFrom;
  const [date, setDate] = useState(defaults.date);
  const [returnDate, setReturnDate] = useState("");
  const [pkg, setPkg] = useState(defaults.packageSlug);
  const { locate, locating, error: locateError } = useCurrentPlace();
  const [locateNote, setLocateNote] = useState<string | null>(null);

  const handleFromChange = (token: PlaceToken | null) => {
    setFrom(token);
    setLocateNote(null);
    if (!token) {
      clearLocation();
      return;
    }
    const place = resolvePlace(token, locations);
    const matchedCity = place?.citySlug
      ? cities.find((c) => c.slug === place.citySlug)
      : undefined;
    saveCustomerLocation({
      token,
      name: place?.name ?? undefined,
      citySlug: place?.citySlug ?? undefined,
      cityName: matchedCity?.name,
      state: matchedCity?.state,
      isFromHome: true,
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams({ pkg });
    if (from) params.set("from", from);
    if (date) params.set("date", date);
    if (returnDate) params.set("returnDate", returnDate);

    // A served pickup point also narrows the fleet to its city. A free place
    // anywhere in India does not — we have no cars parked there, and filtering
    // to an empty result would be worse than showing the whole fleet.
    const place = resolvePlace(from, locations);
    const matchedCity = place?.citySlug
      ? cities.find((c) => c.slug === place.citySlug)
      : undefined;

    if (from) {
      saveCustomerLocation({
        token: from,
        name: place?.name ?? undefined,
        citySlug: place?.citySlug ?? undefined,
        cityName: matchedCity?.name,
        state: matchedCity?.state,
        isFromHome: true,
      });
    }

    if (place?.served && place.citySlug) params.set("city", place.citySlug);

    router.push(`/cars?${params.toString()}#fleet-results`);
  };

  /**
   * Sets the pickup to where the visitor actually is.
   *
   * This used to snap to the nearest curated pickup point, which was a polite
   * way of saying "not there" — someone standing in Aluva was told their trip
   * started at Marine Drive, 25 km and an hour of traffic away. A trip can
   * start anywhere now, so the pickup is the position itself, named by whatever
   * the geocoder finds around it.
   */
  const useMyLocation = async () => {
    setLocateNote(null);
    const place = await locate();
    if (!place) return;
    setFrom(place.token);
    setLocateNote(`Pickup set to ${place.name}`);
    const resolved = resolvePlace(place.token, locations);
    const matchedCity = resolved?.citySlug
      ? cities.find((c) => c.slug === resolved.citySlug)
      : undefined;
    saveCustomerLocation({
      token: place.token,
      name: place.name,
      citySlug: resolved?.citySlug ?? undefined,
      cityName: matchedCity?.name,
      state: matchedCity?.state,
      isFromHome: true,
    });
  };

  /** Coverage browsing does not invent a pickup address for the customer. */
  const pickCity = (citySlug: string) => {
    if (!cities.some((city) => city.slug === citySlug)) return;
    const params = new URLSearchParams({ city: citySlug, pkg });
    if (from) params.set("from", from);
    if (date) params.set("date", date);
    if (returnDate) params.set("returnDate", returnDate);
    router.push(`/cars?${params}#fleet-results`);
  };

  const activePackage = packages.find((p) => p.slug === pkg);

  return (
    <div className={styles.card}>
      <div className={styles.heading}><p>Where are you headed?</p><Icon name="ph-map-pin" size={22} /></div>
      <form
        className={styles.form}
        onSubmit={submit}
      >
        <div className={styles.pickup}>
          <LocationCombobox
            id="home-from"
            label="Pickup location"
            value={from}
            onChange={handleFromChange}
            locations={locations}
            placeholder="Search any town, village or landmark"
          />
        </div>

        <div className="min-w-0">
          <DateField
            id="home-date"
            label="Pickup date"
            value={date}
            onChange={(d) => {
              setDate(d);
              if (returnDate && isISODate(d) && (d > returnDate || returnDate > addDays(d, MAX_TRIP_DAYS - 1))) setReturnDate("");
            }}
            min={minDate}
          />
        </div>

        <div className="min-w-0">
          <DateField
            id="home-return-date"
            label="Return date (opt)"
            value={returnDate}
            onChange={setReturnDate}
            min={date || minDate}
            max={isISODate(date) ? addDays(date, MAX_TRIP_DAYS - 1) : undefined}
            clearable
          />
        </div>

        <fieldset className={styles.packages}>
          <legend>Choose a package</legend>
          <div className={styles.packageChoices}>
            {packages.map((item) => (
              <label
                key={item.slug}
                title={item.sub}
                className={styles.packageChoice}
              >
                {/* A real radio, visually hidden: arrow-key behaviour, form
                    semantics and screen-reader announcement come free. */}
                <input
                  type="radio"
                  name="home-package"
                  value={item.slug}
                  checked={item.slug === pkg}
                  onChange={() => setPkg(item.slug)}
                />
                {shortPackage(item.label)}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className={`btn btn-solid ${styles.submit}`}
        >
          <Icon name="ph-magnifying-glass" size={17} />
          See cars &amp; prices
        </button>
      </form>

      <div className={styles.options}>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent p-0 text-inherit [font:inherit] hover:text-accent-text disabled:cursor-progress disabled:opacity-70 max-md:min-h-[44px]"
          onClick={() => void useMyLocation()}
          disabled={locating}
        >
          <Icon name="ph-crosshair" size={14} color="var(--color-accent)" />
          {locating ? "Finding you…" : "Use my current location"}
        </button>
        <StatePicker cities={cities} onPick={pickCity} />

        {(locateError ?? locateNote) ? (
          <span className="text-[var(--color-neutral-400)]">{locateError ?? locateNote}</span>
        ) : (
          <span className="max-md:hidden">{activePackage?.sub}</span>
        )}
      </div>
    </div>
  );
}

/** "8 hrs / 80 km" -> "8h / 80km", so three choices sit on one line. */
function shortPackage(label: string): string {
  return label
    .replace(/Full day\s*/i, "")
    .replace(/\s*hrs?\s*/i, "h ")
    .replace(/\s+km/i, "km")
    .replace(/\s+/g, " ")
    .trim();
}
