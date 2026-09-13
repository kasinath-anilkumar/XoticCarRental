import { requireAdmin } from "@/lib/admin/auth";
import { parsePricingRules } from "@/lib/pricing-rules";
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

  let pricingRules;
  try { pricingRules = parsePricingRules(settings.pricing_rules); } catch { /* Missing values remain blank so staff can configure them. */ }

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Business settings"
        lede="The details and operating rules behind every quote. Keep your contact information and pricing policies in one place."
      />

      <nav className={styles.sectionNav} aria-label="Settings sections"><a href="#business-contact">Contact</a><a href="#quote-arithmetic">Quote arithmetic</a><a href="#operating-rules">Operating rules</a><a href="#price-inclusions">Inclusions</a><a href="#extra-charges">Extra charges</a></nav>
      <AdminForm action={updateSettings} submitLabel="Save settings" className={styles.editorForm}>
        <section id="business-contact" className={styles.card}>
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
              hint="Enter the configured business number, including its country code."
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

        <section id="quote-arithmetic" className={styles.card}>
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
              hint="Straight-line distance multiplied by this factor estimates road distance. Published route distances take precedence."
            />
          </div>
        </section>

        <section id="operating-rules" className={styles.card}>
          <h2 className={styles.cardTitle}>Operating rules</h2>
          <p className={styles.cardHint}>These values control estimated driving time, the one-way return charge and the night charge window. Hours use the 24-hour clock in India Standard Time.</p>
          {!pricingRules && <p className={styles.messageError}>Pricing rules are missing or invalid. Enter every rule before saving.</p>}
          <div className={styles.grid3}>
            <Field label="Minimum distance per moving leg (km)" name="minimumLegKm" type="number" step="0.1" min={0} max={100} defaultValue={pricingRules?.minimumLegKm} required hint="The billing floor for each moving leg, including garage travel. Use zero to remove the floor." />
            <Field label="Local average speed (km/h)" name="localSpeedKph" type="number" step="0.1" min={1} max={160} defaultValue={pricingRules?.localSpeedKph} required />
            <Field label="Outstation average speed (km/h)" name="outstationSpeedKph" type="number" step="0.1" min={1} max={160} defaultValue={pricingRules?.outstationSpeedKph} required />
            <Field label="Legacy one-way return charge (%)" name="oneWayReturnPercent" type="number" step="0.1" min={0} max={100} defaultValue={pricingRules?.oneWayReturnPercent} required hint="Only used for legacy distance inputs that omit the return leg. Garage-to-garage quotes already include it and do not add this charge." />
            <Field label="Night charge starts (hour)" name="nightStartHour" type="number" step="1" min={0} max={23} defaultValue={pricingRules?.nightStartHour} required />
            <Field label="Night charge ends (hour)" name="nightEndHour" type="number" step="1" min={0} max={23} defaultValue={pricingRules?.nightEndHour} required />
          </div>
        </section>

        <section id="price-inclusions" className={styles.card}>
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
