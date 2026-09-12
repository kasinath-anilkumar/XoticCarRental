import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { AdminForm, Checkbox, Field, TextArea } from "../AdminForm";
import { AdminPageHead, AdminShell } from "../AdminShell";
import { NeedsDatabase } from "../NeedsDatabase";
import { updateOccasion } from "../actions";
import { styles } from "../styles";

export const dynamic = "force-dynamic";

export default async function AdminOccasionsPage() {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) {
    return (
      <NeedsDatabase
        email={admin.email}
        title="Occasions"
        lede="The pricing dimension behind the services."
        what="Occasions"
      />
    );
  }
  const supabase = await createSupabaseServerClient();

  const { data: occasions, error } = await supabase.from("occasions").select("*").order("sort");

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Occasions"
        lede="Each occasion is both a landing page and a quote input — the surcharge here becomes a line on every quote for it."
      />

      {error && <p className={styles.messageError}>{error.message}</p>}

      {(occasions ?? []).map((occasion) => (
        <AdminForm key={occasion.id} action={updateOccasion} submitLabel={`Save ${occasion.name}`}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{occasion.name}</h2>
            <p className={styles.cardHint}>/occasions/{occasion.slug}</p>

            <input type="hidden" name="id" value={occasion.id} />
            <input type="hidden" name="slug" value={occasion.slug} />

            <div className={styles.grid3}>
              <Field label="Name" name="name" defaultValue={occasion.name} required />
              <Field label="Tagline" name="tagline" defaultValue={occasion.tagline} />
              <Field
                label="Handling surcharge (₹)"
                name="surcharge"
                type="number"
                defaultValue={occasion.surcharge}
                hint="0 adds no line to the quote"
              />
            </div>

            <Field
              label="Surcharge note"
              name="handling_note"
              defaultValue={occasion.handling_note}
              hint="Printed under the surcharge on the quote — say what the money buys"
            />

            <div className={styles.grid3} style={{ marginTop: "11.2px" }}>
              <Field label="Kicker" name="kicker" defaultValue={occasion.kicker} />
              <Field label="Fleet section title" name="fleet_title" defaultValue={occasion.fleet_title} />
              <Field label="CTA title" name="cta_title" defaultValue={occasion.cta_title} />
            </div>

            <Field label="Page headline" name="title" defaultValue={occasion.title} />
            <TextArea label="Intro blurb" name="blurb" rows={2} defaultValue={occasion.blurb} />

            <div className={styles.grid2}>
              <Field label="“What's included” heading" name="h2" defaultValue={occasion.h2} />
              <Checkbox
                label="Live on the site"
                name="is_active"
                defaultChecked={occasion.is_active}
              />
            </div>

            <TextArea label="Footnote" name="note" rows={2} defaultValue={occasion.note} />
          </section>
        </AdminForm>
      ))}
    </AdminShell>
  );
}
