"use client";

import { useActionState } from "react";

import { updatePackage } from "../actions";
import { styles } from "../styles";

export interface PackageRowProps {
  id: string;
  slug: string;
  label: string;
  hours: number;
  km: number;
  rateKey: string;
  sub: string;
  icon: string;
  isActive: boolean;
  sort: number;
}

const RATE_LABELS: Record<string, string> = {
  rate_8h: "8-hour rate",
  rate_12h: "12-hour rate",
  rate_full: "Full-day rate",
};

/**
 * One package.
 *
 * The rate key is shown and not editable. It names the column on every car that
 * this package bills against — repointing it would re-price the entire fleet in
 * one click, with nothing on screen to say it had happened.
 */
export function PackageRow(props: PackageRowProps) {
  const [state, formAction, pending] = useActionState(updatePackage, null);

  return (
    <form
      action={formAction}
      style={{ borderTop: "1px solid var(--color-divider)", padding: "11.2px 0" }}
    >
      <input type="hidden" name="id" value={props.id} />

      {state && (
        <p className={state.ok ? styles.message : styles.messageError}>
          {state.message}
        </p>
      )}

      <div className={styles.rowForm}>
        <input
          name="label"
          className="input"
          defaultValue={props.label}
          style={{ maxWidth: "210px", flex: 1 }}
          aria-label={`Label for ${props.slug}`}
        />

        <label style={numberLabel}>
          Hours
          <input
            name="hours"
            className="input"
            type="number"
            step="0.5"
            min="0.5"
            defaultValue={props.hours}
            style={{ maxWidth: "80px" }}
            aria-label={`Hours in ${props.label}`}
          />
        </label>

        <label style={numberLabel}>
          Km
          <input
            name="km"
            className="input"
            type="number"
            min="1"
            defaultValue={props.km}
            style={{ maxWidth: "90px" }}
            aria-label={`Kilometres in ${props.label}`}
          />
        </label>

        <span className={styles.status} title="Which rate on each car this package bills">
          {RATE_LABELS[props.rateKey] ?? props.rateKey}
        </span>

        <input
          name="sub"
          className="input"
          defaultValue={props.sub}
          placeholder="Half day in the city"
          style={{ maxWidth: "200px" }}
          aria-label={`Subtitle for ${props.label}`}
        />

        <input
          name="icon"
          className="input"
          defaultValue={props.icon}
          style={{ maxWidth: "150px" }}
          aria-label={`Icon for ${props.label}`}
        />

        <input
          name="sort"
          className="input"
          type="number"
          defaultValue={props.sort}
          style={{ maxWidth: "70px" }}
          aria-label={`Sort order for ${props.label}`}
        />

        <label style={checkboxStyle}>
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={props.isActive}
            style={boxStyle}
          />
          Offered
        </label>

        <button type="submit" className="btn btn-ghost" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

const numberLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5.6px",
  fontSize: "12px",
  color: "var(--color-neutral-400)",
};

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
