import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { SiteSettings } from "@/lib/types";
import { MobileNav } from "./MobileNav";
import { NAV_LINKS } from "./nav-links";
import styles from "./SiteHeader.module.css";

export function SiteHeader({ settings }: { settings: SiteSettings }) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="Xotic Car Rental home">
        <span className={styles.brandMark}>XOTIC<span>.</span></span>
        <span className={styles.brandSub}>CAR RENTAL</span>
      </Link>
      <nav className={styles.links} aria-label="Primary">
        {NAV_LINKS.map((link) => <Link key={link.href} href={link.href} className="navlink">{link.label}</Link>)}
      </nav>
      <div className={styles.actions}>
        <a href={`tel:${settings.phoneDisplay.replace(/\s/g, "")}`} className={styles.phone} aria-label={`Call Xotic on ${settings.phoneDisplay}`}>
          <Icon name="ph-phone-call" size={19} /><span>Talk to us</span>
        </a>
        <Link href="/price-calculator" className={`btn btn-solid ${styles.quote}`}>Plan your journey <Icon name="ph-arrow-up-right" size={17} /></Link>
        <MobileNav />
      </div>
    </header>
  );
}
