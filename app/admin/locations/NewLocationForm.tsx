import { GeoRecordFields } from "@/components/admin/GeoRecordFields";
import { ReferenceSelect } from "@/components/admin/ReferenceSelect";
import { AdminForm, Checkbox } from "../AdminForm";
import { createLocation } from "../actions";
import { styles } from "../styles";

export function NewLocationForm() {
  return <details className={`${styles.card} ${styles.createCard}`}>
    <summary className={styles.recordSummary}><span className={styles.recordName}>Add a pickup point</span><span className={styles.recordMeta}>Save a place your drivers know</span></summary>
    <p className={styles.cardHint}>Find the place, then choose the saved city that manages this pickup point.</p>
    <AdminForm action={createLocation} submitLabel="Add location">
      <GeoRecordFields />
      <ReferenceSelect kind="cities" name="city_id" label="Service city" required />
      <Checkbox name="is_airport" label="This is an airport" />
    </AdminForm>
  </details>;
}
