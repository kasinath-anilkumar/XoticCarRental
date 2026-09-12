import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { GENERAL_ENQUIRY_MESSAGE, whatsappLink } from "@/lib/whatsapp";
import type { SiteSettings } from "@/lib/types";

import { MobileNav } from "./MobileNav";
import { NAV_LINKS } from "./nav-links";
import styles from "./SiteHeader.module.css";

export function SiteHeader({ settings }: { settings: SiteSettings }) {
  const waHref = whatsappLink(settings.whatsappNumber, GENERAL_ENQUIRY_MESSAGE);
  const telHref = `tel:${settings.phoneDisplay.replace(/\s/g, "")}`;

  return (
    <header className={`on-dark ${styles.header}`}>
      <Link href="/" className={styles.brand}>
        <Icon name="ph-steering-wheel" size={26} color="var(--color-accent)" />
        <span>
          <span className={styles.brandMark}>XOTIC</span>
          <span className={styles.brandSub} style={{ display: "block" }}>
            CAR RENTAL
          </span>
        </span>
      </Link>

      <nav className={styles.links} aria-label="Primary">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="navlink">
            {link.label}
          </Link>
        ))}
      </nav>

      <span className={styles.divider} aria-hidden />

      <a href={telHref} className={`${styles.phone} ${styles.desktopOnly}`}>
        <Icon name="ph-phone-call" size={16} />
        <span>{settings.phoneDisplay}</span>
      </a>

      {/* Mobile: the phone number becomes an icon button. */}
      <a
        href={telHref}
        className={`btn btn-secondary ${styles.iconButton} ${styles.mobileOnly}`}
        aria-label={`Call ${settings.phoneDisplay}`}
      >
        <Icon name="ph-phone-call" size={16} />
      </a>

      <a
        className={`btn wa ${styles.desktopOnly}`}
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon name="ph-whatsapp-logo" size={17} />
        Book on WhatsApp
      </a>

      <a
        className={`btn wa ${styles.iconButton} ${styles.mobileOnly}`}
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Book on WhatsApp"
      >
        <Icon name="ph-whatsapp-logo" size={17} />
      </a>

      <MobileNav />
    </header>
  );
}
