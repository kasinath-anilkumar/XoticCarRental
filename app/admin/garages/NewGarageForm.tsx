"use client";

import { useActionState, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { useCurrentPlace } from "@/components/ui/useCurrentPlace";

import { createGarage } from "../actions";
import { styles } from "../styles";

/**
 * Adding a yard.
 *
 * "Use my current location" is the point of this form: a yard is a gate on an
 * industrial road, not a place a geocoder has a name for, and the person who
 * knows where it is, is standing in it. Typing coordinates off a map is the
 * fallback, not the happy path.
 */
export function NewGarageForm({ cities }: { cities: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(createGarage, null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const { locate, locating, error: locateError } = useCurrentPlace();

  const useMyLocation = async () => {
    const place = await locate();
    if (!place) return;
    setLat(place.lat.toFixed(5));
    setLng(place.lng.toFixed(5));
    setNote(`Captured where you are standing — ${place.detail}.`);
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Add a garage</h2>
      <p className={styles.cardHint}>
        Internal. Nothing here is shown to a customer — it is the point every quote measures the
        run-out and the run-back from, so put it where the car is actually parked.
      </p>

      <div className={styles.rowForm} style={{ marginBottom: "16.8px" }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void useMyLocation()}
          disabled={locating}
        >
          <Icon name="ph-crosshair" size={15} />
          {locating ? "Finding you…" : "Use my current location"}
        </button>
        {(locateError ?? note) && (
          <span className={styles.muted}>{locateError ?? note}</span>
        )}
      </div>

      <form action={formAction}>
        {state && (
          <p className={state.ok ? styles.message : styles.messageError}>
            {state.message}
          </p>
        )}

        <div className={styles.grid4}>
          <div className="field">
            <label htmlFor="new-garage-name">Name</label>
            <input
              id="new-garage-name"
              name="name"
              className="input"
              placeholder="Kochi — Kaloor yard"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="new-garage-city">City</label>
            <select id="new-garage-city" name="city_id" className="input">
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="new-garage-lat">Latitude</label>
            <input
              id="new-garage-lat"
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
            <label htmlFor="new-garage-lng">Longitude</label>
            <input
              id="new-garage-lng"
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
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Adding…" : "Add garage"}
          </button>
        </div>
      </form>
    </section>
  );
}
