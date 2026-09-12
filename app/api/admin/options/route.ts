import { currentAdmin } from "@/lib/admin/auth";
import { REFERENCE_PAGE_SIZE, referenceRequest, searchPattern } from "@/lib/admin/references";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  if (!await currentAdmin()) return Response.json({ error: "Sign in as an administrator." }, { status: 401, headers });
  if (!isSupabaseConfigured()) return Response.json({ error: "Connect the database to manage references." }, { status: 503, headers });
  let input;
  try { input = referenceRequest(new URL(request.url).searchParams); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid search." }, { status: 400, headers }); }
  const { kind, query, cityId, page } = input;
  const supabase = await createSupabaseServerClient();
  // A fixed allowlist chooses both table and projection. No full catalog or count
  // query is needed: one extra row tells the picker whether another page exists.
  const columns = kind === "cities" ? "id,name,state" : kind === "cars" ? "id,name,slug" : "id,name";
  let builder = supabase.from(kind).select(columns).order("name").order("id");
  if (query) builder = builder.ilike("name", searchPattern(query));
  if (cityId && (kind === "locations" || kind === "garages")) builder = builder.eq("city_id", cityId);
  const offset = (page - 1) * REFERENCE_PAGE_SIZE;
  const result = await builder.range(offset, offset + REFERENCE_PAGE_SIZE).abortSignal(request.signal);
  if (result.error) return Response.json({ error: "Could not load choices. Please try again." }, { status: 503, headers });
  const rows = (result.data ?? []) as unknown as Array<{ id: string; name: string; slug?: string; state?: string }>;
  return Response.json({
    options: rows.slice(0, REFERENCE_PAGE_SIZE).map((row) => ({ value: kind === "cars" ? row.slug : row.id, label: row.name, ...(row.state ? { detail: row.state } : {}) })),
    page, hasMore: rows.length > REFERENCE_PAGE_SIZE,
  }, { headers });
}
