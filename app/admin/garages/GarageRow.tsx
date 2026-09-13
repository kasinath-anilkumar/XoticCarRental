import { GeoRecordFields } from "@/components/admin/GeoRecordFields";
import { ReferenceSelect } from "@/components/admin/ReferenceSelect";
import { AdminForm, Checkbox } from "../AdminForm";
import { deleteGarage, updateGarage } from "../actions";
import { styles } from "../styles";

export interface GarageRowProps {
  id: string; slug: string; name: string; cityId: string; cityLabel: string;
  lat: number; lng: number; isActive: boolean; carCount: number;
}

export function GarageRow(props: GarageRowProps) {
  return <details className={styles.record}>
    <summary className={styles.recordSummary}><span className={styles.recordName}>{props.name}</span><span className={styles.recordMeta}>{props.cityLabel} / {props.carCount} vehicles</span><span className={props.isActive ? styles.statusConfirmed : styles.status}>{props.isActive ? "In use" : "Inactive"}</span></summary>
    <AdminForm action={updateGarage} submitLabel="Save garage" className={styles.recordBody}>
      <input type="hidden" name="id" value={props.id} />
      <GeoRecordFields name={props.name} lat={props.lat} lng={props.lng} />
      <ReferenceSelect kind="cities" name="city_id" label="Service city" initial={[{ value: props.cityId, label: props.cityLabel }]} required />
      <Checkbox name="is_active" label="In use" defaultChecked={props.isActive} />
    </AdminForm>
    {props.carCount === 0 ? <AdminForm action={deleteGarage} submitLabel="Remove empty garage"><input type="hidden" name="id" value={props.id} /></AdminForm> : <p className="mt-4 text-xs">Move its vehicles to another garage before removing it.</p>}
  </details>;
}
