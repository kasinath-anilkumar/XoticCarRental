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

    router.push(`/cars?${params.toString()}`);
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
    router.push(`/cars?${params}`);
  };

  const activePackage = packages.find((p) => p.slug === pkg);

  return (
    <div className="overflow-visible rounded-lg bg-surface shadow-[var(--shadow-lg)] max-md:p-6">
      <form
        className="grid grid-cols-[1.5fr_1fr_1fr_1.1fr_auto] items-end gap-4 p-7 [&_.input]:min-h-[46px] [&_button[aria-haspopup]]:min-h-[46px] max-xl:grid-cols-2 max-lg:grid-cols-2 max-lg:gap-4 max-md:flex max-md:flex-col max-md:items-stretch max-md:gap-4 max-md:p-0"
        onSubmit={submit}
      >
        <div className="min-w-0 max-xl:col-span-full max-lg:col-span-full">
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

        <div className="min-w-0">
          <span
            className="mb-[5px] block text-[12px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]"
            id="home-package-label"
          >
            Package
          </span>
          <div className="grid min-h-[46px] grid-cols-[repeat(auto-fit,minmax(70px,1fr))] gap-[4px] rounded-md border border-[var(--color-divider)] bg-well p-[4px]">
            {packages.map((item) => (
              <label
                key={item.slug}
                title={item.sub}
                className={`relative grid min-w-0 cursor-pointer place-items-center rounded-sm border-0 px-[6px] font-[family-name:var(--font-heading)] text-[12px] whitespace-nowrap max-md:min-h-[44px] [&_input]:pointer-events-none [&_input]:absolute [&_input]:size-0 [&_input]:opacity-0 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--color-accent)] ${
                  item.slug === pkg ? "bg-surface text-accent-text shadow-[var(--shadow-sm)]" : "bg-transparent text-[var(--color-neutral-500)] hover:text-text"
                }`}
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
        </div>

        <button
          type="submit"
          className="btn btn-solid h-[46px] px-[26px] text-[15px] whitespace-nowrap max-lg:col-span-full max-md:min-h-[50px] max-md:w-full"
        >
          <Icon name="ph-magnifying-glass" size={17} />
          See cars &amp; prices
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-6 px-8 pb-6 text-[12px] text-[var(--color-neutral-500)] max-md:mt-[4px] max-md:justify-center max-md:border-t max-md:border-[var(--color-divider)] max-md:px-0 max-md:pt-[12px] max-md:pb-0">
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
