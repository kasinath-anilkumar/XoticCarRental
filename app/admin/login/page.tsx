import { redirect } from "next/navigation";

import { currentAdmin } from "@/lib/admin/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

import { styles } from "../styles";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminLoginPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isSupabaseConfigured()) redirect("/admin/setup");

  const admin = await currentAdmin();
  if (admin) redirect("/admin");

  const params = await searchParams;
  const denied = "denied" in params;

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <h1 className={styles.loginTitle}>Xotic admin</h1>
        <p className={styles.loginLede}>Staff only. Fleet, rates, content and enquiries.</p>

        {denied && (
          <p className={styles.messageError}>
            That account is signed in, but it is not marked as staff. Ask an existing admin to add
            you to the staff table.
          </p>
        )}

        <LoginForm />
      </div>
    </div>
  );
}
