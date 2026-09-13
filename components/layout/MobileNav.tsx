"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { useModalDialog } from "@/components/ui/useModalDialog";

import { NAV_LINKS } from "./nav-links";
import styles from "./MobileNav.module.css";

/**
 * The drawer behind the mobile header's hamburger. The prototype draws the
 * trigger but has nowhere to go — the real site needs the five nav
 * destinations reachable on a phone.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement | null>(null);
  const menuId = useId();
  useModalDialog(dialog, open);

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const onResize = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener("change", onResize);
    return () => {
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="hidden cursor-pointer border-0 bg-transparent p-[4px] text-[var(--color-neutral-300)] max-md:inline-flex max-md:size-[44px] max-md:items-center max-md:justify-center"
        onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setOpen(true); }}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-haspopup="dialog"
      >
        <Icon name="ph-list" size={22} />
      </button>

      {open && (
        <dialog
          ref={dialog}
          id={menuId}
          aria-label="Navigation menu"
          onCancel={(event) => { event.preventDefault(); setOpen(false); }}
          className={styles.dialog}
        >
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-pointer border-0 bg-[var(--color-scrim)] p-0"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            tabIndex={-1}
            aria-hidden="true"
          />
          {/* Focus lets keyboard users scroll the drawer without activating a destination. */}
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <nav className={`scroll-shadows ${styles.panel}`} aria-label="Mobile" tabIndex={0}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] tracking-[0.14em] uppercase text-[var(--color-neutral-500)]">
                Xotic / Explore
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <Icon name="ph-x" size={20} />
              </button>
            </div>
            {NAV_LINKS.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                className={styles.link}
                // Closed from the click itself rather than an effect watching
                // the path: the drawer must not survive the navigation.
                onClick={() => setOpen(false)}
                aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "page" : undefined}
              >
                <span className={styles.number}>0{index + 1}</span>{link.label}<Icon name="ph-arrow-up-right" size={20} />
              </Link>
            ))}
            <div className={styles.bottom}>
              <p>Your next journey starts here.</p>
              <Link href="/price-calculator" className="btn btn-solid" onClick={() => setOpen(false)}>Plan your journey <Icon name="ph-arrow-right" size={18} /></Link>
              <Link href="/contact" onClick={() => setOpen(false)}>Contact the team</Link>
            </div>
          </nav>
        </dialog>
      )}
    </>
  );
}
