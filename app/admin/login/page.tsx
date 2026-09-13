import { redirect } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

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
      <div className={styles.loginComposition}>
      <section className={styles.loginIntro}>
        <Link href="/" className={styles.brand}><span className={styles.brandMark}><Icon name="ph-car-profile" size={22} /></span><span><span className={styles.brandName}>XOTIC</span><span className={styles.brandSub}>Rental operations</span></span></Link>
        <div><h2>Exceptional journeys.<br />Thoughtful operations.</h2><p>One place for your fleet, your service areas and every customer conversation.</p></div>
        <small>The workspace behind the journey</small>
      </section>
      <div className={styles.loginCard}>
        <p className={styles.eyebrow}>Staff workspace</p>
        <h1 className={styles.loginTitle}>Welcome back.</h1>
        <p className={styles.loginLede}>Sign in to manage your fleet and enquiries.</p>

        {denied && (
          <p className={styles.messageError}>
            That account is signed in, but it is not marked as staff. Ask an existing admin to add
            you to the staff table.
          </p>
        )}

        <LoginForm />
        <Link href="/" className={styles.loginBack}>Return to the website</Link>
      </div>
      </div>
    </div>
  );
}
