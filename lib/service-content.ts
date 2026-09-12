import "server-only";
import { cache } from "react";
import { getCatalog } from "./content";
import { createPublicClient } from "./public-db";
import { pageBounds, readKeysetPages } from "./pagination";
import { parseService, resolveServiceChoices } from "./service-validation";
import { isSupabaseConfigured } from "./supabase/server";
import type { Service } from "./services";

function previewServices(): Service[] {
  // Explicit no-database preview only. A live outage never publishes seed data.
  const seed: unknown[] = require("@/backend/service-seed-data.json");
  return seed.map(parseService);
}

async function hydrate(definitions: unknown[]): Promise<Service[]> {
  const catalog = await getCatalog();
  return definitions.map((value) => resolveServiceChoices(parseService(value), catalog.carTypes));
}

/** Bounded public list; full definitions only cross the client boundary for one form. */
export const getServicePage = cache(async (page = 1, pageSize = 24): Promise<{ data: Service[]; total: number; page: number; pageCount: number; offset: number; from: number; to: number }> => {
  const size = Math.max(1, Math.min(100, Math.floor(pageSize)));
  const requested = Number.isSafeInteger(page) && page > 0 && page <= 100_000 ? page : 1;
  if (!isSupabaseConfigured()) {
    const all = previewServices();
    const bounds = pageBounds(all.length, requested, size);
    return { data: await hydrate(all.slice(bounds.offset, bounds.offset + size)), total: all.length, ...bounds };
  }
  const db = createPublicClient();
  const offset = (requested - 1) * size;
  const { data, count, error } = await db.from("services").select("definition", { count: "exact" })
    .eq("is_active", true).order("sort").order("slug").range(offset, offset + size - 1);
  if (error) throw error;
  const bounds = pageBounds(count ?? 0, requested, size);
  if (bounds.page !== requested) return getServicePage(bounds.page, size);
  return { data: await hydrate((data ?? []).map((row) => row.definition)), total: count ?? 0, ...bounds };
});

export const getService = cache(async (slug: string): Promise<Service | undefined> => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return undefined;
  if (!isSupabaseConfigured()) {
    const item = previewServices().find((service) => service.slug === slug);
    return item ? (await hydrate([item]))[0] : undefined;
  }
  const { data, error } = await createPublicClient().from("services").select("definition")
    .eq("is_active", true).eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? (await hydrate([data.definition]))[0] : undefined;
});

/** Used by route generation and sitemaps, which must enumerate published content. */
export const getServices = cache(async (): Promise<Service[]> => {
  if (!isSupabaseConfigured()) return hydrate(previewServices());
  const db = createPublicClient();
  const rows = await readKeysetPages<{ id: string; definition: unknown; sort: number }>(async (after) => {
    let query = db.from("services").select("id, definition, sort").eq("is_active", true).order("id").limit(200);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });
  rows.sort((a, b) => a.sort - b.sort);
  return hydrate(rows.map((row) => row.definition));
});
