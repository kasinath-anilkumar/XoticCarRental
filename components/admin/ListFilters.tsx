import Link from "next/link";
import { ReferenceSelect } from "./ReferenceSelect";

export function ListFilters({ path, q, city, cityLabel, withCity = false }: { path: string; q: string; city?: string; cityLabel?: string; withCity?: boolean }) {
  return <form action={path} className="mb-6 flex flex-wrap items-end gap-4">
    <div className="field min-w-[220px] flex-1"><label htmlFor="admin-record-search">Search records</label><input id="admin-record-search" name="q" className="input" type="search" defaultValue={q} maxLength={100} /></div>
    {withCity && <ReferenceSelect key={city || "all"} kind="cities" name="city" label="Filter by city" initial={city ? [{ value: city, label: cityLabel || "Selected city" }] : []} />}
    <button type="submit" className="btn btn-secondary">Apply filters</button>
    {(q || city) && <Link href={path} className="btn btn-ghost">Clear filters</Link>}
  </form>;
}
