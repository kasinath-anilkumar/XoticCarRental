"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/Icon";

import { styles } from "./styles";

const GROUPS = [
  { label: "Fleet", links: [
    { href: "/admin/fleet", label: "Vehicles", icon: "ph-car-profile" },
    { href: "/admin/garages", label: "Garages", icon: "ph-map-pin-line" },
  ] },
  { label: "Operations", links: [
    { href: "/admin/enquiries", label: "Enquiries", icon: "ph-chat-teardrop-text" },
    { href: "/admin/availability", label: "Availability", icon: "ph-calendar-blank" },
    { href: "/admin/routes", label: "Route distances", icon: "ph-road-horizon" },
  ] },
  { label: "Content", links: [
    { href: "/admin/cities", label: "Service cities", icon: "ph-city" },
    { href: "/admin/locations", label: "Pickup points", icon: "ph-map-pin" },
    { href: "/admin/services", label: "Services", icon: "ph-star-four" },
    { href: "/admin/occasions", label: "Occasions", icon: "ph-star-four" },
  ] },
  { label: "Settings", links: [
    { href: "/admin/packages", label: "Rate packages", icon: "ph-package" },
    { href: "/admin/seasons", label: "Seasonal pricing", icon: "ph-calendar-blank" },
    { href: "/admin/settings", label: "Business settings", icon: "ph-sliders-horizontal" },
  ] },
];

export function AdminNav() {
  const pathname = usePathname();

  function groups() {
    return GROUPS.map((group) => <div className={styles.navGroup} key={group.label}>
      <p className={styles.navHeading}>{group.label}</p>
      {group.links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return <Link key={link.href} href={link.href} prefetch={false} className={active ? styles.navLinkActive : styles.navLink} aria-current={active ? "page" : undefined}>
          <Icon name={link.icon} size={17} />{link.label}
        </Link>;
      })}
    </div>);
  }
  const overview = <Link href="/admin" prefetch={false} className={pathname === "/admin" ? styles.navLinkActive : styles.navLink} aria-current={pathname === "/admin" ? "page" : undefined}><Icon name="ph-receipt" size={17} />Overview</Link>;
  return <nav className={styles.navigation} aria-label="Admin">
    <div className={styles.desktopNavigation}>{overview}{groups()}</div>
    <details key={pathname} className={styles.mobileMenu}>
      <summary>Workspace navigation</summary>
      {overview}
      <div className={styles.mobileGroups}>{groups()}</div>
    </details>
  </nav>;
}
