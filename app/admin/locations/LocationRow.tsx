"use client";

import { useActionState } from "react";

import { updateLocation } from "../actions";
import { styles } from "../styles";

export interface LocationRowProps {
  id: string;
  slug: string;
  name: string;
  cityId: string;
  cityLabel: string;
  lat: number;
  lng: number;
  isAirport: boolean;
  isActive: boolean;
  sort: number;
  cities: Array<{ id: string; name: string }>;
}

/** One editable location, saved on its own so a mistake never spans the list. */
export function LocationRow(props: LocationRowProps) {
  const [state, formAction, pending] = useActionState(updateLocation, null);

  return (
    <form
      action={formAction}
      style={{
        borderTop: "1px solid var(--color-divider)",
        padding: "11.2px 0",
      }}
    >
      <input type="hidden" name="id" value={props.id} />

      {state && (
        <p className={state.ok ? styles.message : styles.messageError}>
          {state.message}
        </p>
      )}

      <div className={styles.rowForm}>
        <input
          name="name"
          className="input"
          defaultValue={props.name}
          style={{ maxWidth: "260px", flex: 1 }}
          aria-label={`Name for ${props.slug}`}
        />

        <select
          name="city_id"
          className="input"
          defaultValue={props.cityId}
          aria-label={`City for ${props.name}`}
        >
          {props.cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>

        <input
          name="lat"
          className="input"
          type="number"
          step="0.00001"
          defaultValue={props.lat}
          aria-label={`Latitude for ${props.name}`}
        />
        <input
          name="lng"
          className="input"
          type="number"
          step="0.00001"
          defaultValue={props.lng}
          aria-label={`Longitude for ${props.name}`}
        />
        <input
          name="sort"
          className="input"
          type="number"
          defaultValue={props.sort}
          style={{ maxWidth: "76px" }}
          aria-label={`Sort order for ${props.name}`}
        />

        <label style={checkboxStyle}>
          <input type="checkbox" name="is_airport" defaultChecked={props.isAirport} style={boxStyle} />
          Airport
        </label>
        <label style={checkboxStyle}>
          <input type="checkbox" name="is_active" defaultChecked={props.isActive} style={boxStyle} />
          Live
        </label>

        <button type="submit" className="btn btn-ghost" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

const checkboxStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "12px",
  cursor: "pointer",
  color: "var(--color-neutral-400)",
};

const boxStyle: React.CSSProperties = {
  width: "15px",
  height: "15px",
  accentColor: "var(--color-accent)",
};
