import { ListFilters } from "@/components/admin/ListFilters";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdmin } from "@/lib/admin/auth";
import { adminListRequest, checkAdminPage, type AdminSearchParams } from "@/lib/admin/list";
import { searchPattern } from "@/lib/admin/references";
import { ADMIN_PAGE_SIZE } from "@/lib/pagination";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { AdminPageHead, AdminShell } from "../AdminShell";
import { NeedsDatabase } from "../NeedsDatabase";
import { GarageRow } from "./GarageRow";
import { NewGarageForm } from "./NewGarageForm";
import { styles } from "../styles";
export const dynamic = "force-dynamic";
interface GarageRecord { id: string; slug: string; name: string; city_id: string; lat: number; lng: number; is_active: boolean; cities: { name: string } | null; cars: { count: number }[] }

export default async function AdminGaragesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) return <NeedsDatabase email={admin.email} title="Garages" lede="Where the vehicles live." what="Garages" />;
  const request = adminListRequest(await searchParams);
  const supabase = await createSupabaseServerClient();
  let builder = supabase.from("garages").select("*,cities(name),cars(count)", { count: "exact" }).order("name").order("id");
  if (request.q) builder = builder.ilike("name", searchPattern(request.q));
  if (request.city) builder = builder.eq("city_id", request.city);
  const [result, homeless, selectedCity] = await Promise.all([
    builder.range(request.offset, request.end),
    supabase.from("cars").select("id", { count: "exact", head: true }).is("garage_id", null),
    request.city ? supabase.from("cities").select("name").eq("id", request.city).maybeSingle() : Promise.resolve(null),
  ]);
  const total = checkAdminPage(result, request, "/admin/garages");
  if (homeless.error) throw new Error("Could not count vehicles without a garage.");
  return <AdminShell email={admin.email}>
    <AdminPageHead title="Garages" lede="Internal vehicle bases. Moving a garage changes transfer distances for every vehicle assigned there." />
    <NewGarageForm />
    <ListFilters path="/admin/garages" q={request.q} city={request.city} cityLabel={selectedCity?.data?.name} withCity />
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>{total} matching garages</h2>
      {(homeless.count ?? 0) > 0 && <p className={styles.cardHint}>{homeless.count} vehicles have no garage and use the city centre for distance calculations.</p>}
      {((result.data ?? []) as unknown as GarageRecord[]).map((garage) => <GarageRow key={garage.id} id={garage.id} slug={garage.slug} name={garage.name} cityId={garage.city_id} cityLabel={garage.cities?.name ?? "Unknown city"} lat={garage.lat} lng={garage.lng} isActive={garage.is_active} carCount={garage.cars[0]?.count ?? 0} />)}
      {total === 0 && <p>No garages match these filters.</p>}
      <Pagination total={total} page={request.page} pageSize={ADMIN_PAGE_SIZE} path="/admin/garages" query={request.query} label="garages" />
    </section>
  </AdminShell>;
}
