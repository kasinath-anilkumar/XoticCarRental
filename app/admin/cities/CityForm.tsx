import { GeoRecordFields } from "@/components/admin/GeoRecordFields";
import { AdminForm, Checkbox, Field, TextArea } from "../AdminForm";
import { createCity, updateCity } from "../actions";
import { styles } from "../styles";

export interface CityRecord {
  id: string; slug: string; name: string; state: string; lat: number; lng: number;
  multiplier: number; car_count: number; seo_title: string | null; seo_description: string | null; is_active: boolean;
}

export function CityForm({ city }: { city?: CityRecord }) {
  return <details className={`${styles.card} ${city ? "" : styles.createCard}`}>
    <summary className={styles.recordSummary}><span className={styles.recordName}>{city?.name ?? "Add a city"}</span><span className={styles.recordMeta}>{city?.state ?? "Expand your service area"}</span>{city && <span className={city.is_active ? styles.statusConfirmed : styles.status}>{city.is_active ? "Live" : "Draft"}</span>}</summary>
    <p className={styles.cardHint}>{city ? `/cities/${city.slug}` : "Find a city to fill its state and coordinates, then review its pricing before publishing."}</p>
    <AdminForm action={city ? updateCity : createCity} submitLabel={city ? "Save city" : "Add city"}>
      {city && <><input type="hidden" name="id" value={city.id} /><input type="hidden" name="slug" value={city.slug} /></>}
      <GeoRecordFields name={city?.name} state={city?.state} lat={city?.lat} lng={city?.lng} includeState cityOnly />
      <div className={styles.grid4}>
        <Field label="Rate multiplier" name="multiplier" type="number" step="0.01" min={0.01} defaultValue={city?.multiplier} required hint="Enter the multiplier for this city. 1.00 uses the base rate." />
        <Field label="Published car count" name="car_count" type="number" min={0} defaultValue={city?.car_count ?? 0} />
        <Field label="SEO title" name="seo_title" defaultValue={city?.seo_title} />
        <Checkbox label="Live on the site" name="is_active" defaultChecked={city?.is_active ?? false} />
      </div>
      <TextArea label="SEO description" name="seo_description" rows={2} defaultValue={city?.seo_description} />
    </AdminForm>
  </details>;
}
