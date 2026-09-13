import { ReferenceSelect } from "@/components/admin/ReferenceSelect";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/ui/Pagination";
import { requireAdmin } from "@/lib/admin/auth";
import { getCatalog } from "@/lib/content";
import { businessDate, isISODate } from "@/lib/dates";
import { ADMIN_PAGE_SIZE, pageHref, parsePage } from "@/lib/pagination";
import { getStore, isLocalStore } from "@/lib/store";
import type { AvailabilityFilter } from "@/lib/store/types";

import { AdminPageHead, AdminShell } from "../AdminShell";
import { AvailabilityForm, AvailabilityRow } from "./AvailabilityForm";
import { styles } from "../styles";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const VIEWS = [
  { key: "current", label: "Current and upcoming" },
  { key: "past", label: "Finished" },
  { key: "all", label: "All holds" },
] as const;

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Vehicle availability (§17).
 *
 * A car is not "active" or "inactive" — it is booked on the 14th, in the
 * workshop for a fortnight, or held for a customer who has not confirmed. Each
 * of those is a date range with a reason, and only the range can answer the
 * question the fleet list actually asks: can this vehicle do the 14th?
 */
export default async function AdminAvailabilityPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireAdmin();
  const localCars = !isSupabaseConfigured() ? (await getCatalog()).cars : undefined;
  const params = await searchParams;
  const today = businessDate();
  const view = VIEWS.find((item) => item.key === single(params.view)) ?? VIEWS[0];
  const car = single(params.car);
  const from = isISODate(single(params.from)) ? single(params.from) : "";
  const to = isISODate(single(params.to)) ? single(params.to) : "";
  const invalidRange = Boolean(from && to && to < from);
  const filter: AvailabilityFilter = {
    ...(car ? { carSlug: car } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  if (view.key === "current") filter.from = from > today ? from : today;
  if (view.key === "past") filter.pastBefore = today;

  const query = new URLSearchParams({ view: view.key });
  if (car) query.set("car", car);
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const result = invalidRange
    ? { items: [], total: 0, page: 1, pageSize: ADMIN_PAGE_SIZE }
    : await getStore().listAvailabilityPage(filter, parsePage(params.page), ADMIN_PAGE_SIZE);
  const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (result.page > lastPage) redirect(pageHref("/admin/availability", query.toString(), lastPage));

  const names = new Map((localCars ?? []).map((item) => [item.slug, item.name]));
  if (!localCars) {
    const slugs = [...new Set([...result.items.map((item) => item.carSlug), ...(car ? [car] : [])])];
    if (slugs.length) {
      const supabase = await createSupabaseServerClient();
      const rows = await supabase.from("cars").select("slug,name").in("slug", slugs);
      if (rows.error) throw new Error("Could not load vehicle names.");
      for (const item of rows.data ?? []) names.set(item.slug, item.name);
    }
  }
  const carName = (slug: string) => names.get(slug) ?? slug;

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Availability"
        lede="Dates a vehicle cannot be offered. A car with a hold covering the customer's date does not appear as available for it."
      />

      {isLocalStore() && (
        <p className={styles.message} style={{ marginBottom: "16.8px" }}>
          Recording to <code>.data/store.json</code> — no database is configured.
        </p>
      )}

      <AvailabilityForm today={today} cars={localCars?.map((car) => ({ slug: car.slug, name: car.name }))} />

      <section className={styles.card} style={{ marginTop: "16.8px" }}>
        <h2 className={styles.cardTitle}>Vehicle holds</h2>
        <div className={styles.actions} style={{ marginTop: "16px", marginBottom: "24px" }}>
          {VIEWS.map((option) => {
            const next = new URLSearchParams(query);
            next.set("view", option.key);
            return (
              <Link key={option.key} prefetch={false} href={`/admin/availability?${next}`} aria-current={view.key === option.key ? "page" : undefined} className={`btn ${view.key === option.key ? "btn-primary" : "btn-secondary"}`}>
                {option.label}
              </Link>
            );
          })}
        </div>

        <form action="/admin/availability" method="get" className="mb-6">
          <input type="hidden" name="view" value={view.key} />
          <div className={styles.grid3}>
            {localCars ? <div className="field">
              <label htmlFor="availability-filter-car">Vehicle</label>
              <select id="availability-filter-car" name="car" defaultValue={car} className="input">
                <option value="">All vehicles</option>
                {localCars.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
              </select>
            </div> : <ReferenceSelect key={car} kind="cars" name="car" label="Filter by vehicle" initial={car ? [{ value: car, label: carName(car) }] : []} />}
            <div className="field">
              <label htmlFor="availability-filter-from">Overlaps from</label>
              <input id="availability-filter-from" type="date" name="from" defaultValue={from} className="input" />
            </div>
            <div className="field">
              <label htmlFor="availability-filter-to">Through</label>
              <input id="availability-filter-to" type="date" name="to" defaultValue={to} className="input" />
            </div>
          </div>
          <div className={styles.actions}>
            <button type="submit" className="btn btn-secondary">Apply filters</button>
            {(car || from || to) && <Link href={`/admin/availability?view=${view.key}`} className="btn btn-ghost">Clear filters</Link>}
          </div>
        </form>

        {invalidRange ? (
          <p role="alert" className={styles.messageError}>The last filter date must be on or after the first.</p>
        ) : result.items.length === 0 ? (
          <p className={styles.cardHint}>No {view.key === "past" ? "finished " : view.key === "current" ? "current or upcoming " : ""}holds match these filters.</p>
        ) : (
          <><p className={styles.cardHint}>{result.total} matching {result.total === 1 ? "hold" : "holds"} in {view.label.toLowerCase()}. Dates follow India Standard Time.</p>
          <HorizontalScroll label="Vehicle holds" controls="above">
            <table className="table min-w-[640px]">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Note</th>
                  <th><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((entry) => (
                  <AvailabilityRow key={entry.id} entry={entry} carName={carName(entry.carSlug)} />
                ))}
              </tbody>
            </table>
          </HorizontalScroll></>
        )}
        <Pagination total={result.total} page={result.page} pageSize={result.pageSize} path="/admin/availability" query={query.toString()} label="holds" />
      </section>
    </AdminShell>
  );
}
