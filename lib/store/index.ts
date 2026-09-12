/**
 * Which store answers.
 *
 * Credentials decide, and nothing else does: no flag to remember, no branch in
 * a route handler. The same rule the catalog already follows for reads, applied
 * to writes — see `lib/content.ts`.
 */

import { canRecordEnquiries } from "../supabase/admin";
import { createLocalStore } from "./local";
import { createSupabaseStore } from "./supabase";
import type { Store } from "./types";

export type { Availability, AvailabilityFilter, Lead, LeadCounts, LeadDetail, LeadFilter, LeadLine, LeadStop, Page, Store } from "./types";

let store: Store | null = null;

export function getStore(): Store {
  // Cached per process: both implementations are stateless handles, and the
  // environment does not change under a running server.
  if (!store) {
    if (!canRecordEnquiries() && process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORE !== "true") {
      throw new Error("Production lead storage requires Supabase credentials. ALLOW_LOCAL_STORE=true is only for a local production preview.");
    }
    store = canRecordEnquiries() ? createSupabaseStore() : createLocalStore();
  }
  return store;
}

/** True when leads are going to a file rather than a database. */
export function isLocalStore(): boolean {
  return getStore().kind === "local";
}
