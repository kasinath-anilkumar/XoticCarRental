import Link from "next/link";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/server";

import { styles } from "../styles";

export const dynamic = "force-dynamic";

/**
 * Shown when the app has no Supabase credentials. The public site still works
 * — it falls back to backend/seed-data.js — but nothing is editable and no
 * enquiry is recorded, so this page says exactly what is missing.
 */
export default function AdminSetupPage() {
  if (isSupabaseConfigured()) redirect("/admin");

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard} style={{ width: "min(680px, 100%)" }}>
        <h1 className={styles.loginTitle}>Connect Supabase to use the admin</h1>
        <p className={styles.loginLede}>
          The site is currently rendering from <code>backend/seed-data.js</code>. Everything a
          visitor sees works, but nothing is editable and enquiries are not being recorded.
        </p>

        <ol style={{ fontSize: "14px", lineHeight: 1.7, paddingLeft: "1.2em" }}>
          <li>
            Create a project at <strong>supabase.com</strong>.
          </li>
          <li>
            Copy <code>.env.local.example</code> to <code>.env.local</code> and fill in the project
            URL, the anon key and the service-role key.
          </li>
          <li>
            Copy <code>backend/.env.local.example</code> to <code>backend/.env.local</code> and set{" "}
            <code>SUPABASE_DB_URL</code> to the <strong>Session pooler</strong> URI (port 5432).
          </li>
          <li>
            Run <code>npm run migrate</code> then <code>npm run seed</code>.
          </li>
          <li>
            Create your login under Authentication → Users, then insert a matching row:
            <pre
              style={{
                background: "var(--color-well)",
                padding: "11.2px",
                borderRadius: "var(--radius-md)",
                fontSize: "12px",
                overflowX: "auto",
                marginTop: "8.4px",
              }}
            >
              {`insert into public.staff (user_id, email, is_admin)
values ('<the-user-uuid>', '<your-email>', true);`}
            </pre>
          </li>
          <li>Restart the dev server so the new environment is picked up.</li>
        </ol>

        <p style={{ marginTop: "22.4px" }}>
          <Link href="/" className="btn btn-secondary">
            Back to the site
          </Link>
        </p>
      </div>
    </div>
  );
}
