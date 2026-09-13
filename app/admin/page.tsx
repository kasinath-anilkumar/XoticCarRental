import Link from "next/link";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";

import { requireAdmin } from "@/lib/admin/auth";
import { formatINR } from "@/lib/format";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { AdminPageHead, AdminShell } from "./AdminShell";
import { NeedsDatabase } from "./NeedsDatabase";
import { styles } from "./styles";
import { statusClass } from "./status";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) {
    return (
      <NeedsDatabase
        email={admin.email}
        title="Overview"
        lede="The dashboard"
        what="This dashboard"
      />
    );
  }
  const supabase = await createSupabaseServerClient();

  const [cars, cities, enquiries, settings, recent] = await Promise.all([
    supabase.from("cars").select("id", { count: "exact", head: true }),
    supabase.from("cities").select("id", { count: "exact", head: true }),
    supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("site_settings").select("whatsapp_number").maybeSingle(),
    supabase
      .from("enquiries")
      .select("id, created_at, customer_name, customer_phone, total, status, cars(name)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(8),
  ]);

  const failed = [cars, cities, enquiries, settings, recent].some((result) => result.error);
  if (failed) throw new Error("The dashboard could not load. Please try again.");

  const usingPlaceholderNumber = settings.data?.whatsapp_number === "919876543210";

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Overview"
        lede="Fleet, content and the enquiries coming in from the site."
      />

      {usingPlaceholderNumber && (
        <div className={styles.banner}>
          <div>
            <p className={styles.bannerTitle}>The WhatsApp number is still the placeholder</p>
            <p style={{ margin: 0 }}>
              Every enquiry button on the site points at <code>+91 98765 43210</code>, which came
              from the design prototype.{" "}
              <Link href="/admin/settings">Set the real number</Link> before launch.
            </p>
          </div>
        </div>
      )}

      <div className={styles.stats}>
        <Stat label="Cars" value={cars.count ?? 0} />
        <Stat label="Cities" value={cities.count ?? 0} />
        <Stat label="New enquiries" value={enquiries.count ?? 0} />
        <Stat label="Signed in as" value={admin.fullName ?? admin.email ?? "—"} small />
      </div>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Latest enquiries</h2>
        <p className={styles.cardHint}>
          Each row is a quote a visitor sent to WhatsApp, with the totals recomputed on the server.
        </p>

        {recent.data && recent.data.length > 0 ? (
          <HorizontalScroll label="Latest enquiries" controls="above">
            <table className="table min-w-[600px]">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Car</th>
                  <th>Contact</th>
                  <th className={styles.right}>Total</th>
                  <th className={styles.right}>Status</th>
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {recent.data.map((row: any) => (
                  <tr key={row.id}>
                    <td className={styles.muted}>
                      {new Date(row.created_at).toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td>{row.cars?.name ?? "—"}</td>
                    <td className={styles.muted}>
                      {row.customer_name || row.customer_phone || "No details left"}
                    </td>
                    <td className={styles.right}>{formatINR(Number(row.total))}</td>
                    <td className={styles.right}>
                      <span className={statusClass(row.status)}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </HorizontalScroll>
        ) : (
          <p className={styles.muted}>No enquiries yet.</p>
        )}

        <div className={styles.actions}>
          <Link href="/admin/enquiries" className="btn btn-secondary">
            All enquiries
          </Link>
        </div>
      </section>
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  small = false,
}: {
  label: string;
  value: number | string;
  small?: boolean;
}) {
  return (
    <div className={styles.stat}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue} style={small ? { fontSize: "15px" } : undefined}>
        {value}
      </p>
    </div>
  );
}
