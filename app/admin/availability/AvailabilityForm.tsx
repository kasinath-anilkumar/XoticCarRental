"use client";

import { useActionState } from "react";

import type { Availability } from "@/lib/store";
import { ReferenceSelect } from "@/components/admin/ReferenceSelect";

import { addAvailability, removeAvailability } from "../actions";
import { styles } from "../styles";

const STATUSES = [
  { value: "booked", label: "Booked" },
  { value: "hold", label: "Hold — unconfirmed" },
  { value: "maintenance", label: "Maintenance" },
  { value: "unavailable", label: "Temporarily unavailable" },
] as const;

/**
 * Holding a vehicle for a range of dates.
 *
 * The four statuses are the ones the brief names, and they are not
 * interchangeable to the person reading the list: a *hold* can be released for
 * a better booking, *maintenance* cannot.
 */
export function AvailabilityForm({ cars, today }: { cars?: Array<{ slug: string; name: string }>; today: string }) {
  const [state, formAction, pending] = useActionState(addAvailability, null);

  return (
    <details className={`${styles.card} ${styles.createCard}`}>
      <summary className={styles.recordSummary}><span className={styles.recordName}>Hold a vehicle</span><span className={styles.recordMeta}>Reserve dates or plan maintenance</span></summary>
      <p className={styles.cardHint}>
        The last day is inclusive: a car booked from the 14th to the 14th is unavailable for that
        one day and free on the 15th.
      </p>

      <form action={formAction}>
        {state && (
          <p className={state.ok ? styles.message : styles.messageError}>
            {state.message}
          </p>
        )}

        <div className={styles.grid4}>
          {cars ? <div className="field">
            <label htmlFor="avail-car">Vehicle</label>
            <select id="avail-car" name="carSlug" className="input" required>
              <option value="">Choose a vehicle</option>
              {cars.map((car) => (
                <option key={car.slug} value={car.slug}>
                  {car.name}
                </option>
              ))}
            </select>
          </div> : <ReferenceSelect kind="cars" name="carSlug" label="Vehicle" required />}

          <div className="field">
            <label htmlFor="avail-status">Status</label>
            <select id="avail-status" name="status" className="input" defaultValue="booked">
              {STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="avail-from">First day</label>
            <input
              id="avail-from"
              name="startsOn"
              className="input"
              type="date"
              defaultValue={today}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="avail-to">Last day</label>
            <input id="avail-to" name="endsOn" className="input" type="date" defaultValue={today} />
          </div>
        </div>

        <div className={styles.actions}>
          <input
            aria-label="Internal note"
            name="note"
            className="input"
            placeholder="Internal note — customer, job, workshop"
            style={{ maxWidth: "340px" }}
          />
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Hold vehicle"}
          </button>
        </div>
      </form>
    </details>
  );
}

export function AvailabilityRow({ entry, carName }: { entry: Availability; carName: string }) {
  const [state, formAction, pending] = useActionState(removeAvailability, null);

  return (
    <tr>
      <td>{carName}</td>
      <td>
        <span className={styles.status}>{entry.status}</span>
      </td>
      <td className={styles.muted}>{entry.startsOn}</td>
      <td className={styles.muted}>{entry.endsOn}</td>
      <td className={styles.muted}>{entry.note ?? "—"}</td>
      <td className={styles.right}>
        <form action={formAction}>
          <input type="hidden" name="id" value={entry.id} />
          <button type="submit" className="btn btn-ghost" disabled={pending}>
            {pending ? "…" : "Release"}
          </button>
          {state && !state.ok && (
            <span className={styles.muted} style={{ fontSize: "11px" }}>
              {state.message}
            </span>
          )}
        </form>
      </td>
    </tr>
  );
}
