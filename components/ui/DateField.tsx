"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { Icon } from "@/components/ui/Icon";
import { formatDate } from "@/lib/format";

import styles from "./DateField.module.css";
import "react-day-picker/style.css";

const DayPicker = dynamic(
  () => import("react-day-picker").then((module) => module.DayPicker),
  { loading: () => <output className="block min-h-[280px] p-4 text-sm">Loading calendar…</output> },
);

export interface DateFieldProps {
  id?: string;
  label: string;
  /** YYYY-MM-DD */
  value: string;
  onChange: (iso: string) => void;
  /** Also YYYY-MM-DD. Days before this are unselectable. */
  min?: string;
  /** Optional explicit upper bound, for a selected rental's date range. */
  max?: string;
  /** How many months ahead to allow. */
  monthsAhead?: number;
  align?: "start" | "end";
  clearable?: boolean;
}

/**
 * Pickup date.
 *
 * The native `<input type="date">` this replaces showed a bare `dd-mm-yyyy`
 * mask, styled itself differently in every browser, and gave no sense of which
 * day of the week a booking falls on — which is the first thing someone
 * planning a wedding or a weekend trip wants to see.
 *
 * Dates are handled as plain YYYY-MM-DD strings and converted at the edges. A
 * Date object here would carry a timezone, and a pickup date that shifts by a
 * day when the server and the customer disagree about midnight is a real
 * booking error.
 */
export function DateField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  monthsAhead = 12,
  align = "start",
  clearable = false,
}: DateFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = parseIso(value);
  const minDate = min ? parseIso(min) : undefined;
  const maxDate = (() => {
    const explicit = max ? parseIso(max) : undefined;
    if (explicit) return explicit;
    const base = minDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth() + monthsAhead, base.getDate());
  })();

  const choose = (date: Date | undefined) => {
    if (!date || (minDate && date < minDate) || date > maxDate) return;
    onChange(toIso(date));
    setOpen(false);
    trigger.current?.focus();
  };

  const today = new Date();
  const shortcuts = [
    { label: "Tomorrow", date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1) },
    { label: "Next week", date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7) },
    { label: "In a month", date: new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()) },
  ];

  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <div className={styles.wrap} ref={wrap} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}>
        <button
          type="button"
          id={fieldId}
          ref={trigger}
          className={styles.trigger}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? `${fieldId}-calendar` : undefined}
        >
          <span className={styles.triggerIcon}>
            <Icon name="ph-calendar-blank" size={16} />
          </span>
          <span className={`${styles.value} ${value ? "" : styles.placeholder}`}>
            {value ? formatDate(value) : "Pick a date"}
          </span>
          <Icon name="ph-caret-down" size={13} color="var(--color-neutral-500)" />
        </button>

        {open && (
          <dialog
            className={`${styles.popover} ${align === "end" ? styles.popoverEnd : ""}`}
            id={`${fieldId}-calendar`}
            open
            aria-label={label}
          >
            <div className={styles.shortcuts}>
              {shortcuts.map(({ label: shortcutLabel, date }) => (
                <button key={shortcutLabel} type="button" className={styles.shortcut}
                  disabled={Boolean((minDate && date < minDate) || date > maxDate)}
                  onClick={() => choose(date)}>
                  {shortcutLabel}
                </button>
              ))}
              {clearable && value && (
                <button type="button" className={styles.shortcut} onClick={() => {
                  onChange("");
                  setOpen(false);
                  trigger.current?.focus();
                }}>Clear date</button>
              )}
            </div>
            <DayPicker
              className={styles.calendar}
              mode="single"
              selected={selected}
              defaultMonth={selected ?? minDate}
              onSelect={choose}
              disabled={[...(minDate ? [{ before: minDate }] : []), { after: maxDate }]}
              startMonth={minDate}
              endMonth={maxDate}
              showOutsideDays
              autoFocus
            />
          </dialog>
        )}
      </div>
    </div>
  );
}

/** YYYY-MM-DD → a local Date at midnight, with no timezone shift. */
function parseIso(iso: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toIso(date) === iso ? date : undefined;
}

function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
