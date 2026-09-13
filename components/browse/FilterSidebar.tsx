"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import type { BrowseFilterOptions, CarFilters } from "@/lib/catalog";
import { createFilterDraft, countBrowseFilters, filterDraftHref, invalidFilterBudget, resetFilterDraft, updateFilterDraft } from "@/lib/browse-filters";
import { BrowseFilterFields } from "./BrowseFilterFields";
import styles from "./FilterSidebar.module.css";

export interface FilterSidebarProps {
  catalog: BrowseFilterOptions;
  filters: CarFilters;
  baseQuery: string;
  minDate: string;
}

/** Applying a draft makes one navigation, regardless of how many choices changed. */
export function FilterSidebar({ catalog, filters, baseQuery, minDate }: FilterSidebarProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => createFilterDraft(filters, baseQuery));
  const [resetVersion, setResetVersion] = useState(0);
  const [pending, startTransition] = useTransition();
  const selected = countBrowseFilters(draft);
  const changed = filterDraftHref(baseQuery, draft) !== filterDraftHref(baseQuery, createFilterDraft(filters, baseQuery));

  return <aside className={styles.panel} aria-label="Filters">
    <form className={styles.form} aria-label="Fleet filters" onSubmit={(event) => {
      event.preventDefault();
      if (invalidFilterBudget(draft)) {
        const field = event.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (field) {
          let ancestor = field.parentElement;
          while (ancestor && ancestor !== event.currentTarget) {
            if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
            ancestor = ancestor.parentElement;
          }
          field.focus();
        }
        return;
      }
      startTransition(() => router.push(`${filterDraftHref(baseQuery, draft)}#fleet-results`, { scroll: false }));
    }}>
      <header className={styles.header}>
        <div className={styles.heading}><h2>Filters</h2><span aria-label={`${selected} filters selected`}>{selected}</span></div>
        <p>Choose your options, then apply.</p>
      </header>
      <div className={styles.body}>
        <BrowseFilterFields key={resetVersion} options={catalog} draft={draft}
          onChange={(key, value) => setDraft((current) => updateFilterDraft(current, key, value, catalog))}
          minDate={minDate} idPrefix="desktop-filters" />
      </div>
      <footer className={styles.footer}>
        <div className={styles.selection}><output>{pending ? "Updating your results…" : changed ? "Ready to update your results" : selected ? `${selected} filters selected` : "Explore the full collection"}</output>
          <button type="button" onClick={() => { setDraft((current) => resetFilterDraft(current)); setResetVersion((version) => version + 1); }} disabled={pending}>Clear all</button>
        </div>
        <button type="submit" className={styles.apply} disabled={pending}>
          <span>{pending ? "Applying filters…" : "Apply filters"}</span><Icon name={pending ? "ph-arrows-clockwise" : "ph-arrow-right"} size={18} />
        </button>
      </footer>
    </form>
  </aside>;
}
