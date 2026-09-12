"use client";

import { useActionState } from "react";

import { deleteSeason, updateSeason } from "../actions";
import { styles } from "../styles";

export interface SeasonRowProps {
  id: string;
  slug: string;
  name: string;
  startsOn: string;
  endsOn: string;
  multiplier: number;
  note: string;
  isActive: boolean;
  /** Whether this window covers today, worked out on the server. */
  current: boolean;
}

/**
 * One peak window.
 *
 * The multiplier is shown as the percentage staff actually talk in — "+20%",
 * not "1.2" — because the number that goes on a customer's quote line is the
 * percentage, and an editor who reads 1.2 as "20% of" rather than "20% more"
 * has just cut the rate by four fifths.
 */
export function SeasonRow(props: SeasonRowProps) {
  const [state, formAction, pending] = useActionState(updateSeason, null);
  const [removeState, removeAction, removing] = useActionState(deleteSeason, null);

  const percent = Math.round((props.multiplier - 1) * 100);

  return (
    <div style={{ borderTop: "1px solid var(--color-divider)", padding: "11.2px 0" }}>
      {(state ?? removeState) && (
        <p className={(state ?? removeState)?.ok ? styles.message : styles.messageError}>
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
            style={{ maxWidth: "190px", flex: 1 }}
            aria-label={`Name for ${props.slug}`}
          />

          <label style={inline}>
            From
            <input
              name="startsOn"
              className="input"
              defaultValue={props.startsOn}
              placeholder="11-01"
              pattern="\d{2}-\d{2}"
              style={{ maxWidth: "84px" }}
              aria-label={`First day of ${props.name}, MM-DD`}
            />
          </label>

          <label style={inline}>
            to
            <input
              name="endsOn"
              className="input"
              defaultValue={props.endsOn}
              placeholder="02-28"
              pattern="\d{2}-\d{2}"
              style={{ maxWidth: "84px" }}
              aria-label={`Last day of ${props.name}, MM-DD`}
            />
          </label>

          <label style={inline}>
            +
            <input
              name="percent"
              className="input"
              type="number"
              min={-50}
              max={200}
              step={1}
              defaultValue={percent}
              style={{ maxWidth: "72px" }}
              aria-label={`Percentage added in ${props.name}`}
            />
            %
          </label>

          <input
            name="note"
            className="input"
            defaultValue={props.note}
            placeholder="Shown on the quote line"
            style={{ maxWidth: "240px" }}
            aria-label={`Note for ${props.name}`}
          />

          {props.current && <span className={styles.status}>on today</span>}

          <label style={inline}>
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={props.isActive}
              style={{ width: "15px", height: "15px", accentColor: "var(--color-accent)" }}
            />
            Live
          </label>

          <button type="submit" className="btn btn-ghost" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      <form action={removeAction} style={{ marginTop: "5.6px" }}>
        <input type="hidden" name="id" value={props.id} />
        <button type="submit" className="btn btn-ghost" disabled={removing} style={{ fontSize: "12px" }}>
          {removing ? "Removing…" : "Remove"}
        </button>
      </form>
    </div>
  );
}

const inline: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5.6px",
  fontSize: "12px",
  color: "var(--color-neutral-400)",
};
