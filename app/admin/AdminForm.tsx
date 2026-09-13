"use client";

import { useActionState, useId } from "react";

import type { ActionResult } from "./actions";
import { styles } from "./styles";

export interface AdminFormProps {
  action: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  /** Label for the submit button. */
  submitLabel?: string;
  /** Rendered beside the submit button. */
  aside?: React.ReactNode;
  className?: string;
  /** Compact rows (route fares, enquiry status) put the button inline. */
  inline?: boolean;
}

/**
 * Wraps a server action with its pending state and its result message.
 *
 * Every admin form uses this, so saving looks and behaves the same everywhere
 * and a failure always surfaces the database's own message rather than
 * disappearing.
 */
export function AdminForm({
  action,
  children,
  submitLabel = "Save",
  aside,
  className,
  inline = false,
}: AdminFormProps) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className={`${styles.form} ${className ?? ""}`} aria-busy={pending}>
      {state && (
        <output className={state.ok ? styles.message : styles.messageError}>
          {state.message}
        </output>
      )}

      {children}

      <div className={inline ? styles.rowForm : styles.formFooter}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {aside}
      </div>
    </form>
  );
}

/** A labelled input, matching the Nocturne `.field` pattern. */
export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  step,
  min,
  max,
  hint,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  step?: string;
  min?: number;
  max?: number;
  hint?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        className="input"
        type={type}
        step={step}
        min={min}
        max={max}
        required={required}
        defaultValue={defaultValue ?? ""}
      />
      {hint && (
        <p style={{ fontSize: "11px", color: "var(--color-neutral-600)", margin: "4px 0 0" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  rows = 4,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        name={name}
        className="input"
        rows={rows}
        defaultValue={defaultValue ?? ""}
      />
      {hint && (
        <p style={{ fontSize: "11px", color: "var(--color-neutral-600)", margin: "4px 0 0" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Select({
  label,
  name,
  defaultValue,
  options,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: Array<{ value: string; label: string }>;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} className="input" defaultValue={defaultValue ?? ""}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p style={{ fontSize: "11px", color: "var(--color-neutral-600)", margin: "4px 0 0" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Checkbox({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        marginTop: "22px",
        fontSize: "14px",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        // The system's .radio/.dot pair is round by design; a checkbox should
        // read as a checkbox, so this uses the native control tinted to the
        // accent rather than borrowing the radio's mark.
        style={{ width: "16px", height: "16px", accentColor: "var(--color-accent)" }}
      />
      {label}
    </label>
  );
}
