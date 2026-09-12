import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { AdminForm, Field, TextArea } from "../AdminForm";
import { AdminPageHead, AdminShell } from "../AdminShell";
import { NeedsDatabase } from "../NeedsDatabase";
import { updateSettings } from "../actions";
import { ChargesForm } from "./ChargesForm";
import { styles } from "../styles";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) {
    return (
      <NeedsDatabase
        email={admin.email}
        title="Settings"
        lede="Contact details, tax and the advance."
        what="Settings"
      />
    );
  }
  const supabase = await createSupabaseServerClient();

  const { data: settings } = await supabase.from("site_settings").select("*").maybeSingle();

  if (!settings) {
    return (
      <AdminShell email={admin.email}>
        <AdminPageHead title="Settings" />
        <p className={styles.messageError}>
          No settings row found. Run <code>npm run seed</code> to create it.
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Settings"
        lede="Contact details, the tax and advance percentages, and the distance model. These apply to every quote on the site."
      />

      <AdminForm action={updateSettings} submitLabel="Save settings">
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Contact</h2>
          <p className={styles.cardHint}>
            The WhatsApp number receives every enquiry. Digits only, country code first — no plus,
            no spaces.
          </p>

          <div className={styles.grid3}>
            <Field
              label="WhatsApp number"
              name="whatsapp_number"
              defaultValue={settings.whatsapp_number}
              hint="e.g. 919876543210"
              required
            />
            <Field
              label="Phone, as displayed"
              name="phone_display"
              defaultValue={settings.phone_display}
              hint="Shown in the header and footer"
            />
            <Field label="Email" name="email" type="email" defaultValue={settings.email} />
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Quote arithmetic</h2>
          <p className={styles.cardHint}>
            Changing any of these moves every price on the site immediately.
          </p>

          <div className={styles.grid3}>
            <Field
              label="GST %"
              name="gst_percent"
              type="number"
              step="0.01"
              defaultValue={settings.gst_percent}
            />
            <Field
              label="Advance %"
              name="advance_percent"
              type="number"
              step="0.01"
              defaultValue={settings.advance_percent}
              hint="Rounded to the nearest ₹100 when quoted"
            />
            <Field
              label="Road circuity factor"
              name="circuity_factor"
              type="number"
              step="0.01"
              defaultValue={settings.circuity_factor}
              hint="Straight-line km × this = road km. 1.25 is a good default for India. Routes with a published distance ignore it."
            />
          </div>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>What the price includes</h2>
          <p className={styles.cardHint}>
            One item per line. Shown on the car pages and the booking summary.
          </p>

          <div className={styles.grid2}>
            <TextArea
              label="Included"
              name="inclusions"
              rows={6}
              defaultValue={(settings.inclusions ?? []).join("\n")}
            />
            <TextArea
              label="Paid at actuals"
              name="exclusions"
              rows={6}
              defaultValue={(settings.exclusions ?? []).join("\n")}
            />
          </div>
        </section>
      </AdminForm>

      {/* Its own form: a charge switched on changes every quote, and it should
          not ride along on a save that was only meant to fix a phone number. */}
      <ChargesForm charges={settings.charges ?? []} />
    </AdminShell>
  );
}
