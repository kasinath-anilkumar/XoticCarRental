import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { ADMIN_PAGE_SIZE, parsePage } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { NeedsDatabase } from "../NeedsDatabase";
import { styles } from "../styles";
import { AdminPageHead, AdminShell } from "../AdminShell";

export default async function ServicesAdminPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) return <NeedsDatabase email={admin.email} title="Services" lede="Offerings and enquiry forms." what="Service content" />;
  const params = await searchParams;
  const page = parsePage(params.page);
  const q = (params.q ?? "").trim().slice(0, 100);
  const db = await createSupabaseServerClient();
  let query = db.from("services").select("id,slug,name,group_key,is_active,sort", { count: "exact" }).order("sort").order("slug");
  if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, count, error } = await query.range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1);
  return <AdminShell email={admin.email}>
    <AdminPageHead title="Services" lede="Manage offerings, advertised packages and enquiry questions."><Link href="/admin/services/new" className="btn btn-primary">Add service</Link></AdminPageHead>
    <search><form className="mb-5 flex flex-wrap gap-3"><label htmlFor="service-search" className="sr-only">Search services</label><input id="service-search" name="q" className="input min-w-0 max-w-sm flex-1" placeholder="Search services" defaultValue={q} maxLength={100} /><button className="btn btn-secondary">Search</button></form></search>
    {error ? <p role="alert" className={styles.messageError}>Service content could not be loaded. Apply pending database migrations and try again.</p> : <>
      <HorizontalScroll label="Services" controls="above"><table className="min-w-[600px] w-full text-left text-sm"><thead><tr><th>Service</th><th>Group</th><th>Visibility</th><th>Order</th><th><span className="sr-only">Edit</span></th></tr></thead><tbody>{data?.map((service) => <tr key={service.id}><td>{service.name}</td><td>{service.group_key}</td><td>{service.is_active ? "Published" : "Draft"}</td><td>{service.sort}</td><td><Link href={`/admin/services/${service.slug}`} className="btn btn-secondary">Edit</Link></td></tr>)}</tbody></table></HorizontalScroll>
      {!data?.length && <p className="py-8 text-sm">No services match. Add a service to publish your first offering.</p>}
      <Pagination total={count ?? 0} page={page} pageSize={ADMIN_PAGE_SIZE} path="/admin/services" query={new URLSearchParams(q ? { q } : {}).toString()} label="services" />
    </>}
  </AdminShell>;
}
