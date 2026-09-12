"use client";

import { useActionState } from "react";

import { deleteGarage, updateGarage } from "../actions";
import { styles } from "../styles";

export interface GarageRowProps {
  id: string;
  slug: string;
  name: string;
  cityId: string;
  lat: number;
  lng: number;
  isActive: boolean;
  carCount: number;
  cities: Array<{ id: string; name: string }>;
}

/**
 * One yard, saved on its own.
 *
 * The vehicle count is not decoration: moving these coordinates re-prices every
 * car based here, and knowing that eleven of them are is the difference between
 * a considered edit and an accident.
 */
export function GarageRow(props: GarageRowProps) {
  const [state, formAction, pending] = useActionState(updateGarage, null);
  const [removeState, removeAction, removing] = useActionState(deleteGarage, null);

  return (
    <div style={{ borderTop: "1px solid var(--color-divider)", padding: "11.2px 0" }}>
      {(state ?? removeState) && (
        <p
          className={(state ?? removeState)?.ok ? styles.message : styles.messageError}
        >
          {(state ?? removeState)?.message}
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="id" value={props.id} />

        <div className={styles.rowForm}>
          <input
            name="name"
            className="input"
            defaultValue={props.name}
            style={{ maxWidth: "280px", flex: 1 }}
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

          <span className={styles.muted} style={{ fontSize: "12px" }}>
            {props.carCount} {props.carCount === 1 ? "vehicle" : "vehicles"}
          </span>

          <label style={checkboxStyle}>
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={props.isActive}
              style={boxStyle}
            />
            In use
          </label>

          <button type="submit" className="btn btn-ghost" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      <form action={removeAction} style={{ marginTop: "5.6px" }}>
        <input type="hidden" name="id" value={props.id} />
        <button
          type="submit"
          className="btn btn-ghost"
          disabled={removing || props.carCount > 0}
          style={{ fontSize: "12px" }}
          title={
            props.carCount > 0
              ? "Move its vehicles to another garage first"
              : "Remove this garage"
          }
        >
          {removing ? "Removing…" : "Remove"}
        </button>
      </form>
    </div>
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
