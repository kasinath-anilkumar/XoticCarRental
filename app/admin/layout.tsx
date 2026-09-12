import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Admin screens read and write live data; never serve them from a cache.
export const dynamic = "force-dynamic";

/**
 * The admin route group's layout is intentionally empty.
 *
 * The login and setup pages live under /admin too and must render without a
 * session, so the gate cannot sit here. Each real admin page calls
 * requireAdmin() and wraps itself in <AdminShell>; RLS enforces the same rule
 * in the database regardless of what the UI does.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
