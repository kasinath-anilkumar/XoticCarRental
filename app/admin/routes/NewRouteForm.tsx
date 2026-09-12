"use client";
import { useState } from "react";
import { ReferenceSelect } from "@/components/admin/ReferenceSelect";
import { AdminForm, Field } from "../AdminForm";
import { createCityRoute } from "../actions";
import { styles } from "../styles";

export function NewRouteForm() {
  const [cityId, setCityId] = useState("");
  return <details className={styles.card}>
    <summary className="cursor-pointer text-lg">Publish a route fare</summary>
    <p className={styles.cardHint}>Choose the city page and two saved pickup points. The destination may belong to another city.</p>
    <AdminForm action={createCityRoute} submitLabel="Add route">
      <div className={styles.grid4}>
        <ReferenceSelect kind="cities" name="city_id" label="City page" required onChange={setCityId} />
        <ReferenceSelect key={cityId} kind="locations" name="from_location_id" label="From" cityId={cityId || undefined} required />
        <ReferenceSelect kind="locations" name="to_location_id" label="To" required />
        <Field label="Road distance (km)" name="km_override" type="number" min={1} hint="Leave blank to estimate." />
      </div>
    </AdminForm>
  </details>;
}
