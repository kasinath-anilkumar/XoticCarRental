"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { useModalDialog } from "@/components/ui/useModalDialog";

import { NAV_LINKS } from "./nav-links";

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
          className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0"
        >
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-pointer border-0 bg-[var(--color-scrim)] p-0"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            tabIndex={-1}
            aria-hidden="true"
          />
          <nav
            className="fixed inset-y-0 right-0 left-auto z-41 flex h-dvh w-[min(300px,84vw)] flex-col gap-3 overflow-y-auto bg-surface px-[var(--gutter-mobile)] py-6 shadow-[var(--shadow-lg)]"
            aria-label="Mobile"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] tracking-[0.14em] uppercase text-[var(--color-neutral-500)]">
                Menu
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
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block border-b border-[var(--color-divider)] py-4 font-[family-name:var(--font-heading)] text-[17px] text-text no-underline hover:text-[var(--color-accent-300)]"
                // Closed from the click itself rather than an effect watching
                // the path: the drawer must not survive the navigation.
                onClick={() => setOpen(false)}
                aria-current={pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`)) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </dialog>
      )}
    </>
  );
}
