import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { parseService } from "@/lib/service-validation";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { NeedsDatabase } from "../../NeedsDatabase";
import { ServiceEditor } from "../ServiceEditor";
import { AdminPageHead, AdminShell } from "../../AdminShell";

export default async function ServiceEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const admin = await requireAdmin();
  if (!isSupabaseConfigured()) return <NeedsDatabase email={admin.email} title="Services" lede="Offerings and enquiry forms." what="Service content" />;
  const { slug } = await params;
  const db = await createSupabaseServerClient();
  const { data, error } = slug === "new" ? { data: null, error: null } : await db.from("services").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (slug !== "new" && !data) notFound();
  const service = data ? parseService(data.definition) : undefined;
  const { data: occasion } = service ? await db.from("occasions").select("id,name").eq("slug", service.occasionSlug).maybeSingle() : { data: null };
  const { data: carType } = service?.carFilter.type ? await db.from("car_types").select("id,name").eq("name", service.carFilter.type).maybeSingle() : { data: null };
  return <AdminShell email={admin.email}><Link href="/admin/services" className="mb-5 inline-block text-sm">← Services</Link><AdminPageHead title={service ? `Edit ${service.name}` : "New service"} /><ServiceEditor initial={service} id={data?.id} active={data?.is_active} sort={data?.sort} occasion={occasion ? { value: occasion.id, label: occasion.name } : undefined} carType={carType ? { value: carType.id, label: carType.name } : undefined} /></AdminShell>;
}
