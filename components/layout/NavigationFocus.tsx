"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { focusPageTarget } from "@/lib/navigation-focus";

/** Only explicit fragment links change focus; normal Back/scroll restoration stays native. */
export function NavigationFocus() {
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    let observer: MutationObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const focusHash = () => {
      observer?.disconnect();
      clearTimeout(timeout);
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!id) return;
      if (focusPageTarget(id)) return;
      // A streamed destination may not have mounted when the route changes.
      observer = new MutationObserver(() => { if (focusPageTarget(id)) observer?.disconnect(); });
      observer.observe(document.getElementById("main") ?? document.body, {
        childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "inert"],
      });
      timeout = setTimeout(() => observer?.disconnect(), 1500);
    };
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash) {
        // The native/Next link updates the fragment before this task runs.
        clearTimeout(timeout);
        timeout = setTimeout(focusHash, 0);
      }
    };
    focusHash();
    window.addEventListener("hashchange", focusHash);
    document.addEventListener("click", click);
    return () => {
      observer?.disconnect();
      clearTimeout(timeout);
      window.removeEventListener("hashchange", focusHash);
      document.removeEventListener("click", click);
    };
  }, [pathname, params]);
  return null;
}
