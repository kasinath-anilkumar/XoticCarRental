import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Analytics } from "@/components/analytics/Analytics";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { StickyActions } from "@/components/layout/StickyActions";
import { ScrollFlag } from "@/components/layout/ScrollFlag";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LocalBusinessJsonLd } from "@/components/seo/JsonLd";
import { WhatsAppBanner } from "@/components/layout/WhatsAppBanner";
import { getCatalog } from "@/lib/content";
import { getServicePage } from "@/lib/service-content";

import "./globals.css";

// The Nocturne system specifies Inter for both heading and body; globals.css
// maps --font-heading / --font-body onto this.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://xoticcarrental.com"),
  title: {
    default: "Xotic Car Rental — Luxury Car Rental with Driver Across India",
    template: "%s · Xotic Car Rental",
  },
  description:
    "Chauffeur-driven luxury car rental across our published locations in India. Weddings, VIP airport transfers, corporate delegations, celebrity shoots and inter-state touring — transparent package rates and itemised quotes before you book.",
  openGraph: {
    type: "website",
    siteName: "Xotic Car Rental",
    locale: "en_IN",
    images: [
      {
        url: "/brand/xotic_hero.png",
        width: 1664,
        height: 941,
        alt: "Decorated wedding cars waiting outside a resort at sunset",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
  // §24 — Search Console, when the property has been verified. Set
  // NEXT_PUBLIC_GSC_VERIFICATION to the token Google gives you.
  ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  // Must be a literal: Next serialises this into <meta name="theme-color">
  // at build time, where a CSS custom property cannot resolve. Keep in step
  // with --color-bg in app/globals.css.
  themeColor: "#ffffff",
  colorScheme: "light",
};

// RootLayout: Configures global fonts, metadata, and suppresses browser extension attribute warnings.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [catalog, services] = await Promise.all([getCatalog(), getServicePage(1, 5)]);

  return (
    <html lang="en-IN" className={inter.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <a className="skip-link" href="#main">Skip to content</a>
        <ScrollFlag />
        <LocalBusinessJsonLd settings={catalog.settings} cities={catalog.cities} />
        <SiteHeader settings={catalog.settings} />
        <main id="main" tabIndex={-1}>{children}</main>
        <WhatsAppBanner settings={catalog.settings} />
        <SiteFooter settings={catalog.settings} cities={catalog.cities} carTypes={catalog.carTypes} services={services.data} />
        <StickyActions settings={catalog.settings} />
        <Analytics />
      </body>
    </html>
  );
}
