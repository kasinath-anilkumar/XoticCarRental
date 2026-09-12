"use client";

import { useActionState } from "react";

import { createSeason } from "../actions";
import { styles } from "../styles";

/**
 * Adding a peak window.
 *
 * The dates are MM-DD on purpose: this is a time of year, not a set of dates.
 * Storing 2026-11-01 would mean re-entering every season each January, and
 * forgetting one the year somebody is on leave.
 */
export function NewSeasonForm() {
  const [state, formAction, pending] = useActionState(createSeason, null);

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Add a season</h2>
      <p className={styles.cardHint}>
        Both ends are inclusive and repeat every year. To cover November through February, put{" "}
        <code>11-01</code> to <code>02-28</code> — the window wraps past New Year on its own.
      </p>

      <form action={formAction}>
        {state && (
          <p className={state.ok ? styles.message : styles.messageError}>{state.message}</p>
        )}

        <div className={styles.grid4}>
          <div className="field">
            <label htmlFor="season-name">Name</label>
            <input
              id="season-name"
              name="name"
              className="input"
              placeholder="Wedding season"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="season-from">First day (MM-DD)</label>
            <input
              id="season-from"
              name="startsOn"
              className="input"
              placeholder="11-01"
              pattern="\d{2}-\d{2}"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="season-to">Last day (MM-DD)</label>
            <input
              id="season-to"
              name="endsOn"
              className="input"
              placeholder="02-28"
              pattern="\d{2}-\d{2}"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="season-percent">Added to the package (%)</label>
            <input
              id="season-percent"
              name="percent"
              className="input"
              type="number"
              min={-50}
              max={200}
              step={1}
              defaultValue={20}
              required
            />
          </div>
        </div>

        <div className={styles.actions}>
          <input
            name="note"
            className="input"
            placeholder="Why — it goes on the customer's quote line"
            style={{ maxWidth: "380px" }}
          />
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Adding…" : "Add season"}
          </button>
        </div>
      </form>
    </section>
  );
}
