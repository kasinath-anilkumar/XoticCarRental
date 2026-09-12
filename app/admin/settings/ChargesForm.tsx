"use client";

import { useActionState, useState } from "react";

import type { ExtraCharge } from "@/lib/types";

import { updateCharges } from "../actions";
import { styles } from "../styles";

const APPLIES = [
  { value: "always", label: "Every trip" },
  { value: "outstation", label: "Outstation only" },
  { value: "interstate", label: "Crossing a state line" },
] as const;

/**
 * Tolls, parking and permits (§10).
 *
 * Each of these is a switch and a number, and each one ships off, because the
 * site currently tells customers that tolls, parking and entry fees are paid
 * at actuals. Turning one on without editing that sentence would make the
 * quote and the policy contradict each other on the same page — so the form
 * says so where the switch is, rather than in a wiki nobody reads.
 *
 * "Crossing a state line" is only detected between our own pickup points,
 * which are the only places that carry a city and therefore a state. A trip
 * plotted to a free coordinate is treated as staying put; staff catch the rest
 * when they confirm.
 */
export function ChargesForm({ charges }: { charges: ExtraCharge[] }) {
  const [state, formAction, pending] = useActionState(updateCharges, null);

  const [rows, setRows] = useState<Array<Omit<ExtraCharge, "amount"> & { amount: number | string }>>(charges);

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Tolls, parking and permits</h2>
      <p className={styles.cardHint}>
        Add a configured charge and enable it to include a separate line on every matching quote — and the &ldquo;at actuals&rdquo; line
        in <strong>Not included</strong> above needs editing to match, or the page will say both
        things at once.
      </p>

      <form action={formAction}>
        {state && (
          <p className={state.ok ? styles.message : styles.messageError}>{state.message}</p>
        )}

        {rows.map((row, index) => (
          <div
            key={row.key}
            style={{ borderTop: "1px solid var(--color-divider)", padding: "11.2px 0" }}
          >
            <input type="hidden" name={`key-${index}`} value={row.key} />

            <div className={styles.rowForm}>
              <input
                name={`label-${index}`}
                className="input"
                defaultValue={row.label}
                required
                style={{ maxWidth: "190px", flex: 1 }}
                aria-label={`Name for ${row.key}`}
              />

              <label style={inline}>
                ₹
                <input
                  name={`amount-${index}`}
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  defaultValue={row.amount}
                  style={{ maxWidth: "100px" }}
                  aria-label={`Amount for ${row.label}`}
                />
              </label>

              <select
                name={`appliesTo-${index}`}
                className="input"
                defaultValue={row.appliesTo}
                aria-label={`When ${row.label} applies`}
                style={{ maxWidth: "180px" }}
              >
                {APPLIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <input
                name={`note-${index}`}
                className="input"
                defaultValue={row.note}
                placeholder="Shown under the line"
                style={{ maxWidth: "260px" }}
                aria-label={`Note for ${row.label}`}
              />

              <label style={inline}>
                <input
                  type="checkbox"
                  name={`isActive-${index}`}
                  defaultChecked={row.isActive}
                  style={{ width: "15px", height: "15px", accentColor: "var(--color-accent)" }}
                />
                Bill it
              </label>
              <button type="button" className="btn btn-ghost" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>Remove charge</button>
            </div>
          </div>
        ))}

        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" disabled={rows.length >= 20} onClick={() => setRows((current) => [...current, { key: crypto.randomUUID(), label: "", note: "", amount: "", appliesTo: "always", isActive: false }])}>Add charge</button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save charges"}
          </button>
        </div>
      </form>
    </section>
  );
}

const inline: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5.6px",
  fontSize: "12px",
  color: "var(--color-neutral-400)",
};
