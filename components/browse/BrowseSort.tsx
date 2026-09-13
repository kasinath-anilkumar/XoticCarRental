"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SortKey } from "@/lib/catalog";
import styles from "./Browse.module.css";

export function BrowseSort({ value, baseQuery }: { value: SortKey; baseQuery: string }) {
  const id = useId();
  const router = useRouter();
  const [selected, setSelected] = useState(value);
  const [pending, startTransition] = useTransition();

  function change(sort: SortKey) {
    setSelected(sort);
    const params = new URLSearchParams(baseQuery);
    params.delete("page");
    if (sort === "popular") params.delete("sort");
    else params.set("sort", sort);
    const query = params.toString();
    startTransition(() => router.push(`${query ? `/cars?${query}` : "/cars"}#fleet-results`, { scroll: false }));
  }

  return <div className={styles.sort} aria-busy={pending}>
    <label htmlFor={id}>Sort by</label>
    <select id={id} aria-label="Sort by" value={selected} disabled={pending} onChange={(event) => change(event.target.value as SortKey)}>
      <option value="popular">Recommended</option>
      <option value="low">Price: low to high</option>
      <option value="high">Price: high to low</option>
    </select>
  </div>;
}
