import Link from "next/link";

import type { City, SiteSettings } from "@/lib/types";




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
    <footer className="on-dark flex flex-wrap gap-[44.8px] border-t border-[var(--color-divider)] bg-bg px-[var(--gutter-desktop)] py-12 text-[12px] text-[var(--color-neutral-500)] max-lg:gap-12 max-md:grid max-md:grid-cols-2 max-md:gap-8 max-md:px-[var(--gutter-mobile)] max-md:py-[28px]">
      <div className="min-w-[200px] flex-1 max-md:col-span-full">
        <p className="m-0 font-[family-name:var(--font-heading)] text-[17px] font-semibold tracking-[0.16em] text-text">
          XOTIC
        </p>
        <p className="mt-2 mb-0 max-w-[320px]">
          Chauffeur-driven luxury cars in {cities.length} published cities. Weddings, shoots,
          corporate travel and long tours.
        </p>
      </div>

      <FooterColumn title="Fleet" links={fleetLinks} />
      <FooterColumn title="Services" links={serviceLinks} />
      <FooterColumn title="Cities" links={cityLinks} />
      <FooterColumn title="Company" links={COMPANY_LINKS} />

      <div className="flex flex-col gap-[4px]">
        <span className="text-[var(--color-neutral-300)]">Contact</span>
        <a href={`tel:${settings.phoneDisplay.replace(/\s/g, "")}`} className="text-inherit no-underline hover:text-[var(--color-accent-300)]">
          {settings.phoneDisplay}
        </a>
        <a href={`mailto:${settings.email}`} className="text-inherit no-underline hover:text-[var(--color-accent-300)]">
          {settings.email}
        </a>
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
    <div className="flex flex-col gap-[4px]">
      <span className="text-[var(--color-neutral-300)]">{title}</span>
      {links.map((link) => (
        <Link key={link.href} href={link.href} prefetch={false} className="text-inherit no-underline hover:text-[var(--color-accent-300)]">
          {link.label}
        </Link>
      ))}
    </div>
  );
}
