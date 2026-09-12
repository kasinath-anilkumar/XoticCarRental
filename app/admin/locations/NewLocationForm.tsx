"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { useCurrentPlace } from "@/components/ui/useCurrentPlace";
import { iconForKind } from "@/lib/geo/normalize";
import type { GeoKind } from "@/lib/geo/types";

import { createLocation } from "../actions";
import { styles } from "../styles";

interface Place {
  name: string;
  lat: number;
  lng: number;
  /** "Nedumbassery, Aluva, Kerala" */
  detail: string;
  state: string;
  kind: GeoKind;
  /** Former names, from the bundled index. */
  aka?: string[];
}

export interface NewLocationFormProps {
  cities: Array<{ id: string; name: string }>;
}

/**
 * Adding a pickup point.
 *
 * The lookup searches as you type, against the bundled GeoNames index *and* a
 * live geocoder. That second half is what changed: the index only holds towns
 * over 10,000 people, so every airport, jetty, temple and resort we park at had
 * to have its coordinates pasted in from a map by hand. Those are findable by
 * name now — "Cochin International Airport" resolves to the terminal, not to
 * the middle of Kochi.
 *
 * Two things are deliberately kept:
 *
 *   the editable lat/lng — a geocoder gives you the centroid of whatever
 *   polygon it matched, and the car waits at a specific gate.
 *   the free-text name — what we call a pickup point is a customer-facing
 *   decision ("Cochin Intl Airport (COK)"), not the map's to make.
 */
export function NewLocationForm({ cities }: NewLocationFormProps) {
  const [state, formAction, pending] = useActionState(createLocation, null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const { locate, locating, error: locateError } = useCurrentPlace();

  // Search as they type. The server caches and rate-limits, so a debounce here
  // is about not flashing a half-matched list at somebody, not about load.
  const requestId = useRef(0);
  useEffect(() => {
    const trimmed = query.trim();
    const id = ++requestId.current;

    const timer = setTimeout(async () => {
      if (trimmed.length < 2) {
        if (id === requestId.current) {
          setResults([]);
          setSearching(false);
        }
        return;
      }
      setSearching(true);
      try {
        const response = await fetch(`/api/admin/geocode?q=${encodeURIComponent(trimmed)}`);
        const data = (await response.json()) as { results: Place[]; error?: string };
        if (id !== requestId.current) return;
        setResults(data.results ?? []);
        setLookupNote(data.error ?? null);
      } catch {
        if (id === requestId.current) {
          setResults([]);
          setLookupNote("The lookup failed. You can still enter coordinates by hand.");
        }
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const choose = (place: Place) => {
    setName(place.name);
    setLat(String(place.lat));
    setLng(String(place.lng));
    setResults([]);
    setQuery("");
    setLookupNote(
      `Filled from ${[place.name, place.detail].filter(Boolean).join(" — ")}. Move the marker if the car waits somewhere more precise.`,
    );
  };

  /** For staff standing at the pickup point with a phone. */
  const useMyLocation = async () => {
    const place = await locate();
    if (!place) return;
    setLat(place.lat.toFixed(5));
    setLng(place.lng.toFixed(5));
    if (!name) setName(place.name);
    setLookupNote(`Captured where you are standing — ${place.detail}.`);
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Add a pickup point</h2>
      <p className={styles.cardHint}>
        Coordinates drive every distance the calculator quotes, so put the marker where the car
        actually waits.
      </p>

      <div className={styles.rowForm} style={{ marginBottom: "16.8px" }}>
        <input
          className="input"
          placeholder="Find a place — a city, a village, an airport, a temple"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ maxWidth: "340px" }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void useMyLocation()}
          disabled={locating}
        >
          <Icon name="ph-crosshair" size={15} />
          {locating ? "Finding you…" : "Use my current location"}
        </button>
        {searching && <span className={styles.muted}>Searching…</span>}
      </div>

      {results.length > 0 && (
        <div className={styles.tableWrap} style={{ marginBottom: "16.8px" }}>
          <table className="table">
            <tbody>
              {results.map((place) => (
                <tr key={`${place.name}-${place.lat}-${place.lng}`}>
                  <td>
                    <Icon name={iconForKind(place.kind)} size={15} />
                  </td>
                  <td>
                    {place.name}
                    {place.aka && (
                      <span className={styles.muted} style={{ fontSize: "11px" }}>
                        {" "}
                        ({place.aka.join(", ")})
                      </span>
                    )}
                  </td>
                  <td className={styles.muted}>{place.detail || place.state}</td>
                  <td className={styles.muted}>
                    {place.lat}, {place.lng}
                  </td>
                  <td className={styles.right}>
                    <button type="button" className="btn btn-ghost" onClick={() => choose(place)}>
                      Use
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(locateError ?? lookupNote) && (
        <p className={styles.cardHint}>{locateError ?? lookupNote}</p>
      )}

      <form action={formAction}>
        {state && (
          <p className={state.ok ? styles.message : styles.messageError}>
            {state.message}
          </p>
        )}

        <div className={styles.grid4}>
          <div className="field">
            <label htmlFor="new-loc-name">Name shown to visitors</label>
            <input
              id="new-loc-name"
              name="name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Cochin Intl Airport (COK)"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="new-loc-city">City</label>
            <select id="new-loc-city" name="city_id" className="input">
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="new-loc-lat">Latitude</label>
            <input
              id="new-loc-lat"
              name="lat"
              className="input"
              type="number"
              step="0.00001"
              value={lat}
              onChange={(event) => setLat(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="new-loc-lng">Longitude</label>
            <input
              id="new-loc-lng"
              name="lng"
              className="input"
              type="number"
              step="0.00001"
              value={lng}
              onChange={(event) => setLng(event.target.value)}
              required
            />
          </div>
        </div>

        <div className={styles.actions}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="is_airport"
              style={{ width: "16px", height: "16px", accentColor: "var(--color-accent)" }}
            />
            This is an airport
          </label>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Adding…" : "Add location"}
          </button>
        </div>
      </form>
    </section>
  );
}
