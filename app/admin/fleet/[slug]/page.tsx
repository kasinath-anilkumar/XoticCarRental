import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { AdminForm, Checkbox, Field, Select } from "../../AdminForm";
import { CarPhotos, type CarPhoto } from "./CarPhotos";
import { AdminPageHead, AdminShell } from "../../AdminShell";
import { NeedsDatabase } from "../../NeedsDatabase";
import { updateCar } from "../../actions";
import { styles } from "../../styles";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export default async function AdminCarPage({ params }: { params: Params }) {
  const { slug } = await params;
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) {
    return (
      <NeedsDatabase
        email={admin.email}
        title="Vehicle"
        lede="Editing a vehicle."
        what="Vehicle detail"
      />
    );
  }
  const supabase = await createSupabaseServerClient();

  const [carResult, types, cities, occasions, garages] = await Promise.all([
    supabase
      .from("cars")
      .select(
        "*, car_occasions(occasion_id), car_service_cities(city_id), car_images(id, url, kind, alt, sort)",
      )
      .eq("slug", slug)
      .maybeSingle(),
    supabase.from("car_types").select("id, name").order("sort"),
    supabase.from("cities").select("id, name").order("sort"),
    supabase.from("occasions").select("id, name").order("sort"),
    supabase.from("garages").select("id, name, cities(name)").order("name"),
  ]);

  const car = carResult.data;
  if (!car) notFound();

  const taggedOccasions = new Set<string>(
    (car.car_occasions ?? []).map((link: { occasion_id: string }) => link.occasion_id),
  );

  // §6 — where this unit may be sent. No rows means no restriction.
  const servedCities = new Set<string>(
    (car.car_service_cities ?? []).map((link: { city_id: string }) => link.city_id),
  );

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead title={car.name} lede={`Editing /cars/${car.slug}`}>
        <div className={styles.actions} style={{ margin: 0 }}>
          <Link href={`/cars/${car.slug}`} className="btn btn-secondary" target="_blank">
            View on site
          </Link>
          <Link href="/admin/fleet" className="btn btn-ghost">
            Back to fleet
          </Link>
        </div>
      </AdminPageHead>

      <AdminForm action={updateCar} submitLabel="Save car">
        <input type="hidden" name="id" value={car.id} />
        <input type="hidden" name="slug" value={car.slug} />

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Vehicle</h2>
          <p className={styles.cardHint}>
            The slug is the URL and cannot be changed here — a live page&rsquo;s address should not
            move by accident.
          </p>

          <div className={styles.grid3}>
            <Field label="Name" name="name" defaultValue={car.name} required />
            <Field label="Year" name="year" type="number" min={1900} max={2100} step="1" defaultValue={car.year} required />
            <Field label="Badge" name="badge" defaultValue={car.badge} hint="e.g. Most booked" />
            <Select
              label="Type"
              name="car_type_id"
              defaultValue={car.car_type_id}
              options={(types.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            />
            <Select
              label="Home city"
              name="home_city_id"
              defaultValue={car.home_city_id}
              options={(cities.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              hint="Its multiplier prices this car"
            />
            <Select
              label="Garage"
              name="garage_id"
              defaultValue={car.garage_id ?? ""}
              options={[
                { value: "", label: "No garage — city centre is used" },
                ...(garages.data ?? []).map((g: { id: string; name: string }) => ({
                  value: g.id,
                  label: g.name,
                })),
              ]}
              hint="Where the distance is measured from (§9)"
            />
            <Field label="Seats" name="seats" type="number" defaultValue={car.seats} />
            <Field label="Transmission" name="transmission" defaultValue={car.transmission} />
            <Field label="Fuel" name="fuel" defaultValue={car.fuel} />
            <Field
              label="Rating"
              name="rating"
              type="number"
              step="0.1"
              min={0}
              max={5}
              defaultValue={car.rating}
            />
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Rate card</h2>
          <p className={styles.cardHint}>
            Whole rupees, before the city multiplier. These are the numbers every quote is built
            from.
          </p>

          <div className={styles.grid4}>
            <Field label="8 hrs / 80 km" name="rate_8h" type="number" defaultValue={car.rate_8h} />
            <Field
              label="12 hrs / 120 km"
              name="rate_12h"
              type="number"
              defaultValue={car.rate_12h}
            />
            <Field
              label="Full day 24 hrs"
              name="rate_full"
              type="number"
              defaultValue={car.rate_full}
            />
            <Field
              label="Extra km"
              name="extra_km_rate"
              type="number"
              defaultValue={car.extra_km_rate}
              hint="₹ per km past the package"
            />
            <Field
              label="Extra hour"
              name="extra_hr_rate"
              type="number"
              defaultValue={car.extra_hr_rate}
              hint="Published on the rate card"
            />
            <Field
              label="Driver bata"
              name="bata"
              type="number"
              defaultValue={car.bata}
              hint="Per day, food and stay"
            />
            <Field
              label="Night charge"
              name="night_charge"
              type="number"
              defaultValue={car.night_charge}
              hint="10pm–6am, or an overnight halt"
            />
            <Field label="Sort order" name="sort" type="number" defaultValue={car.sort} />
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Occasions and visibility</h2>
          <p className={styles.cardHint}>
            Tagged occasions decide which occasion pages feature this car and which browse filters
            find it.
          </p>

          <div style={{ display: "flex", gap: "16.8px", flexWrap: "wrap" }}>
            {(occasions.data ?? []).map((occasion) => (
              <label
                key={occasion.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  name="occasion_ids"
                  value={occasion.id}
                  defaultChecked={taggedOccasions.has(occasion.id)}
                  style={{ width: "16px", height: "16px", accentColor: "var(--color-accent)" }}
                />
                {occasion.name}
              </label>
            ))}
          </div>

          <Checkbox label="Live on the site" name="is_active" defaultChecked={car.is_active} />
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Where it may be sent</h2>
          <p className={styles.cardHint}>
            Leave every box clear for a car that travels anywhere Xotic serves — that is most of
            the fleet, and it is what this means when it is empty. Tick cities only to hold a car
            back: a vintage car that is not driven between states, a signature car kept for one
            city. Its home city is always allowed whatever is ticked here.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "11.2px",
              marginTop: "11.2px",
            }}
          >
            {(cities.data ?? []).map((item) => (
              <label
                key={item.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  name="service_city_ids"
                  value={item.id}
                  defaultChecked={servedCities.has(item.id)}
                  style={{ width: "16px", height: "16px", accentColor: "var(--color-accent)" }}
                />
                {item.name}
              </label>
            ))}
          </div>
        </section>
      </AdminForm>

      {/* Photographs are their own forms: one upload, one save per picture.
          Folding them into the car form would mean a failed upload discarding
          an unsaved rate change. */}
      <div style={{ marginTop: "16.8px" }}>
        <CarPhotos
          carId={car.id}
          slug={car.slug}
          carName={car.name}
          photos={[...((car.car_images ?? []) as CarPhoto[])].sort((a, b) => a.sort - b.sort)}
        />
      </div>
    </AdminShell>
  );
}
