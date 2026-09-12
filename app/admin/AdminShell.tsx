import Link from "next/link";

import { AdminNav } from "./AdminNav";
import { SignOutButton } from "./SignOutButton";
import { styles } from "./styles";

export function AdminShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email: string | null;
}) {
  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar} aria-label="Admin">
        <Link href="/admin" className={styles.brand}>
          XOTIC
        </Link>
        <span className={styles.brandSub}>Admin</span>
        <AdminNav />
        <div className={styles.sidebarFoot}>
          <p style={{ margin: "0 0 8.4px" }}>{email}</p>
          <SignOutButton />
          <p style={{ margin: "11.2px 0 0" }}>
            <Link href="/" style={{ color: "inherit" }}>
              View the site
            </Link>
          </p>
        </div>
      </nav>
      <div className={styles.main}>{children}</div>
    </div>
  );
}

export function AdminPageHead({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={styles.pageHead}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {lede && <p className={styles.pageLede}>{lede}</p>}
      </div>
      {children}
    </header>
  );
}
