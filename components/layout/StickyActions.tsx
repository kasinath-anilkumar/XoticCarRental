"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/Icon";
import { GENERAL_ENQUIRY_MESSAGE, whatsappLink } from "@/lib/whatsapp";
import type { SiteSettings } from "@/lib/types";
import styles from "./StickyActions.module.css";

/** Mobile contact shortcuts and a primary action relevant to the current page. */
export function StickyActions({ settings }: { settings: SiteSettings }) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin") || pathname.startsWith("/price-calculator")) return null;

  const wa = whatsappLink(settings.whatsappNumber, GENERAL_ENQUIRY_MESSAGE);
  const tel = `tel:${settings.phoneDisplay.replace(/[^\d+]/g, "")}`;
  const primary = pathname === "/"
    ? { href: "#journey-search", label: "Find a car", icon: "ph-magnifying-glass" }
    : pathname === "/cars"
      ? { href: "#fleet-results", label: "View cars", icon: "ph-car" }
      : pathname === "/contact"
        ? { href: "#contact-enquiry", label: "Send an enquiry", icon: "ph-chat-circle" }
        : { href: "/price-calculator#calc-route", label: "Plan my trip", icon: "ph-calculator" };

  return (
    <>
      {/*
        Phone: the three actions, thumb-height, above the home indicator.

        It stands down where the page already has a bottom bar of its own. The
        booking summary, a vehicle page and the calculator each end in a sticky
        bar carrying the one action that page exists for — sending the quote,
        booking that car — and a generic Call/WhatsApp/Get-quote strip sitting
        on top of it at a higher z-index hides exactly the thing the visitor
        came to press. `:has()` asks the markup rather than matching a list of
        paths that would go stale the next time a page gains one.
      */}
      <nav
        aria-label="Quick actions"
        className={`${styles.bar} [body:has(.stickybar)_&]:hidden`}
      >
        <a
          href={tel}
          className={styles.secondary}
          aria-label="Call Xotic"
        >
          <Icon name="ph-phone-call" size={19} />
          <span>Call</span>
        </a>
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.secondary}
          aria-label="Chat on WhatsApp"
        >
          <Icon name="ph-whatsapp-logo" size={19} color="#246d39" />
          <span>Chat</span>
        </a>
        <Link
          href={primary.href}
          className={styles.primary}
        >
          <Icon name={primary.icon} size={18} />
          {primary.label}
        </Link>
      </nav>

      {/* Desktop: one button, out of the way of the content. */}
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Message Xotic on WhatsApp"
        className="fixed right-[24px] bottom-[24px] z-40 hidden size-[52px] items-center justify-center rounded-sm border border-[#43563f] bg-[#223521] text-[#fff] no-underline motion-safe:transition-transform motion-safe:hover:scale-105 md:flex"
        style={{ boxShadow: "0 8px 24px rgb(24 40 22 / 0.18)" }}
      >
        <Icon name="ph-whatsapp-logo" size={28} />
      </a>
    </>
  );
}
