import Link from "next/link";
import { ReferenceSelect } from "./ReferenceSelect";
import { styles } from "@/app/admin/styles";

export function ListFilters({ path, q, city, cityLabel, withCity = false }: { path: string; q: string; city?: string; cityLabel?: string; withCity?: boolean }) {
  return <form action={path} className={styles.filterBar}>
    <div className={`field ${styles.filterInput}`}><label htmlFor="admin-record-search">Search records</label><input id="admin-record-search" name="q" className="input" type="search" defaultValue={q} maxLength={100} placeholder="Search by name" /></div>
    {withCity && <ReferenceSelect key={city || "all"} kind="cities" name="city" label="Filter by city" initial={city ? [{ value: city, label: cityLabel || "Selected city" }] : []} />}
    <button type="submit" className="btn btn-secondary">Apply filters</button>
    {(q || city) && <Link href={path} className="btn btn-ghost">Clear filters</Link>}
  </form>;
}
