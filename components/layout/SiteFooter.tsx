import Link from "next/link";

import type { City, SiteSettings } from "@/lib/types";
import styles from "./SiteFooter.module.css";
import { ResponsiveDisclosure } from "@/components/ui/ResponsiveDisclosure";




const COMPANY_LINKS = [
  { label: "About Xotic", href: "/about" },
  { label: "Packages", href: "/packages" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
  { label: "Price calculator", href: "/price-calculator" },
];



export function SiteFooter({ settings, cities, carTypes, services }: { settings: SiteSettings; cities: City[]; carTypes: string[]; services: Array<{slug:string;short:string}> }) {
  const fleetLinks = carTypes.slice(0, 5).map((name) => ({ label: name, href: `/cars?type=${encodeURIComponent(name)}` }));
  const serviceLinks = services.slice(0, 5).map((service) => ({ label: service.short, href: `/services/${service.slug}` }));
  const cityLinks = cities.slice(0, 5).map((city) => ({ label: city.name, href: `/cities/${city.slug}` }));
  return (
    <footer className={styles.footer}>
      <div className={styles.intro}>
        <Link href="/" className={styles.wordmark}>XOTIC<span>.</span></Link>
        <p>For the journey.<br />For the arrival.<br /><span>For everything you have planned.</span></p>
      </div>
      <div className={styles.columns}>
      <FooterColumn title="Fleet" links={fleetLinks} />
      <FooterColumn title="Services" links={serviceLinks} />
      <FooterColumn title="Cities" links={cityLinks} />
      <FooterColumn title="Company" links={COMPANY_LINKS} />

      <div className={styles.column}>
        <span>Contact</span>
        <a href={`tel:${settings.phoneDisplay.replace(/\s/g, "")}`} className="text-inherit no-underline hover:text-[var(--color-accent-300)]">
          {settings.phoneDisplay}
        </a>
        <a href={`mailto:${settings.email}`} className="text-inherit no-underline hover:text-[var(--color-accent-300)]">
          {settings.email}
        </a>
      </div>
      </div>
      <div className={styles.bottom}>
        <span>Chauffeur-driven journeys across {cities.length} service cities.</span>
        <span>Xotic Car Rental · India</span>
        <a href="#main">Back to top ↑</a>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <ResponsiveDisclosure title={title} headingLevel={3} className={styles.group} contentClassName={styles.column}>
      {links.map((link) => (
        <Link key={link.href} href={link.href} prefetch={false} className="text-inherit no-underline hover:text-[var(--color-accent-300)]">
          {link.label}
        </Link>
      ))}
    </ResponsiveDisclosure>
  );
}
