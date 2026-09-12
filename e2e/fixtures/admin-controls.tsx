import { createRoot } from "react-dom/client";
import { ReferenceSelect } from "../../components/admin/ReferenceSelect";
import { GeoRecordFields } from "../../components/admin/GeoRecordFields";
import { ServiceEditor } from "../../app/admin/services/ServiceEditor";

createRoot(document.getElementById("root")!).render(<main>
  <form id="references" onSubmit={(event) => { event.preventDefault(); document.getElementById("saved")!.textContent = JSON.stringify([...new FormData(event.currentTarget)]); }}>
    <ReferenceSelect kind="cities" name="city_id" label="Service city" required />
    <ReferenceSelect kind="occasions" name="occasion_ids" label="Occasions" multiple initial={[{ value: "saved-occasion", label: "Already assigned" }]} />
    <button type="submit">Save references</button><output id="saved" />
  </form>
  <form id="geography"><GeoRecordFields includeState /><button type="submit">Save geography</button></form>
  <section aria-label="Service editor"><ServiceEditor /><output id="service-saved" /></section>
</main>);
