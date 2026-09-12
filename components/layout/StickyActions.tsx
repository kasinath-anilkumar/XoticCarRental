"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/Icon";
import { GENERAL_ENQUIRY_MESSAGE, whatsappLink } from "@/lib/whatsapp";
import type { SiteSettings } from "@/lib/types";

/**
 * The persistent CTAs (§22, §23).
 *
 * On a phone this is the three actions the brief names — Call, WhatsApp, Get
 * Quote — pinned to the bottom, because most of this traffic arrives from
 * Instagram and WhatsApp on a phone held in one hand. On a wider screen the bar
 * would be noise, so only the floating WhatsApp button survives.
 *
 * It hides itself in the admin, where a customer CTA is worse than useless, and
 * on the calculator, where its own actions are already the point of the page.
 */
export function StickyActions({ settings }: { settings: SiteSettings }) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin") || pathname.startsWith("/price-calculator")) return null;

  const wa = whatsappLink(settings.whatsappNumber, GENERAL_ENQUIRY_MESSAGE);
  const tel = `tel:${settings.phoneDisplay.replace(/[^\d+]/g, "")}`;

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
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-[var(--color-divider)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] md:hidden [body:has(.stickybar)_&]:hidden"
        style={{ boxShadow: "0 -6px 20px rgb(0 0 0 / 0.08)" }}
      >
        <a
          href={tel}
          className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] text-[var(--color-text)] no-underline"
        >
          <Icon name="ph-phone-call" size={19} />
          Call
        </a>
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 border-x border-[var(--color-divider)] text-[11px] text-[var(--color-text)] no-underline"
        >
          <Icon name="ph-whatsapp-logo" size={19} color="#25d366" />
          WhatsApp
        </a>
        <Link
          href="/price-calculator"
          className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 bg-[var(--color-accent-solid)] text-[11px] text-[var(--color-accent-ink)] no-underline"
        >
          <Icon name="ph-calculator" size={19} />
          Get quote
        </Link>
      </nav>

      {/* Desktop: one button, out of the way of the content. */}
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Message Xotic on WhatsApp"
        className="fixed right-6 bottom-6 z-40 hidden size-14 items-center justify-center rounded-full bg-[#25d366] text-white no-underline transition-transform hover:scale-105 md:flex"
        style={{ boxShadow: "0 10px 30px rgb(37 211 102 / 0.35)" }}
      >
        <Icon name="ph-whatsapp-logo" size={28} />
      </a>
    </>
  );
}
