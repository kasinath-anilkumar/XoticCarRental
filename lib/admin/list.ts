import { redirect } from "next/navigation";
import { ADMIN_PAGE_SIZE, pageBounds, pageHref, parsePage } from "@/lib/pagination";

export type AdminSearchParams = Promise<Record<string, string | string[] | undefined>>;
export function adminListRequest(params: Awaited<AdminSearchParams>) {
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 100);
  const city = typeof params.city === "string" && /^[0-9a-f-]{36}$/i.test(params.city) ? params.city : "";
  const page = parsePage(params.page);
  const offset = (page - 1) * ADMIN_PAGE_SIZE;
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (city) query.set("city", city);
  return { q, city, page, offset, end: offset + ADMIN_PAGE_SIZE - 1, query: query.toString() };
}

export function checkAdminPage(result: { error: { message: string } | null; count: number | null }, request: ReturnType<typeof adminListRequest>, path: string) {
  if (result.error) throw new Error(`Could not load admin records: ${result.error.message}`);
  const total = result.count ?? 0;
  const bounds = pageBounds(total, request.page, ADMIN_PAGE_SIZE);
  if (bounds.page !== request.page) redirect(pageHref(path, request.query, bounds.page));
  return total;
}
