import { ListFilters } from "@/components/admin/ListFilters";
import { Pagination } from "@/components/ui/Pagination";
import { adminListRequest, checkAdminPage, type AdminSearchParams } from "@/lib/admin/list";
import { searchPattern } from "@/lib/admin/references";
import { ADMIN_PAGE_SIZE } from "@/lib/pagination";
import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

import { AdminPageHead, AdminShell } from "../AdminShell";
import { NeedsDatabase } from "../NeedsDatabase";
import { PackageRow } from "./PackageRow";
import { styles } from "../styles";

export const dynamic = "force-dynamic";

/**
 * Packages (§18, §19).
 *
 * The hours and kilometres in a package are pricing rules, not labels — every
 * quote counts extra kilometres from the number in this table — which is why
 * §10 says they must not be hard-coded into the frontend and §18 says staff
 * must be able to change them.
 */
export default async function AdminPackagesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) {
    return (
      <NeedsDatabase
        email={admin.email}
        title="Packages"
        lede="The hours and kilometres each rate buys."
        what="Packages"
      />
    );
  }
  const supabase = await createSupabaseServerClient();

  const request = adminListRequest(await searchParams);
  let builder = supabase.from("packages").select("*", { count: "exact" }).order("sort").order("id");
  if (request.q) builder = builder.ilike("label", searchPattern(request.q));
  const result = await builder.range(request.offset, request.end);
  const total = checkAdminPage(result, request, "/admin/packages");
  const packages = result;

  return (
    <AdminShell email={admin.email}>
      <AdminPageHead
        title="Packages"
        lede="The hours and kilometres each rate buys. Changing them changes every quote from the next page load."
      />

      <ListFilters path="/admin/packages" q={request.q} />
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>{total} matching packages</h2>
        <p className={styles.cardHint}>
          The rate each package bills is fixed against a column on every car and is shown here for
          reference — adding a fourth rate is a schema change, not a setting. Turning a package off
          removes it from the search, the cards and the calculator; existing quotes keep the numbers
          they were given.
        </p>

        {(packages.data ?? []).map((pkg) => (
          <PackageRow
            key={pkg.id}
            id={pkg.id}
            slug={pkg.slug}
            label={pkg.label}
            hours={Number(pkg.hours)}
            km={pkg.km}
            rateKey={pkg.rate_key}
            sub={pkg.sub}
            icon={pkg.icon}
            isActive={pkg.is_active}
            sort={pkg.sort}
          />
        ))}
      </section>
      <Pagination total={total} page={request.page} pageSize={ADMIN_PAGE_SIZE} path="/admin/packages" query={request.query} label="packages" />
    </AdminShell>
  );
}
