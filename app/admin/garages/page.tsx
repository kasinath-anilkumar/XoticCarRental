import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { AdminPageHead, AdminShell } from "../AdminShell";
import { NeedsDatabase } from "../NeedsDatabase";
import { GarageRow } from "./GarageRow";
import { NewGarageForm } from "./NewGarageForm";
import { styles } from "../styles";

export const dynamic = "force-dynamic";

/**
 * Garages (§9, §18).
 *
 * The most price-sensitive table on the site and the one a customer never sees.
 * Every quote runs garage → pickup → events → drop → garage, so a yard in the
 * wrong place does not look wrong anywhere — it just quietly adds or drops
 * kilometres from every job that car does.
 */
export default async function AdminGaragesPage() {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) {
    return (
      <NeedsDatabase
        email={admin.email}
        title="Garages"
        lede="Where the vehicles live."
        what="Garages"
      />
    );
  }
  const supabase = await createSupabaseServerClient();

  const [garages, cities, cars] = await Promise.all([
    supabase.from("garages").select("*").order("name"),
    supabase.from("cities").select("id, name").order("sort"),
    supabase.from("cars").select("id, garage_id"),
  ]);

  const cityOptions = (cities.data ?? []).map((city) => ({ id: city.id, name: city.name }));

  // How many vehicles each yard holds, so an edit is made with its blast
  // radius visible rather than guessed at.
  const counts = new Map<string, number>();
  for (const car of cars.data ?? []) {
    if (car.garage_id) counts.set(car.garage_id, (counts.get(car.garage_id) ?? 0) + 1);
  }
  const homeless = (cars.data ?? []).filter((car) => !car.garage_id).length;

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Garages"
        lede="Where the vehicles live. Internal to Xotic — the customer sees the transfer distance on a quote, never the yard."
      />

      <NewGarageForm cities={cityOptions} />

      <section className={styles.card} style={{ marginTop: "16.8px" }}>
        <h2 className={styles.cardTitle}>{(garages.data ?? []).length} garages</h2>
        <p className={styles.cardHint}>
          Moving a yard re-prices every vehicle based there, in both directions — the run out to the
          customer and the run home afterwards.
          {homeless > 0 && (
            <>
              {" "}
              {homeless} {homeless === 1 ? "vehicle has" : "vehicles have"} no garage and{" "}
              {homeless === 1 ? "is" : "are"} priced from the city centre instead.
            </>
          )}
        </p>

        {(garages.data ?? []).map((garage) => (
          <GarageRow
            key={garage.id}
            id={garage.id}
            slug={garage.slug}
            name={garage.name}
            cityId={garage.city_id}
            lat={garage.lat}
            lng={garage.lng}
            isActive={garage.is_active}
            carCount={counts.get(garage.id) ?? 0}
            cities={cityOptions}
          />
        ))}
      </section>
    </AdminShell>
  );
}
