"use client";

import { useCombobox } from "downshift";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { lastKnownCoords, useCurrentPlace } from "@/components/ui/useCurrentPlace";
import { iconForKind } from "@/lib/geo/normalize";
import { resolvePlace, type PlaceSuggestion, type PlaceToken } from "@/lib/places";
import type { LocationPoint } from "@/lib/types";


export interface LocationComboboxProps {
  id: string;
  label: string;
  /** Canonical place token submitted by native forms. */
  name?: string;
  required?: boolean;
  /** The current place token: a served slug, or an `@lat,lng,name` place. */
  value: PlaceToken | null;
  onChange: (token: PlaceToken | null) => void;
  /**
   * Our own pickup points. Not offered as suggestions — only used to put a
   * name to a slug that arrived in a link, from a city page or an older quote.
   */
  locations: LocationPoint[];
  placeholder?: string;
  /** Renders a "no return drop" choice at the top. */
  clearable?: boolean;
  clearLabel?: string;
  icon?: string;
  disabled?: boolean;
  /** Hides the "use my current location" row. */
  showCurrentLocation?: boolean;
}

/** Sentinels. A real token is a slug or starts with "@", so neither collides. */
const CURRENT = "#current";
const CLEAR = "#clear";

interface Option extends PlaceSuggestion {
  /** True for the current-location and clear rows, which are not places. */
  action: boolean;
}

/** Client-side LRU cache for geocoder queries to avoid repeat network round-trips. */
const PLACES_CACHE = new Map<string, { results: PlaceSuggestion[]; degraded: boolean; expiresAt: number }>();
const MAX_CACHE_ENTRIES = 200;

function getCachedPlaces(key: string) {
  const entry = PLACES_CACHE.get(key);
  if (!entry) return;
  PLACES_CACHE.delete(key);
  if (entry.expiresAt <= Date.now()) return;
  PLACES_CACHE.set(key, entry);
  return entry;
}

function setCachedPlaces(key: string, data: { results: PlaceSuggestion[]; degraded: boolean }) {
  PLACES_CACHE.delete(key);
  if (PLACES_CACHE.size >= MAX_CACHE_ENTRIES) {
    const firstKey = PLACES_CACHE.keys().next().value;
    if (firstKey) PLACES_CACHE.delete(firstKey);
  }
  PLACES_CACHE.set(key, { ...data, expiresAt: Date.now() + (data.degraded ? 10_000 : 300_000) });
}

/**
 * Pickup / drop picker.
 *
 * Everything it offers is live. A curated list of our own pickup points used to
 * sit at the top and rank above the search results; it is gone, because it
 * answered for thirty-three places and got in the way for the rest of India.
 * What is left is two things:
 *
 *   Use my current location — one tap, the browser's position, and the name of
 *                   whatever it lands in. On every location field, not only the
 *                   home page's search card.
 *   The geocoder    — `/api/places`, which knows villages, suburbs, terminals,
 *                   temples and roads. One of our own pickup points is still a
 *                   valid value — an old link, a city page's fare table — it is
 *                   simply not something this box suggests.
 *
 * Built on downshift so the keyboard and screen-reader behaviour is the real
 * combobox pattern rather than a div that listens for clicks.
 */
