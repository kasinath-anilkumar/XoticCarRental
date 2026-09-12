import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { AdminPageHead, AdminShell } from "../AdminShell";
import { NeedsDatabase } from "../NeedsDatabase";
import { LocationRow } from "./LocationRow";
import { NewLocationForm } from "./NewLocationForm";
import { styles } from "../styles";

export const dynamic = "force-dynamic";

export default async function AdminLocationsPage() {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) {
    return (
      <NeedsDatabase
        email={admin.email}
        title="Locations"
        lede="Pickup and drop points."
        what="Locations"
      />
    );
  }
  const supabase = await createSupabaseServerClient();

  const [locations, cities] = await Promise.all([
    supabase.from("locations").select("*").order("sort"),
    supabase.from("cities").select("id, name").order("sort"),
  ]);

  const cityOptions = (cities.data ?? []).map((city) => ({ id: city.id, name: city.name }));
  const cityName = new Map(cityOptions.map((city) => [city.id, city.name]));

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Locations"
        lede="Every pickup and drop point the calculator offers. Distance between any two of them is computed from these coordinates."
      />

      <NewLocationForm cities={cityOptions} />

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{(locations.data ?? []).length} locations</h2>
        <p className={styles.cardHint}>
          Moving a marker changes quoted distances immediately. Published route fares override the
          estimate for the pairs listed under Route fares.
        </p>

        {(locations.data ?? []).map((location) => (
          <LocationRow
            key={location.id}
            id={location.id}
            slug={location.slug}
            name={location.name}
            cityId={location.city_id}
            cityLabel={cityName.get(location.city_id) ?? ""}
            lat={location.lat}
            lng={location.lng}
            isAirport={location.is_airport}
            isActive={location.is_active}
            sort={location.sort}
            cities={cityOptions}
          />
        ))}
      </section>
    </AdminShell>
  );
}
