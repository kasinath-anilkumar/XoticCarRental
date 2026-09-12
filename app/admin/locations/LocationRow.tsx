import { GeoRecordFields } from "@/components/admin/GeoRecordFields";
import { ReferenceSelect } from "@/components/admin/ReferenceSelect";
import { AdminForm, Checkbox, Field } from "../AdminForm";
import { updateLocation } from "../actions";
import { styles } from "../styles";

export interface LocationRowProps {
  id: string; slug: string; name: string; cityId: string; cityLabel: string;
  lat: number; lng: number; isAirport: boolean; isActive: boolean; sort: number;
}

export function LocationRow(props: LocationRowProps) {
  return <details className="border-t border-[var(--color-divider)] py-4">
    <summary className="cursor-pointer text-sm"><strong>{props.name}</strong> ? {props.cityLabel} ? {props.isActive ? "Live" : "Hidden"}</summary>
    <AdminForm action={updateLocation} submitLabel="Save location" className="mt-4">
      <input type="hidden" name="id" value={props.id} />
      <GeoRecordFields name={props.name} lat={props.lat} lng={props.lng} />
      <div className={styles.grid4}>
        <ReferenceSelect kind="cities" name="city_id" label="Service city" initial={[{ value: props.cityId, label: props.cityLabel }]} required />
        <Field name="sort" label="Sort order" type="number" defaultValue={props.sort} />
        <Checkbox name="is_airport" label="Airport" defaultChecked={props.isAirport} />
        <Checkbox name="is_active" label="Live" defaultChecked={props.isActive} />
      </div>
    </AdminForm>
  </details>;
}
