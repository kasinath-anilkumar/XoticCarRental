"use client";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";

import { useActionState, useState } from "react";

import { formatINR } from "@/lib/format";
import { LEAD_STATUS_LABELS, LEAD_STATUSES } from "@/lib/leads";
import type { LeadDetail, LeadStop } from "@/lib/store";

import { updateLead } from "../actions";
import { styles } from "../styles";
import { statusClass } from "../status";

export interface LeadRowProps {
  id: string;
  leadId: string;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  customerPlace: string | null;
  carName: string;
  packageLabel: string;
  serviceName: string;
  tripType: string;
  stops: LeadStop[];
  pickup: string;
  km: number;
  transferKm: number;
  hours: number;
  days: number;
  total: string;
  advance: string;
  lines: Array<{ label: string; note?: string; amount: number }>;
  /** What the service's own form asked (§12). Empty for quote captures. */
  details: LeadDetail[];
  /** A quote capture carries a price; a service enquiry does not, yet. */
  quoted: boolean;
  status: string;
  assignedTo: string | null;
  followUpOn: string | null;
  overdue: boolean;
  notes: string | null;
}

/**
 * One lead, as a worklist row.
 *
 * The reference leads, because that is what the customer will say on the phone.
 * Everything a staff member can change — status, owner, next chase, note — is
 * in one form that saves in one go: a dashboard that needs four round trips to
 * record a phone call does not get used.
 */
export function LeadRow(props: LeadRowProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateLead, null);

  const route = props.stops.map((stop) => stop.name).join(" → ");

  return (
    <section className={styles.card} style={props.overdue ? { borderLeft: "3px solid var(--color-accent)" } : undefined}>
      <div style={{ display: "flex", gap: "16.8px", alignItems: "baseline", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px", minWidth: 0, overflowWrap: "anywhere" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: "17px" }}>
            {props.leadId || "—"}
            <span
              className={statusClass(props.status)}
              style={{ marginLeft: "8.4px" }}
            >
              {LEAD_STATUS_LABELS[props.status as keyof typeof LEAD_STATUS_LABELS] ?? props.status}
            </span>
            {props.overdue && (
              <span className={styles.status} style={{ marginLeft: "5.6px" }}>
                due {props.followUpOn}
              </span>
            )}
          </p>
          <p className={styles.muted} style={{ margin: "2px 0 0", fontSize: "12px" }}>
            {props.customerName || props.customerPhone
              ? [props.customerName, props.customerPhone].filter(Boolean).join(" · ")
              : "No contact details left"}
            {props.customerPlace ? ` · from ${props.customerPlace}` : ""}
          </p>
        </div>

        <div className={styles.muted} style={{ fontSize: "12px", flex: "1 1 220px", minWidth: 0, overflowWrap: "anywhere" }}>
          {props.serviceName}
          {props.quoted ? (
            <>
              <br />
              {props.carName} · {props.packageLabel}
              <br />
              {props.tripType} · {props.km} km
              {props.transferKm > 0 ? ` (incl. ${props.transferKm} km transfer)` : ""} ·{" "}
              {props.hours} hr
              {props.days > 1 ? ` · ${props.days} days` : ""}
              <br />
              Pickup {props.pickup}
              {route && (
                <>
                  <br />
                  {route}
                </>
              )}
            </>
          ) : (
            <>
              <br />
              {props.pickup}
            </>
          )}
        </div>

        {props.quoted ? (
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-heading)",
                fontSize: "21px",
                color: "var(--color-accent-300)",
              }}
            >
              {props.total}
            </p>
            <p className={styles.muted} style={{ margin: 0, fontSize: "11px" }}>
              {props.advance} advance
            </p>
          </div>
        ) : (
          <p className={styles.muted} style={{ margin: 0, fontSize: "12px", textAlign: "right" }}>
            Needs a quote
          </p>
        )}

        {(props.quoted || props.details.length > 0) && (
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(!open)}>
            {open ? "Hide" : props.quoted ? "Breakdown" : "Answers"}
          </button>
        )}
      </div>

      {open && props.details.length > 0 && (
        <HorizontalScroll label="Enquiry answers" controls="above" className="mt-4">
          <table className="table min-w-[420px]">
            <tbody>
              {props.details.map((detail) => (
                <tr key={detail.label}>
                  <td className={styles.muted} style={{ width: "40%" }}>
                    {detail.label}
                  </td>
                  <td>{detail.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScroll>
      )}

      {open && props.quoted && (
        <HorizontalScroll label="Enquiry quote breakdown" controls="above" className="mt-4">
          <table className="table min-w-[420px]">
            <tbody>
              {props.lines.map((line, index) => (
                <tr key={`${line.label}-${index}`}>
                  <td>
                    {line.label}
                    {line.note && (
                      <div className={styles.muted} style={{ fontSize: "11px" }}>
                        {line.note}
                      </div>
                    )}
                  </td>
                  <td className={styles.right}>{formatINR(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScroll>
      )}

      <form action={formAction} className={`${styles.rowForm} ${styles.formFooter}`}>
        {state && (
          <span className={state.ok ? styles.muted : ""} style={{ fontSize: "12px" }}>
            {state.message}
          </span>
        )}
        <input type="hidden" name="id" value={props.id} />

        <select name="status" className="input" defaultValue={props.status} aria-label="Status">
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {LEAD_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <input
          name="assignedTo"
          className="input"
          placeholder="Owner"
          defaultValue={props.assignedTo ?? ""}
          aria-label="Assigned to"
          style={{ maxWidth: "150px" }}
        />

        <input
          name="followUpOn"
          className="input"
          type="date"
          defaultValue={props.followUpOn ?? ""}
          aria-label="Follow up on"
          style={{ maxWidth: "170px" }}
        />

        <input
          name="notes"
          className="input"
          placeholder="Internal note"
          defaultValue={props.notes ?? ""}
          style={{ maxWidth: "260px" }}
        />

        <button type="submit" className="btn btn-secondary" disabled={pending}>
          {pending ? "Saving…" : "Update"}
        </button>

        <span className={styles.muted} style={{ fontSize: "11px", marginLeft: "auto" }}>
          {new Date(props.createdAt).toISOString().slice(0, 16).replace("T", " ")}
        </span>
      </form>
    </section>
  );
}
