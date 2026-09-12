import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { AdminForm, Checkbox, Field, TextArea } from "../AdminForm";
import { AdminPageHead, AdminShell } from "../AdminShell";
import { NeedsDatabase } from "../NeedsDatabase";
import { updateCity } from "../actions";
import { styles } from "../styles";

export const dynamic = "force-dynamic";

export default async function AdminCitiesPage() {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) {
    return (
      <NeedsDatabase
        email={admin.email}
        title="Cities"
        lede="Where Xotic operates."
        what="Cities"
      />
    );
  }
  const supabase = await createSupabaseServerClient();

  const { data: cities, error } = await supabase.from("cities").select("*").order("sort");

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Cities"
        lede="A city's multiplier scales every package rate for the cars based there. The car count is a marketing headline, not live inventory."
      />

      {error && <p className={styles.messageError}>{error.message}</p>}

      {(cities ?? []).map((city) => (
        <AdminForm key={city.id} action={updateCity} submitLabel={`Save ${city.name}`}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{city.name}</h2>
            <p className={styles.cardHint}>/cities/{city.slug}</p>

            <input type="hidden" name="id" value={city.id} />
            <input type="hidden" name="slug" value={city.slug} />

            <div className={styles.grid4}>
              <Field label="Name" name="name" defaultValue={city.name} required />
              <Field label="State" name="state" defaultValue={city.state} />
              <Field
                label="Rate multiplier"
                name="multiplier"
                type="number"
                step="0.01"
                defaultValue={city.multiplier}
                hint="1.00 = base rate"
              />
              <Field
                label="Car count"
                name="car_count"
                type="number"
                defaultValue={city.car_count}
              />
              <Field label="Latitude" name="lat" type="number" step="0.00001" defaultValue={city.lat} />
              <Field label="Longitude" name="lng" type="number" step="0.00001" defaultValue={city.lng} />
              <Field
                label="SEO title"
                name="seo_title"
                defaultValue={city.seo_title}
                hint="Blank uses the default"
              />
              <Checkbox label="Live on the site" name="is_active" defaultChecked={city.is_active} />
            </div>

            <TextArea
              label="SEO description"
              name="seo_description"
              rows={2}
              defaultValue={city.seo_description}
              hint="Blank uses the generated one"
            />
          </section>
        </AdminForm>
      ))}
    </AdminShell>
  );
}
