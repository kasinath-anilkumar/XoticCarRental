"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/Icon";

import { styles } from "./styles";

const LINKS = [
  { href: "/admin", label: "Overview", icon: "ph-receipt", exact: true },
  { href: "/admin/enquiries", label: "Leads", icon: "ph-chat-teardrop-text" },
  { href: "/admin/fleet", label: "Fleet", icon: "ph-car-profile" },
  { href: "/admin/availability", label: "Availability", icon: "ph-calendar-blank" },
  { href: "/admin/garages", label: "Garages", icon: "ph-map-pin-line" },
  { href: "/admin/packages", label: "Packages", icon: "ph-package" },
  { href: "/admin/seasons", label: "Seasons", icon: "ph-calendar-blank" },
  { href: "/admin/cities", label: "Cities", icon: "ph-city" },
  { href: "/admin/locations", label: "Locations", icon: "ph-map-pin" },
  { href: "/admin/routes", label: "Route fares", icon: "ph-road-horizon" },
  { href: "/admin/occasions", label: "Occasions", icon: "ph-star-four" },
  { href: "/admin/settings", label: "Settings", icon: "ph-sliders-horizontal" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={active ? styles.navLinkActive : styles.navLink}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={link.icon} size={17} />
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
