import { ListFilters } from "@/components/admin/ListFilters";
import { Pagination } from "@/components/ui/Pagination";
import { adminListRequest, checkAdminPage, type AdminSearchParams } from "@/lib/admin/list";
import { searchPattern } from "@/lib/admin/references";
import { ADMIN_PAGE_SIZE } from "@/lib/pagination";
import { requireAdmin } from "@/lib/admin/auth";
import { roadKm } from "@/lib/distance";
import { fromServed } from "@/lib/places";
import { parsePricingRules } from "@/lib/pricing-rules";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { AdminPageHead, AdminShell } from "../AdminShell";
import { NeedsDatabase } from "../NeedsDatabase";
import { NewRouteForm } from "./NewRouteForm";
import { RouteRow } from "./RouteRow";
import { styles } from "../styles";

export const dynamic = "force-dynamic";

export default async function AdminRoutesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) {
    return (
      <NeedsDatabase
        email={admin.email}
        title="Route fares"
        lede="Published distances between locations."
        what="Route fares"
      />
    );
  }
  const supabase = await createSupabaseServerClient();

  const request = adminListRequest(await searchParams);
  let builder = supabase.from("city_routes")
    .select("*, cities(slug,name), from_location:locations!city_routes_from_location_id_fkey!inner(slug,name,lat,lng), to_location:locations!city_routes_to_location_id_fkey(slug,name,lat,lng)", { count: "exact" })
    .order("sort").order("id");
  if (request.q) builder = builder.ilike("from_location.name", searchPattern(request.q));
  if (request.city) builder = builder.eq("city_id", request.city);
  const [routes, settings, selectedCity] = await Promise.all([
    builder.range(request.offset, request.end),
    supabase.from("site_settings").select("circuity_factor,pricing_rules").maybeSingle(),
    request.city ? supabase.from("cities").select("name").eq("id", request.city).maybeSingle() : Promise.resolve(null),
  ]);
  const total = checkAdminPage(routes, request, "/admin/routes");

  const circuity = Number(settings.data?.circuity_factor);
  let minimumLegKm: number | null = null;
  try { minimumLegKm = parsePricingRules(settings.data?.pricing_rules).minimumLegKm; } catch { /* Settings must be configured before estimating fares. */ }

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Route fares"
        lede="The “fares people ask for most” table on each city page. A published distance also overrides the estimate in the price calculator, so the two never disagree."
      />

      <NewRouteForm />
      <ListFilters path="/admin/routes" q={request.q} city={request.city} cityLabel={selectedCity?.data?.name} withCity />
      <p className={styles.cardHint}>Search matches the route's starting pickup point.</p>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Published routes</h2>
        <p className={styles.cardHint}>
          Leave the distance blank to use the straight-line estimate (shown beside each row).
          Entering a measured road distance is always better — customers check these against what
          they already know.
        </p>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(routes.data ?? []).map((route: any) => (
          <RouteRow
            key={route.id}
            id={route.id}
            citySlug={route.cities?.slug ?? ""}
            cityName={route.cities?.name ?? ""}
            fromName={route.from_location?.name ?? ""}
            toName={route.to_location?.name ?? ""}
            kmOverride={route.km_override}
            estimatedKm={
              route.from_location && route.to_location && Number.isFinite(circuity) && circuity >= 1 && minimumLegKm !== null
                ? roadKm(
                    fromServed({ ...route.from_location, citySlug: "", isAirport: false }),
                    fromServed({ ...route.to_location, citySlug: "", isAirport: false }),
                    circuity,
                    undefined,
                    minimumLegKm,
                  )
                : null
            }
            isActive={route.is_active}
            sort={route.sort}
          />
        ))}
        {total === 0 && <p>No routes match these filters.</p>}
        <Pagination total={total} page={request.page} pageSize={ADMIN_PAGE_SIZE} path="/admin/routes" query={request.query} label="routes" />
      </section>
    </AdminShell>
  );
}
