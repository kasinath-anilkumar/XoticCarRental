import Link from "next/link";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { Icon } from "@/components/ui/Icon";

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
        title="Operations overview"
        lede="A clear view of your fleet, service areas and the conversations that need your attention."
      ><Link href="/admin/enquiries" className="btn btn-primary">Open enquiry desk <Icon name="ph-arrow-up-right" size={16} /></Link></AdminPageHead>

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
        <Stat label="New enquiries" value={enquiries.count ?? 0} hint="Ready for a first response" href="/admin/enquiries?view=new" icon="ph-chat-teardrop-text" />
        <Stat label="Vehicles in your fleet" value={cars.count ?? 0} hint="Rates, images and vehicle details" href="/admin/fleet" icon="ph-car-profile" />
        <Stat label="Service city records" value={cities.count ?? 0} hint="Manage live and draft service areas" href="/admin/cities" icon="ph-city" />
      </div>

      <div className={styles.dashboardGrid}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div><h2 className={styles.cardTitle}>Latest enquiries</h2><p className={styles.cardHint} style={{ marginBottom: 0 }}>The most recent conversations from your website.</p></div>
          <Link href="/admin/enquiries?view=all" className="btn btn-ghost">View all <Icon name="ph-arrow-up-right" size={15} /></Link>
        </div>

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
          <div className={styles.empty}><span className={styles.emptyIcon}><Icon name="ph-chat-teardrop-text" size={24} /></span><h3 className={styles.cardTitle}>Your next conversation starts here</h3><p className={styles.cardHint}>New website enquiries will appear here with their contact details and quote.</p></div>
        )}

        <div className={styles.actions}>
          <Link href="/admin/enquiries" className="btn btn-secondary">
            All enquiries
          </Link>
        </div>
      </section>
      <aside className={styles.card}>
        <p className={styles.eyebrow}>Day-to-day</p>
        <h2 className={styles.cardTitle}>Keep things moving</h2>
        <Link href="/admin/availability" className={styles.quickLink}><div><strong>Plan vehicle availability</strong><span>Review holds, bookings and workshop days.</span></div><Icon name="ph-arrow-up-right" size={17} /></Link>
        <Link href="/admin/fleet" className={styles.quickLink}><div><strong>Maintain the fleet</strong><span>Keep rate cards and vehicle details current.</span></div><Icon name="ph-arrow-up-right" size={17} /></Link>
        <Link href="/admin/services" className={styles.quickLink}><div><strong>Shape your services</strong><span>Update offerings and customer enquiry forms.</span></div><Icon name="ph-arrow-up-right" size={17} /></Link>
        <Link href="/admin/settings" className={styles.quickLink}><div><strong>Review business settings</strong><span>Contact details, charges and operating rules.</span></div><Icon name="ph-arrow-up-right" size={17} /></Link>
      </aside>
      </div>
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  hint,
  href,
  icon,
}: {
  label: string;
  value: number | string;
  hint: string;
  href: string;
  icon: string;
}) {
  return (
    <Link href={href} prefetch={false} className={styles.stat}>
      <div className={styles.statTop}><p className={styles.statLabel}>{label}</p><span className={styles.statIcon}><Icon name={icon} size={20} /></span></div>
      <p className={styles.statValue}>
        {value}
      </p>
      <p className={styles.statHint}>{hint}</p>
    </Link>
  );
}
