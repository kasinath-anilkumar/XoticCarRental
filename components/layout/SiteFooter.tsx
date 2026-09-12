import Link from "next/link";

import type { SiteSettings } from "@/lib/types";


const FLEET_LINKS = [
  { label: "Luxury sedans", href: "/cars?type=Luxury+sedan" },
  { label: "SUVs & MUVs", href: "/cars?type=SUV" },
  { label: "Vans & tempo", href: "/cars?type=Van+%2F+tempo" },
];

const SERVICE_LINKS = [
  { label: "Weddings", href: "/services/wedding" },
  { label: "VIP transfers", href: "/services/vip-transfers" },
  { label: "Corporate travel", href: "/services/corporate" },
  { label: "Outstation", href: "/services/outstation" },
  { label: "Monthly chauffeur", href: "/services/monthly-chauffeur" },
];

const COMPANY_LINKS = [
  { label: "About Xotic", href: "/about" },
  { label: "Packages", href: "/packages" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
  { label: "Price calculator", href: "/price-calculator" },
];

const CITY_LINKS = [
  { label: "Kochi", href: "/cities/kochi" },
  { label: "Thiruvananthapuram", href: "/cities/trivandrum" },
  { label: "Bengaluru", href: "/cities/bangalore" },
  { label: "Chennai", href: "/cities/chennai" },
  { label: "Coimbatore", href: "/cities/coimbatore" },
];

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="on-dark flex flex-wrap gap-[44.8px] border-t border-[var(--color-divider)] bg-bg px-[var(--gutter-desktop)] py-12 text-[12px] text-[var(--color-neutral-500)] max-lg:gap-12 max-md:grid max-md:grid-cols-2 max-md:gap-8 max-md:px-[var(--gutter-mobile)] max-md:py-[28px]">
      <div className="min-w-[200px] flex-1 max-md:col-span-full">
        <p className="m-0 font-[family-name:var(--font-heading)] text-[17px] font-semibold tracking-[0.16em] text-text">
          XOTIC
        </p>
        <p className="mt-2 mb-0 max-w-[320px]">
          Chauffeur-driven luxury cars across Kerala, Karnataka and Tamil Nadu. Weddings, shoots,
          corporate travel and long tours.
        </p>
      </div>

      <FooterColumn title="Fleet" links={FLEET_LINKS} />
      <FooterColumn title="Services" links={SERVICE_LINKS} />
      <FooterColumn title="Cities" links={CITY_LINKS} />
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
        <Link key={link.href} href={link.href} className="text-inherit no-underline hover:text-[var(--color-accent-300)]">
          {link.label}
        </Link>
      ))}
    </div>
  );
}
