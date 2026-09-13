"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { styles } from "./styles";

export default function AdminError({ retry }: { retry: () => void }) {
  return <div className={styles.loginPage}>
    <section className={styles.loginCard}>
      <span className={styles.emptyIcon}><Icon name="ph-arrow-clockwise" size={25} /></span>
      <p className={styles.eyebrow}>Workspace unavailable</p>
      <h1 className={styles.loginTitle}>Let's try that again.</h1>
      <p className={styles.loginLede}>This part of the workspace could not load. Try again to reconnect and continue.</p>
      <div className={styles.actions}><button type="button" className="btn btn-primary" onClick={retry}>Try again</button><Link href="/admin" className="btn btn-secondary">Back to overview</Link></div>
    </section>
  </div>;
}
