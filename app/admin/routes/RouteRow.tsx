"use client";

import { useActionState } from "react";

import { deleteCityRoute, updateCityRoute } from "../actions";
import { styles } from "../styles";

export interface RouteRowProps {
  id: string;
  citySlug: string;
  cityName: string;
  fromName: string;
  toName: string;
  kmOverride: number | null;
  /** What the haversine model would quote, for comparison. */
  estimatedKm: number | null;
  isActive: boolean;
  sort: number;
}

export function RouteRow(props: RouteRowProps) {
  const [state, formAction, pending] = useActionState(updateCityRoute, null);
  const [, deleteAction, deleting] = useActionState(deleteCityRoute, null);

  return (
    <div style={{ borderTop: "1px solid var(--color-divider)", padding: "11.2px 0" }}>
      {state && (
        <p className={state.ok ? styles.message : styles.messageError}>
          {state.message}
        </p>
      )}

      <div className={styles.rowForm}>
        <span style={{ flex: "1 1 260px", minWidth: 0, fontSize: "14px", overflowWrap: "anywhere" }}>
          {props.fromName} → {props.toName}
          <span className={styles.muted} style={{ fontSize: "11px", display: "block" }}>
            {props.cityName}
            {props.estimatedKm != null && ` · estimate ${props.estimatedKm} km`}
          </span>
        </span>

        <form action={formAction} className={styles.rowForm}>
          <input type="hidden" name="id" value={props.id} />
          <input type="hidden" name="city_slug" value={props.citySlug} />
          <input
            name="km_override"
            className="input"
            type="number"
            min={1}
            placeholder={props.estimatedKm != null ? String(props.estimatedKm) : "km"}
            defaultValue={props.kmOverride ?? ""}
            style={{ maxWidth: "110px" }}
            aria-label={`Published km for ${props.fromName} to ${props.toName}`}
          />
          <input
            name="sort"
            className="input"
            type="number"
            defaultValue={props.sort}
            style={{ maxWidth: "76px" }}
            aria-label="Sort order"
          />
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "var(--color-neutral-400)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={props.isActive}
              style={{ width: "15px", height: "15px", accentColor: "var(--color-accent)" }}
            />
            Published
          </label>
          <button type="submit" className="btn btn-ghost" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </form>

        <form action={deleteAction}>
          <input type="hidden" name="id" value={props.id} />
          <button
            type="submit"
            className="btn btn-ghost"
            disabled={deleting}
            style={{ color: "var(--color-neutral-500)" }}
          >
            {deleting ? "Removing…" : "Remove"}
          </button>
        </form>
      </div>
    </div>
  );
}
