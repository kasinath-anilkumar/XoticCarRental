/**
 * The primary navigation, shared by the desktop header and the mobile drawer.
 * Kept in its own module so the client-side drawer doesn't have to import from
 * a server component.
 */
export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/cars", label: "Browse cars" },
  { href: "/services", label: "Services" },
  { href: "/cities", label: "Cities" },
  { href: "/gallery", label: "Gallery" },
  { href: "/price-calculator", label: "Price calculator" },
] as const;
