import { GeoRecordFields } from "@/components/admin/GeoRecordFields";
import { ReferenceSelect } from "@/components/admin/ReferenceSelect";
import { AdminForm, Checkbox } from "../AdminForm";
import { deleteGarage, updateGarage } from "../actions";

export interface GarageRowProps {
  id: string; slug: string; name: string; cityId: string; cityLabel: string;
  lat: number; lng: number; isActive: boolean; carCount: number;
}

export function GarageRow(props: GarageRowProps) {
  return <details className="border-t border-[var(--color-divider)] py-4">
    <summary className="cursor-pointer text-sm"><strong>{props.name}</strong> ? {props.cityLabel} ? {props.carCount} vehicles ? {props.isActive ? "In use" : "Inactive"}</summary>
    <AdminForm action={updateGarage} submitLabel="Save garage" className="mt-4">
      <input type="hidden" name="id" value={props.id} />
      <GeoRecordFields name={props.name} lat={props.lat} lng={props.lng} />
      <ReferenceSelect kind="cities" name="city_id" label="Service city" initial={[{ value: props.cityId, label: props.cityLabel }]} required />
      <Checkbox name="is_active" label="In use" defaultChecked={props.isActive} />
    </AdminForm>
    {props.carCount === 0 ? <AdminForm action={deleteGarage} submitLabel="Remove empty garage"><input type="hidden" name="id" value={props.id} /></AdminForm> : <p className="mt-4 text-xs">Move its vehicles to another garage before removing it.</p>}
  </details>;
}
