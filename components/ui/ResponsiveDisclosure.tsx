"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./ResponsiveDisclosure.module.css";

/** Supporting information stays in desktop flow and opens on demand on phones. */
export function ResponsiveDisclosure({ title, id, children, defaultOpen = false, className = "", contentClassName = "", hideTitleOnDesktop = false, headingLevel = 2 }: {
  title: string;
  id?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  hideTitleOnDesktop?: boolean;
  headingLevel?: 2 | 3;
}) {
  const generatedId = useId();
  const contentId = `${id ?? generatedId}-content`;
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [previousDefaultOpen, setPreviousDefaultOpen] = useState(defaultOpen);
  const Heading = headingLevel === 3 ? "h3" : "h2";
  // Reveal newly supplied values without remounting the form or losing edits.
  if (defaultOpen !== previousDefaultOpen) {
    setPreviousDefaultOpen(defaultOpen);
    if (defaultOpen) setOpen(true);
  }

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const reveal = () => setOpen(true);
    let initialFrame: number | undefined;
    // Initial fragment navigation can run before this component's effect.
    try {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (target && node.contains(target)) initialFrame = requestAnimationFrame(reveal);
    } catch { /* A malformed fragment has no disclosure target. */ }
    node.addEventListener("xotic:reveal-target", reveal);
    return () => {
      if (initialFrame !== undefined) cancelAnimationFrame(initialFrame);
      node.removeEventListener("xotic:reveal-target", reveal);
    };
  }, []);

  return <section id={id} ref={root} tabIndex={id ? -1 : undefined} className={`${styles.root} ${className}`} data-responsive-disclosure data-open={open}>
    <Heading className={`${styles.heading} ${hideTitleOnDesktop ? styles.mobileHeading : ""}`}>
      <span className={styles.desktopTitle}>{title}</span>
      <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((current) => !current)}>
        <span>{title}</span><Icon name="ph-caret-down" size={18} />
      </button>
    </Heading>
    <div id={contentId} className={`${styles.content} ${contentClassName}`}>{children}</div>
  </section>;
}
