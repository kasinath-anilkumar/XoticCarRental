import { requireAdmin } from "@/lib/admin/auth";
import { roadKm } from "@/lib/distance";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { AdminPageHead, AdminShell } from "../AdminShell";
import { NeedsDatabase } from "../NeedsDatabase";
import { NewRouteForm } from "./NewRouteForm";
import { RouteRow } from "./RouteRow";
import { styles } from "../styles";

export const dynamic = "force-dynamic";

export default async function AdminRoutesPage() {
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

  const [routes, cities, locations, settings] = await Promise.all([
    supabase
      .from("city_routes")
      .select("*, cities(slug, name), from_location:locations!city_routes_from_location_id_fkey(slug, name, lat, lng), to_location:locations!city_routes_to_location_id_fkey(slug, name, lat, lng)")
      .order("sort"),
    supabase.from("cities").select("id, name").order("sort"),
    supabase.from("locations").select("id, name, city_id").eq("is_active", true).order("sort"),
    supabase.from("site_settings").select("circuity_factor").maybeSingle(),
  ]);

  const circuity = Number(settings.data?.circuity_factor ?? 1.25);

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Route fares"
        lede="The “fares people ask for most” table on each city page. A published distance also overrides the estimate in the price calculator, so the two never disagree."
      />

      <NewRouteForm
        cities={(cities.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
        locations={(locations.data ?? []).map((l) => ({
          id: l.id,
          name: l.name,
          cityId: l.city_id,
        }))}
      />

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
              route.from_location && route.to_location
                ? roadKm(
                    { ...route.from_location, slug: route.from_location.slug, citySlug: "", isAirport: false },
                    { ...route.to_location, slug: route.to_location.slug, citySlug: "", isAirport: false },
                    circuity,
                  )
                : null
            }
            isActive={route.is_active}
            sort={route.sort}
          />
        ))}
      </section>
    </AdminShell>
  );
}
