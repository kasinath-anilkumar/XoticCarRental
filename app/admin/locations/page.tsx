import { ListFilters } from "@/components/admin/ListFilters";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdmin } from "@/lib/admin/auth";
import { adminListRequest, checkAdminPage, type AdminSearchParams } from "@/lib/admin/list";
import { searchPattern } from "@/lib/admin/references";
import { ADMIN_PAGE_SIZE } from "@/lib/pagination";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { AdminPageHead, AdminShell } from "../AdminShell";
import { NeedsDatabase } from "../NeedsDatabase";
import { LocationRow } from "./LocationRow";
import { NewLocationForm } from "./NewLocationForm";
import { styles } from "../styles";
export const dynamic = "force-dynamic";
interface LocationRecord { id: string; slug: string; name: string; city_id: string; lat: number; lng: number; is_airport: boolean; is_active: boolean; sort: number; cities: { name: string } | null }

export default async function AdminLocationsPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) return <NeedsDatabase email={admin.email} title="Locations" lede="Pickup and drop points." what="Locations" />;
  const request = adminListRequest(await searchParams);
  const supabase = await createSupabaseServerClient();
  let builder = supabase.from("locations").select("*,cities(name)", { count: "exact" }).order("sort").order("id");
  if (request.q) builder = builder.ilike("name", searchPattern(request.q));
  if (request.city) builder = builder.eq("city_id", request.city);
  const result = await builder.range(request.offset, request.end);
  const total = checkAdminPage(result, request, "/admin/locations");
  const selectedCity = request.city ? await supabase.from("cities").select("name").eq("id", request.city).maybeSingle() : null;
  return <AdminShell email={admin.email}>
    <AdminPageHead title="Locations" lede="Manage saved pickup and drop points. These coordinates determine quoted distances." />
    <NewLocationForm />
    <ListFilters path="/admin/locations" q={request.q} city={request.city} cityLabel={selectedCity?.data?.name} withCity />
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{total} matching locations</h2>
      {((result.data ?? []) as unknown as LocationRecord[]).map((location) => <LocationRow key={location.id} id={location.id} slug={location.slug} name={location.name} cityId={location.city_id} cityLabel={location.cities?.name ?? "Unknown city"} lat={location.lat} lng={location.lng} isAirport={location.is_airport} isActive={location.is_active} sort={location.sort} />)}
      {total === 0 && <p>No locations match these filters.</p>}
      <Pagination total={total} page={request.page} pageSize={ADMIN_PAGE_SIZE} path="/admin/locations" query={request.query} label="locations" />
    </section>
  </AdminShell>;
}
