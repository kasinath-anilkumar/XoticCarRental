import { createRoot } from "react-dom/client";
import { ReferenceSelect } from "../../components/admin/ReferenceSelect";
import { GeoRecordFields } from "../../components/admin/GeoRecordFields";
import { ServiceEditor } from "../../app/admin/services/ServiceEditor";
import { styles } from "../../app/admin/styles";
import { AdminPageHead, AdminShell } from "../../app/admin/AdminShell";

window.history.replaceState(null, "", "/admin/services");
createRoot(document.getElementById("root")!).render(<main><AdminShell email="operations@example.test">
  <AdminPageHead title="Workspace controls" lede="Reference selection, location data and service editing." />
  <form id="references" className={`${styles.card} mt-8`} onSubmit={(event) => { event.preventDefault(); document.getElementById("saved")!.textContent = JSON.stringify([...new FormData(event.currentTarget)]); }}>
    <ReferenceSelect kind="cities" name="city_id" label="Service city" required />
    <ReferenceSelect kind="occasions" name="occasion_ids" label="Occasions" multiple initial={[{ value: "saved-occasion", label: "Already assigned" }]} />
    <button className="btn btn-primary mt-6" type="submit">Save references</button><output id="saved" />
  </form>
  <form id="geography" className={styles.card}><GeoRecordFields includeState /><button className="btn btn-primary" type="submit">Save geography</button></form>
  <section aria-label="Service editor"><ServiceEditor /><output id="service-saved" /></section>
</AdminShell></main>);
