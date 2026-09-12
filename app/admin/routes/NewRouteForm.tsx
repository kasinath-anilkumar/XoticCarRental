"use client";

import { useActionState, useState } from "react";

import { createCityRoute } from "../actions";
import { styles } from "../styles";

export interface NewRouteFormProps {
  cities: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string; cityId: string }>;
}

export function NewRouteForm({ cities, locations }: NewRouteFormProps) {
  const [state, formAction, pending] = useActionState(createCityRoute, null);
  const [cityId, setCityId] = useState(cities[0]?.id ?? "");

  // A city page's fares should start in that city; other endpoints stay
  // available because a route from Kochi legitimately ends in Munnar.
  const local = locations.filter((location) => location.cityId === cityId);
  const rest = locations.filter((location) => location.cityId !== cityId);
  const ordered = [...local, ...rest];

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Publish a route fare</h2>
      <p className={styles.cardHint}>
        These appear on the city page under “Fares people ask for most”, priced from the cheapest car
        based in that city.
      </p>

      <form action={formAction}>
        {state && (
          <p className={state.ok ? styles.message : styles.messageError}>
            {state.message}
          </p>
        )}

        <div className={styles.grid4}>
          <div className="field">
            <label htmlFor="route-city">City page</label>
            <select
              id="route-city"
              name="city_id"
              className="input"
              value={cityId}
              onChange={(event) => setCityId(event.target.value)}
            >
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="route-from">From</label>
            <select id="route-from" name="from_location_id" className="input">
              {ordered.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="route-to">To</label>
            <select id="route-to" name="to_location_id" className="input">
              {ordered.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="route-km">Road distance (km)</label>
            <input
              id="route-km"
              name="km_override"
              className="input"
              type="number"
              min={1}
              placeholder="Leave blank to estimate"
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Adding…" : "Add route"}
          </button>
        </div>
      </form>
    </section>
  );
}
