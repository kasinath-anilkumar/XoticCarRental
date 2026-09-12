import Link from "next/link";

import { Icon } from "@/components/ui/Icon";

import { AdminPageHead, AdminShell } from "./AdminShell";
import { styles } from "./styles";

/**
 * What a content page shows before Supabase exists.
 *
 * The catalog reads from `backend/seed-data.js` when there is no database, so
 * the public site works — but the seed is a file in the repository, and editing
 * it from a web form would be a lie. Rather than throwing (which is what these
 * pages did: a bare 500 with a stack trace), each one says what it needs.
 *
 * Leads and availability are exempt. They are written by customers and staff
 * rather than shipped with the code, so they have a local store behind them and
 * work today.
 */
export function NeedsDatabase({
  email,
  title,
  lede,
  what,
}: {
  email: string | null;
  title: string;
  lede: string;
  /** What this page would let you edit, named plainly. */
  what: string;
}) {
  return (
    <AdminShell email={email}>
      <AdminPageHead title={title} lede={lede} />

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Icon name="ph-warning-circle" size={18} color="var(--color-accent)" /> No database
          connected
        </h2>
        <p className={styles.cardHint}>
          {what} lives in <code>backend/seed-data.js</code> until Supabase is connected. The site
          reads it happily — every page works — but a form here would have nowhere to save to.
        </p>
        <p className={styles.cardHint} style={{ marginTop: "8.4px" }}>
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
          <code>.env.local</code>, run the migrations in{" "}
          <code>backend/supabase/migrations</code>, then seed with{" "}
          <code>npm run seed</code>. README.md, &ldquo;Connecting Supabase&rdquo;, has the order.
        </p>

        <div className={styles.actions}>
          <Link href="/admin/enquiries" className="btn btn-primary">
            <Icon name="ph-chat-teardrop-text" size={16} />
            Leads still work
          </Link>
          <Link href="/admin/availability" className="btn btn-secondary">
            <Icon name="ph-calendar-blank" size={16} />
            So does availability
          </Link>
        </div>
      </section>
    </AdminShell>
  );
}
