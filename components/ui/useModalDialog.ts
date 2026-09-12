"use client";

import { useLayoutEffect, type RefObject } from "react";

/** Native modality plus predictable Tab cycling and focus restoration. */
export function useModalDialog(ref: RefObject<HTMLDialogElement | null>, open = true) {
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]',
    )).filter((element) => element.tabIndex >= 0
      && !element.matches(':disabled, [aria-hidden="true"]')
      && element.getClientRects().length > 0);

    dialog.showModal();
    document.body.style.overflow = "hidden";
    focusable()[0]?.focus({ preventScroll: true });

    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", trapTab);
    return () => {
      dialog.removeEventListener("keydown", trapTab);
      // Layout cleanup runs while the dialog still exists, so closing it can
      // restore focus before React removes the node from the document.
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [ref, open]);
}
