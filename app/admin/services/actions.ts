"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { PUBLIC_CATALOG_TAG } from "@/lib/catalog-cache";
import { parseService } from "@/lib/service-validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "../actions";

export async function saveService(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  let createdSlug: string | undefined;
  try {
    const raw = form.get("definition");
    if (typeof raw !== "string" || raw.length > 60_000) throw new Error("Service content is too large.");
    const db = await createSupabaseServerClient();
    const occasionId = form.get("occasion_id");
    if (typeof occasionId !== "string" || !occasionId) throw new Error("Choose a pricing occasion.");
    const { data: occasion, error: lookupError } = await db.from("occasions").select("slug")
      .eq("id", occasionId).eq("is_active", true).maybeSingle();
    if (lookupError) throw lookupError;
    if (!occasion) throw new Error("Choose a published pricing occasion.");
    const input = JSON.parse(raw);
    const typeId = form.get("car_type_id");
    let type: string | undefined;
    if (typeof typeId === "string" && typeId) {
      const selected = await db.from("car_types").select("name").eq("id", typeId).maybeSingle();
      if (selected.error) throw selected.error;
      if (!selected.data) throw new Error("Choose an existing fleet type.");
      type = selected.data.name;
    }
    const definition = parseService({ ...input, occasionSlug: occasion.slug, carFilter: { ...input.carFilter, type } });
    const sort = Number(form.get("sort"));
    if (!Number.isInteger(sort) || sort < 0 || sort > 100_000) throw new Error("Display order must be a whole number from 0 to 100,000.");
    const values = { slug: definition.slug, definition, is_active: form.get("is_active") === "on", sort, updated_at: new Date().toISOString() };
    const id = form.get("id");
    let result;
    if (typeof id === "string" && id) {
      // Published URLs are stable: editing content must not break saved links.
      const { data: existing, error } = await db.from("services").select("slug").eq("id", id).single();
      if (error) throw error;
      if (existing.slug !== definition.slug) throw new Error("An existing service URL cannot be changed.");
      result = await db.from("services").update(values).eq("id", id).select("id").single();
    } else {
      result = await db.from("services").insert(values).select("id").single();
      createdSlug = definition.slug;
    }
    if (result.error) throw result.error;
    updateTag(PUBLIC_CATALOG_TAG);
    revalidatePath("/", "layout");
    revalidatePath("/admin/services");
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not save this service." };
  }
  if (createdSlug) redirect(`/admin/services/${createdSlug}`);
  return { ok: true, message: "Service saved. Publication changes are now reflected on the website." };
}
