"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { BrowseFilterFields } from "@/components/browse/BrowseFilterFields";
import { Icon } from "@/components/ui/Icon";
import { useModalDialog } from "@/components/ui/useModalDialog";
import {
  countBrowseFilters,
  createFilterDraft,
  filterDraftHref,
  invalidFilterBudget,
  resetFilterDraft,
  updateFilterDraft,
  type BrowseFilterDraft,
} from "@/lib/browse-filters";
import type { BrowseFilterOptions, CarFilters } from "@/lib/catalog";

import styles from "./MobileFilters.module.css";

interface MobileFiltersProps {
  catalog: BrowseFilterOptions;
  filters: CarFilters;
  /** The current journey and package context, retained when filters change. */
  baseQuery: string;
  minDate: string;
}

const emptySubscribe = () => () => {};

/** Reveal a collapsed group before native form validation focuses its field. */
function revealField(field: HTMLElement) {
  let parent = field.parentElement;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
}

export function MobileFilters({ catalog, filters, baseQuery, minDate }: MobileFiltersProps) {
  const router = useRouter();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BrowseFilterDraft>(() => createFilterDraft(filters, baseQuery));
  const [invalidSubmission, setInvalidSubmission] = useState(false);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  useModalDialog(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open]);

  const appliedCount = countBrowseFilters(createFilterDraft(filters, baseQuery));
  const selectedCount = countBrowseFilters(draft);
  const close = () => setOpen(false);

  const modal = open ? (
    <dialog
      ref={dialogRef}
      id={dialogId}
      className={styles.overlay}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); close(); }}
    >
      <div className={styles.backdrop} onClick={close} aria-hidden="true" />
      <form
        className={styles.sheet}
        onInvalidCapture={(event) => {
          if (event.target instanceof HTMLElement) revealField(event.target);
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (invalidFilterBudget(draft)) {
            setInvalidSubmission(true);
            const field = event.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"]');
            if (field) { revealField(field); field.focus(); }
            return;
          }
          const href = `${filterDraftHref(baseQuery, draft)}#fleet-results`;
          close();
          startTransition(() => router.push(href, { scroll: false }));
        }}
      >
        <div className={styles.handle} aria-hidden="true" />
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId}>Filters</h2>
            <p id={descriptionId} className={styles.description}>Choose your options, then show matching cars.</p>
          </div>
          <button type="button" className={styles.close} onClick={close} aria-label="Close filters">
            <Icon name="ph-x" size={20} />
          </button>
        </header>

        {/* This bounded region uses native Page Up/Down, Home/End and arrow scrolling. */}
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <section className={`scroll-shadows ${styles.body}`} aria-label="Filter options" tabIndex={0}>
          <BrowseFilterFields
            options={catalog}
            draft={draft}
            onChange={(key, value) => {
              setInvalidSubmission(false);
              setDraft((current) => updateFilterDraft(current, key, value, catalog));
            }}
            minDate={minDate}
            idPrefix="mobile-filters"
          />
        </section>

        <footer className={styles.footer}>
          <div className={styles.selection}>
            <span>{selectedCount === 0 ? "No filters selected" : `${selectedCount} ${selectedCount === 1 ? "filter" : "filters"} selected`}</span>
            <span className={styles.selectionHint}>Scroll to explore all filters</span>
          </div>
          {invalidSubmission && <p className={styles.error} role="alert">Check the budget amount before applying filters.</p>}
          <div className={styles.actions}>
            <button
              type="button"
              className={`btn btn-secondary ${styles.clear}`}
              onClick={() => {
                setInvalidSubmission(false);
                setDraft((current) => resetFilterDraft(current));
              }}
            >
              Clear all
            </button>
            <button type="submit" className={`btn btn-solid ${styles.apply}`}>
              Show matching cars
              <Icon name="ph-arrow-right" size={17} />
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={`btn btn-secondary ${styles.trigger}`}
        aria-label="Filters"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-busy={pending}
        disabled={pending}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          setDraft(createFilterDraft(filters, baseQuery));
          setInvalidSubmission(false);
          setOpen(true);
        }}
      >
        <Icon name="ph-funnel-simple" size={18} />
        <span>Filters</span>
        {appliedCount > 0 && <span className={styles.count} aria-hidden="true">{appliedCount}</span>}
      </button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
