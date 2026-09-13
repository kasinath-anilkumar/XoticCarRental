import { ListFilters } from "@/components/admin/ListFilters";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { Pagination } from "@/components/ui/Pagination";
import { adminListRequest, checkAdminPage, type AdminSearchParams } from "@/lib/admin/list";
import { searchPattern } from "@/lib/admin/references";
import { ADMIN_PAGE_SIZE } from "@/lib/pagination";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin/auth";
import { formatINR } from "@/lib/format";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { AdminPageHead, AdminShell } from "../AdminShell";
import { NeedsDatabase } from "../NeedsDatabase";
import { CarActiveToggle } from "./CarActiveToggle";
import { styles } from "../styles";

export const dynamic = "force-dynamic";

export default async function AdminFleetPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) {
    return (
      <NeedsDatabase
        email={admin.email}
        title="Fleet"
        lede="Every vehicle Xotic operates."
        what="The fleet"
      />
    );
  }
  const supabase = await createSupabaseServerClient();

  // No is_active filter: an admin has to be able to see and republish a car
  // they have hidden.
  const request = adminListRequest(await searchParams);
  let builder = supabase
    .from("cars")
    .select("id, slug, name, year, is_active, rate_8h, rate_12h, rate_full, extra_km_rate, sort, car_types(name), cities!cars_home_city_id_fkey(name)", { count: "exact" })
    .order("sort").order("id");
  if (request.q) builder = builder.ilike("name", searchPattern(request.q));
  if (request.city) builder = builder.eq("home_city_id", request.city);
  const result = await builder.range(request.offset, request.end);
  const { data: cars, error } = result;
  const total = checkAdminPage(result, request, "/admin/fleet");
  const selectedCity = request.city ? await supabase.from("cities").select("name").eq("id", request.city).maybeSingle() : null;

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Fleet"
        lede="Rates here drive every quote on the site. A hidden car disappears from browse, search and the calculator."
      />

      {error && <p className={styles.messageError}>{error.message}</p>}

      <ListFilters path="/admin/fleet" q={request.q} city={request.city} cityLabel={selectedCity?.data?.name} withCity />
      <section className={styles.card}>
        <HorizontalScroll label="Fleet rates" controls="above">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>Car</th>
                <th>City</th>
                <th className={styles.right}>8 hr</th>
                <th className={styles.right}>12 hr</th>
                <th className={styles.right}>Full day</th>
                <th className={styles.right}>Extra km</th>
                <th className={styles.right}>Live</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(cars ?? []).map((car: any) => (
                <tr key={car.id}>
                  <td>
                    <Link href={`/admin/fleet/${car.slug}`}>{car.name}</Link>
                    <div className={styles.muted} style={{ fontSize: "11px" }}>
                      {car.year} · {car.car_types?.name}
                    </div>
                  </td>
                  <td className={styles.muted}>{car.cities?.name}</td>
                  <td className={styles.right}>{formatINR(car.rate_8h)}</td>
                  <td className={styles.right}>{formatINR(car.rate_12h)}</td>
                  <td className={styles.right}>{formatINR(car.rate_full)}</td>
                  <td className={styles.right}>{formatINR(car.extra_km_rate)}</td>
                  <td className={styles.right}>
                    <CarActiveToggle id={car.id} active={car.is_active} />
                  </td>
                  <td className={styles.right}>
                    <Link href={`/admin/fleet/${car.slug}`} className="btn btn-ghost">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScroll>
        {total === 0 && <p>No vehicles match these filters.</p>}
        <Pagination total={total} page={request.page} pageSize={ADMIN_PAGE_SIZE} path="/admin/fleet" query={request.query} label="vehicles" />
      </section>
    </AdminShell>
  );
}
