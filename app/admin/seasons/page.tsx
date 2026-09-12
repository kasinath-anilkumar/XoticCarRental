import { requireAdmin } from "@/lib/admin/auth";
import { seasonCovers } from "@/lib/seasons";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { AdminPageHead, AdminShell } from "../AdminShell";
import { NeedsDatabase } from "../NeedsDatabase";
import { NewSeasonForm } from "./NewSeasonForm";
import { SeasonRow } from "./SeasonRow";
import { styles } from "../styles";

export const dynamic = "force-dynamic";

/**
 * Peak seasons (§10).
 *
 * The months when every car is already out. A window here adds its own line to
 * a quote — "Wedding season rate, +20% on the package" — rather than quietly
 * inflating the base, because §11 asks the site to show what it is charging
 * and a customer who can see the reason argues with it far less than one who
 * finds the same trip cost more in December than a friend paid in June.
 */
export default async function AdminSeasonsPage() {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) {
    return (
      <NeedsDatabase
        email={admin.email}
        title="Seasons"
        lede="The months when the fleet is booked out."
        what="Peak seasons"
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const seasons = await supabase.from("seasons").select("*").order("starts_on");

  const today = new Date().toISOString().slice(0, 10);
  const rows = (seasons.data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    startsOn: row.starts_on as string,
    endsOn: row.ends_on as string,
    multiplier: Number(row.multiplier),
    note: (row.note ?? "") as string,
    isActive: row.is_active as boolean,
    current:
      row.is_active &&
      seasonCovers(
        {
          slug: row.slug,
          name: row.name,
          startsOn: row.starts_on,
          endsOn: row.ends_on,
          multiplier: Number(row.multiplier),
          note: row.note ?? "",
          isActive: true,
        },
        today,
      ),
  }));

  const live = rows.filter((row) => row.current);

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Seasons"
        lede="Recurring windows where the package rate goes up. Dates are MM-DD and repeat every year — a window that ends before it starts wraps past New Year."
      />

      {live.length > 0 && (
        <div className={styles.banner}>
          <div>
            <p className={styles.bannerTitle}>
              {live.map((row) => row.name).join(" and ")} {live.length === 1 ? "is" : "are"} in force
              today
            </p>
            Quotes priced right now carry{" "}
            {live.length === 1
              ? `+${Math.round((live[0]!.multiplier - 1) * 100)}%`
              : "the dearest of them"}{" "}
            on the package. Overlapping windows do not stack — the dearest wins.
          </div>
        </div>
      )}

      <NewSeasonForm />

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{rows.length} seasons</h2>
        <p className={styles.cardHint}>
          The multiplier applies to the package base only. Extra kilometres, the driver&rsquo;s bata
          and the night charge are costs rather than scarcity, and raising them in season would be
          hard to defend on an itemised quote.
        </p>

        {rows.length === 0 ? (
          <p className={styles.cardHint}>
            No seasons. Every date is priced at the standard rate.
          </p>
        ) : (
          rows.map((row) => <SeasonRow key={row.id} {...row} />)
        )}
      </section>
    </AdminShell>
  );
}
