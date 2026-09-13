"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const calendar = useRef<HTMLDialogElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !trigger.current || !calendar.current) return;
    const popup = calendar.current;
    const anchor = trigger.current;
    let frame = 0;
    const position = () => {
      const bounds = availableViewport(popup);
      const anchorBox = anchor.getBoundingClientRect();
      popup.style.maxWidth = `${bounds.right - bounds.left}px`;
      popup.style.maxHeight = `${bounds.bottom - bounds.top}px`;
      const popupBox = popup.getBoundingClientRect();
      const preferredLeft = align === "end" ? anchorBox.right - popupBox.width : anchorBox.left;
      const left = Math.max(bounds.left, Math.min(preferredLeft, bounds.right - popupBox.width));
      const below = anchorBox.bottom + 6;
      const above = anchorBox.top - popupBox.height - 6;
      const preferredTop = below + popupBox.height <= bounds.bottom ? below : above;
      const top = Math.max(bounds.top, Math.min(preferredTop, bounds.bottom - popupBox.height));
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(position);
    };
    position();
    // Reposition after the lazy calendar loads, its month height changes, or
    // the trigger moves. The portal also escapes transformed hero containers.
    const observer = new ResizeObserver(schedule);
    observer.observe(popup);
    observer.observe(anchor);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!wrap.current?.contains(target) && !calendar.current?.contains(target)) setOpen(false);
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
        if (!event.currentTarget.contains(event.relatedTarget) && !calendar.current?.contains(event.relatedTarget)) setOpen(false);
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

        {open && createPortal(
          <dialog
            ref={calendar}
            className={styles.popover}
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
          </dialog>,
          document.body,
        )}
      </div>
    </div>
  );
}

/** Measure edge bars instead of assuming a particular header or mobile footer. */
function availableViewport(popup: HTMLElement) {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  const width = viewport?.width ?? document.documentElement.clientWidth;
  const height = viewport?.height ?? window.innerHeight;
  const bounds = { left: left + 12, right: left + width - 12, top: top + 12, bottom: top + height - 12 };
  for (const edge of ["top", "bottom"] as const) {
    const y = edge === "top" ? top + 1 : top + height - 1;
    for (const element of document.elementsFromPoint(left + width / 2, y)) {
      if (element === popup || popup.contains(element)) continue;
      const position = getComputedStyle(element).position;
      if (position !== "fixed" && position !== "sticky") continue;
      const box = element.getBoundingClientRect();
      // Full-screen overlays are separate interactions, not persistent bars.
      if (box.height > height / 2 || box.width < width / 2) continue;
      if (edge === "top") bounds.top = Math.max(bounds.top, box.bottom + 12);
      else bounds.bottom = Math.min(bounds.bottom, box.top - 12);
    }
  }
  return bounds;
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
