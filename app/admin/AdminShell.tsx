import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

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
      <a href="#admin-content" className={styles.skipLink}>Skip to workspace</a>
      <aside className={styles.sidebar}>
        <Link href="/admin" className={styles.brand}>
          <span className={styles.brandMark}><Icon name="ph-car-profile" size={22} /></span>
          <span><span className={styles.brandName}>XOTIC</span><span className={styles.brandSub}>Rental operations</span></span>
        </Link>
        <AdminNav />
        <div className={styles.sidebarFoot}>
          <Link href="/" target="_blank" rel="noreferrer"><Icon name="ph-arrow-up-right" size={16} /> View the website</Link>
          <p>A considered journey starts here.</p>
        </div>
      </aside>
      <div className={styles.workspace}>
        <div className={styles.workspaceBar}>
          <p className={styles.workspaceLabel}><strong>Operations</strong> / Workspace</p>
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">{email?.slice(0, 1).toUpperCase() || "X"}</span>
            <span className={styles.accountEmail}>{email || "Staff workspace"}</span>
            {email !== "local admin (no database)" && <SignOutButton />}
          </div>
        </div>
        <div id="admin-content" tabIndex={-1} className={styles.main}>{children}</div>
      </div>
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
        <p className={styles.eyebrow}>Xotic management</p>
        <h1 className={styles.pageTitle}>{title}</h1>
        {lede && <p className={styles.pageLede}>{lede}</p>}
      </div>
      {children}
    </header>
  );
}
