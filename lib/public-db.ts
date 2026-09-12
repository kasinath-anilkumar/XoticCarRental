import "server-only";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_CATALOG_REVALIDATE, PUBLIC_CATALOG_TAG } from "./catalog-cache";

/** Shared public reads never inherit an authenticated staff session. */
export function createPublicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Fetch caches can survive deployments. Version the request when a schema
    // migration changes required fields, so old rows cannot break a new build.
    global: { headers: { "x-catalog-schema": "pricing-rules-0019" }, fetch: (input, init) => fetch(input, { ...init, cache: "force-cache",
      next: { revalidate: PUBLIC_CATALOG_REVALIDATE, tags: [PUBLIC_CATALOG_TAG] } }) },
  });
}
