import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS entirely.
 *
 * Used for exactly one thing: writing a captured enquiry from
 * app/api/enquiries/route.ts. Because inserts arrive this way, the enquiries
 * table needs no anonymous policy at all — there is no public API surface on
 * which a lead could be read or forged.
 *
 * `server-only` above makes importing this from a client component a build
 * error, so the key cannot leak into a browser bundle.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to record enquiries.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function canRecordEnquiries(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
