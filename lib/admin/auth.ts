import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export interface AdminSession {
  userId: string;
  email: string | null;
  fullName: string | null;
}

/**
 * The admin gate.
 *
 * Two checks, not one: a Supabase session proves who you are, and a `staff` row
 * with `is_admin` proves you belong here. Signing up for an account — if that
 * were ever enabled — must not be enough to reach the fleet's rate card.
 *
 * The same rule is enforced in the database by RLS (0006_rls.sql), so this is
 * the friendly redirect, not the security boundary.
 */
/**
 * Whether the admin may be opened without a Supabase session.
 *
 * Three conditions, all required:
 *
 *   1. Supabase is NOT configured. The moment it is, real auth takes over and
 *      this function can never return true again.
 *   2. This is a development build, or somebody has deliberately set
 *      ADMIN_LOCAL_ACCESS=1 to demonstrate a production build on a laptop.
 *   3. …that is it, and that is the point: there is nothing here to guess.
 *
 * Why it exists: the leads desk, the follow-up queue and the availability
 * calendar cannot be built or shown to anybody if the only way in is a database
 * that has not been set up yet. Without Supabase there are no real customers in
 * this admin — it is reading a JSON file — so the thing being protected is a
 * demonstration.
 *
 * Deploying publicly without Supabase would leave this open, which is why the
 * production case demands an explicit variable rather than defaulting on.
 */
export function localAdminAllowed(): boolean {
  if (isSupabaseConfigured()) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ADMIN_LOCAL_ACCESS === "1";
}

/** The stand-in session a local admin runs as. Never a real person. */
const LOCAL_SESSION: AdminSession = {
  userId: "local",
  email: "local admin (no database)",
  fullName: "Local admin",
};

export async function requireAdmin(): Promise<AdminSession> {
  if (localAdminAllowed()) return LOCAL_SESSION;
  if (!isSupabaseConfigured()) redirect("/admin/setup");

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/admin/login");

  const { data: staff } = await supabase
    .from("staff")
    .select("user_id, email, full_name, is_admin")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!staff?.is_admin) redirect("/admin/login?denied=1");

  return {
    userId: auth.user.id,
    email: staff.email ?? auth.user.email ?? null,
    fullName: staff.full_name ?? null,
  };
}

/** For the login page: send an already-signed-in admin straight through. */
export async function currentAdmin(): Promise<AdminSession | null> {
  if (localAdminAllowed()) return LOCAL_SESSION;
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("user_id, email, full_name, is_admin")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!staff?.is_admin) return null;

  return {
    userId: auth.user.id,
    email: staff.email ?? auth.user.email ?? null,
    fullName: staff.full_name ?? null,
  };
}
