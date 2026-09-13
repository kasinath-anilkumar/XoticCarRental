import { GeoRecordFields } from "@/components/admin/GeoRecordFields";
import { ReferenceSelect } from "@/components/admin/ReferenceSelect";
import { AdminForm } from "../AdminForm";
import { createGarage } from "../actions";
import { styles } from "../styles";

export function NewGarageForm() {
  return <details className={`${styles.card} ${styles.createCard}`}>
    <summary className={styles.recordSummary}><span className={styles.recordName}>Add a garage</span><span className={styles.recordMeta}>Create a vehicle base</span></summary>
    <p className={styles.cardHint}>Place the coordinates where the vehicles are parked. Quotes measure transfers from this point.</p>
    <AdminForm action={createGarage} submitLabel="Add garage">
      <GeoRecordFields />
      <ReferenceSelect kind="cities" name="city_id" label="Service city" required />
    </AdminForm>
  </details>;
}