export function LocationCombobox({
  id,
  label,
  name,
  required = false,
  value,
  onChange,
  locations,
  placeholder = "Search any town, village or landmark",
  clearable = false,
  clearLabel = "No return — one-way drop",
  icon = "ph-map-pin-line",
  disabled = false,
  showCurrentLocation = true,
}: LocationComboboxProps) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  /** True when the lookup could not be made — not when it found nothing. */
  const [unreachable, setUnreachable] = useState(false);
  const { locate, locating, error: locateError, clearError } = useCurrentPlace();

  const selected = useMemo(() => resolvePlace(value, locations), [value, locations]);

  // Debounced lookup. Everything, including clearing a too-short query, happens
  // on the timer — a synchronous setState here would cost an extra render on
  // every keystroke.
  const requestId = useRef(0);
  useEffect(() => {
    const trimmed = query.trim();
    const id = ++requestId.current;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      if (disabled || trimmed.length < 2) {
        if (id === requestId.current) {
          setRemote([]);
          setUnreachable(false);
          setLoading(false);
        }
        return;
      }
      const near = lastKnownCoords();
      const nearStr = near ? `${near.lat.toFixed(4)},${near.lng.toFixed(4)}` : "";
      const cacheKey = `${trimmed.toLowerCase()}|${nearStr}`;

      const cached = getCachedPlaces(cacheKey);
      if (cached) {
        if (id === requestId.current) {
          setRemote(cached.results);
          setUnreachable(cached.degraded);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({ q: trimmed });
        // Once the visitor has shared a position with any field on the page,
        // every field ranks nearby places first — there are four Kalpettas.
        if (near) params.set("near", nearStr);

        const response = await fetch(`/api/places?${params}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]),
        });
        if (!response.ok) throw new Error(`places: ${response.status}`);
        const data = (await response.json()) as {
          results: PlaceSuggestion[];
          degraded?: boolean;
        };
        const entry = {
          results: data.results ?? [],
          degraded: Boolean(data.degraded),
        };
        setCachedPlaces(cacheKey, entry);

        // Ignore a slow response that a newer keystroke has already replaced.
        if (id !== requestId.current) return;
        setRemote(entry.results);
        setUnreachable(entry.degraded);
      } catch {
        if (id === requestId.current && !controller.signal.aborted) {
          setRemote([]);
          setUnreachable(true);
        }
      } finally {
        if (id === requestId.current && !controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, disabled]);

  const items = useMemo<Option[]>(() => {
    const head: Option[] = [];

    if (clearable) {
      head.push({
        token: CLEAR,
        name: clearLabel,
        detail: "",
        served: false,
        isAirport: false,
        action: true,
      });
    }
    if (showCurrentLocation && !disabled) {
      head.push({
        token: CURRENT,
        name: locating ? "Finding your location…" : "Use my current location",
        detail: locating ? "" : "Picked up from exactly where you are",
        served: false,
        isAirport: false,
        action: true,
      });
    }

    return [...head, ...remote.map((item): Option => ({ ...item, action: false }))];
  }, [remote, clearable, clearLabel, showCurrentLocation, disabled, locating]);

  const {
    isOpen,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getItemProps,
    highlightedIndex,
    openMenu,
    reset,
    selectItem,
  } = useCombobox({
    items,
    // Native scrolling keeps the active option inside both the menu and the
    // viewport, honoring document scroll padding for the persistent actions.
    // Downshift's boundary-only calculation can leave an off-screen menu's
    // final option clipped even after it becomes aria-activedescendant.
    scrollIntoView: (node) => node?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" }),
    inputValue: query,
    itemToString: (item) => item?.name ?? "",
    onInputValueChange: ({ inputValue, type }) => {
      // Only track typing; downshift also fires this when it writes the
      // selection back into the field, which would re-run the search.
      if (type === useCombobox.stateChangeTypes.InputChange) {
        setQuery(inputValue ?? "");
        setRemote([]);
        setUnreachable(false);
        // Editing the label must not silently submit the previous coordinates.
        if (value) onChange(null);
      }
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (!selectedItem) return;

      if (selectedItem.token === CURRENT) {
        // Downshift only calls this when the selection *changes*, so the row
        // has to un-select itself — otherwise someone whose first tap was
        // refused could never tap it again.
        selectItem(null);
        // Takes as long as the browser takes; the row and the field both say
        // so while it does, and a refusal lands in `locateError`.
        void locate().then((place) => {
          if (place) {
            onChange(place.token);
            setQuery("");
          }
        });
        return;
      }

      clearError();
      onChange(selectedItem.token === CLEAR ? null : selectedItem.token);
      setQuery("");
    },
  });

  // What the field shows when it is not being typed into.
  const display = locating
    ? "Finding your location…"
    : (selected?.name ?? (value === null && clearable ? clearLabel : ""));
  const inputProps = getInputProps({
    id,
    placeholder,
    disabled,
    value: isOpen && !locating ? query : display,
    onFocus: () => {
      if (!disabled && !isOpen) openMenu();
    },
    onClick: () => {
      if (!disabled && !isOpen) openMenu();
    },
  });

  const nothingFound = query.trim().length >= 2 && !loading && remote.length === 0;
  const firstResult = items.findIndex((item) => !item.action);

  return (
    <div className="field">
      <label {...getLabelProps({ htmlFor: id })}>
        <Icon name={icon} size={14} color="var(--color-accent)" />
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {name && <input type="hidden" name={name} value={value ?? ""} />}

      <div className="relative">
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-[11px] flex text-accent">
            <Icon name={locating ? "ph-crosshair" : pinFor(selected?.isAirport)} size={16} />
          </span>
          <input
            {...inputProps}
            className="input pr-[34px] pl-[34px] text-ellipsis max-md:pr-[44px]"
            autoComplete="off"
            required={required}
            maxLength={120}
          />
          {(selected || (clearable && value === null)) && !disabled && (
            <button
              type="button"
              className="absolute right-[6px] grid size-[24px] cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-[var(--color-neutral-500)] hover:bg-[color-mix(in_srgb,var(--color-text)_8%,transparent)] hover:text-text max-md:right-0 max-md:size-[44px]"
              aria-label={`Clear ${label.toLowerCase()}`}
              onClick={() => {
                setQuery("");
                reset();
                clearError();
                onChange(clearable ? null : "");
              }}
            >
              <Icon name="ph-x" size={13} />
            </button>
          )}
        </div>

        <ul
          {...getMenuProps()}
          className={`scroll-shadows absolute inset-x-0 top-[calc(100%+4px)] z-50 m-0 max-h-[300px] list-none overflow-y-auto rounded-md bg-surface p-[4px] shadow-[var(--shadow-lg)] ${isOpen && (items.length > 0 || nothingFound) ? "" : "hidden"}`}
        >
          {isOpen && (
            <>
              {items.map((item, index) => (
                <li key={`${item.token}-${index}`}>
                  {index === firstResult && firstResult > 0 && (
                    <div className="px-[10px] pt-[8px] pb-[4px] text-[10px] tracking-[0.1em] uppercase text-[var(--color-neutral-500)]">
                      Anywhere in India
                    </div>
                  )}
                  <div
                    {...getItemProps({ item, index })}
                    className={`flex cursor-pointer items-center gap-[10px] rounded-sm px-[10px] py-[8px] text-[14px] ${
                      highlightedIndex === index ? "bg-[var(--color-accent-900)]" : ""
                    }`}
                    aria-busy={item.token === CURRENT && locating}
                  >
                    <span
                      className={`flex flex-none ${
                        item.action
                          ? "text-accent"
                          : highlightedIndex === index
                            ? "text-accent-text"
                            : "text-[var(--color-neutral-500)]"
                      }`}
                    >
                      <Icon name={optionIcon(item)} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block overflow-hidden text-ellipsis whitespace-nowrap ${
                          item.action ? "text-accent-text" : "text-text"
                        }`}
                      >
                        {item.name}
                      </span>
                      {item.detail && (
                        <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--color-neutral-500)]">
                          {item.detail}
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              ))}
              {loading && (
                <li className="px-[10px] py-[8px] text-[12px] text-[var(--color-neutral-500)]">
                  Searching India…
                </li>
              )}
              {nothingFound && (
                <li className="px-[10px] py-[12px] text-[13px] text-[var(--color-neutral-500)]">
                  {unreachable
                    ? "Place search is unreachable just now. Try again in a moment."
                    : `Nothing on the map matches “${query.trim()}”. Check the spelling, or try the nearest town.`}
                </li>
              )}
            </>
          )}
        </ul>
      </div>

      {locateError && (
        <output className="mt-2 text-[12px] text-[var(--color-neutral-400)]">{locateError}</output>
      )}
    </div>
  );
}

function pinFor(isAirport: boolean | undefined): string {
  return isAirport ? "ph-airplane-tilt" : "ph-map-pin";
}

function optionIcon(item: Option): string {
  if (item.token === CURRENT) return "ph-crosshair";
  if (item.token === CLEAR) return "ph-minus";
  return iconForKind(item.kind);
}
