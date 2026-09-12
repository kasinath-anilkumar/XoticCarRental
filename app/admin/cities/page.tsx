import { ListFilters } from "@/components/admin/ListFilters";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdmin } from "@/lib/admin/auth";
import { adminListRequest, checkAdminPage, type AdminSearchParams } from "@/lib/admin/list";
import { searchPattern } from "@/lib/admin/references";
import { ADMIN_PAGE_SIZE } from "@/lib/pagination";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { AdminPageHead, AdminShell } from "../AdminShell";
import { NeedsDatabase } from "../NeedsDatabase";
import { CityForm, type CityRecord } from "./CityForm";
export const dynamic = "force-dynamic";

export default async function AdminCitiesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) return <NeedsDatabase email={admin.email} title="Cities" lede="Service cities." what="Cities" />;
  const request = adminListRequest(await searchParams);
  const supabase = await createSupabaseServerClient();
  let builder = supabase.from("cities").select("*", { count: "exact" }).order("sort").order("id");
  if (request.q) builder = builder.ilike("name", searchPattern(request.q));
  const result = await builder.range(request.offset, request.end);
  const total = checkAdminPage(result, request, "/admin/cities");
  return <AdminShell email={admin.email}>
    <AdminPageHead title="Cities" lede="Manage service cities, map coordinates and city pricing. New cities stay hidden until you publish them." />
    <CityForm />
    <ListFilters path="/admin/cities" q={request.q} />
    {(result.data as CityRecord[]).map((city) => <CityForm key={city.id} city={city} />)}
    {total === 0 && <p>No cities match these filters.</p>}
    <Pagination total={total} page={request.page} pageSize={ADMIN_PAGE_SIZE} path="/admin/cities" query={request.query} label="cities" />
  </AdminShell>;
}
