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

      <section className={`${styles.card} ${styles.empty}`}>
        <span className={styles.emptyIcon}><Icon name="ph-database" size={25} /></span>
        <h2 className={styles.cardTitle}>
          Connect your operations data
        </h2>
        <p className={styles.cardHint}>
          {what} needs a connected database before records can be created or edited here.
        </p>

        <div className={styles.actions}>
          <Link href="/admin/setup" className="btn btn-primary">
            View setup instructions
          </Link>
          <Link href="/admin/enquiries" className="btn btn-secondary">
            Open local enquiry desk
          </Link>
        </div>
      </section>
    </AdminShell>
  );
}
