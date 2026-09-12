"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for the browser. Only the admin panel uses it — sign-in and
 * the CRUD screens. The public site is entirely server-rendered.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
