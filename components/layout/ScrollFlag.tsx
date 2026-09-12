"use client";

import { useEffect } from "react";

/**
 * Tells the page whether it has been scrolled, as `data-scrolled` on <html>.
 *
 * The header reads it to decide between transparent and frosted. Everything
 * else about that transition is CSS.
 *
 * No scroll listener. A one-pixel sentinel sits at the very top of the document
 * and an IntersectionObserver reports when it leaves the viewport — the browser
 * does the work off the main thread and calls back twice per page visit rather
 * than sixty times a second. A scroll handler here would be the one thing
 * guaranteed to make a frosted header feel slow.
 *
 * The sentinel is absolutely positioned and zero-width in flow, so it changes
 * no layout.
 */
export function ScrollFlag() {
  useEffect(() => {
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none";
    document.body.prepend(sentinel);

    const root = document.documentElement;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) delete root.dataset.scrolled;
        else root.dataset.scrolled = "";
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
      delete root.dataset.scrolled;
    };
  }, []);

  return null;
}
