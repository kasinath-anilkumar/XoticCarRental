"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./HorizontalScroll.module.css";

interface HorizontalScrollProps {
  label: string;
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
  controls?: "inline" | "above";
}

/** Native touch/trackpad scrolling with visible, keyboard-accessible controls. */
export function HorizontalScroll({ label, children, className = "", viewportClassName = "", contentClassName = "", controls = "inline" }: HorizontalScrollProps) {
  const id = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ overflow: false, previous: false, next: false });

  useEffect(() => {
    const frame = frameRef.current;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!frame || !viewport || !content) return;
    let raf = 0;
    let disposed = false;
    const measure = () => {
      raf = 0;
      // Compare with the space available without side controls. Otherwise the
      // arrows themselves could keep an otherwise-fitting row overflowing.
      const available = controls === "inline" ? frame.clientWidth : viewport.clientWidth;
      const overflow = content.scrollWidth > available + 2;
      const maximum = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const previous = overflow && viewport.scrollLeft > 2;
      const next = overflow && viewport.scrollLeft < maximum - 2;
      setEdges((current) => current.overflow === overflow && current.previous === previous && current.next === next
        ? current : { overflow, previous, next });
    };
    const schedule = () => { if (!disposed && !raf) raf = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule);
    resize.observe(frame);
    resize.observe(viewport);
    resize.observe(content);
    const mutations = new MutationObserver(schedule);
    mutations.observe(content, { childList: true, subtree: true, characterData: true, attributes: true });
    viewport.addEventListener("scroll", schedule, { passive: true });
    content.addEventListener("load", schedule, true);
    void document.fonts.ready.then(schedule);
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resize.disconnect();
      mutations.disconnect();
      viewport.removeEventListener("scroll", schedule);
      content.removeEventListener("load", schedule, true);
    };
  }, [controls]);

  function move(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({ left: direction * Math.max(120, viewport.clientWidth * 0.8),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    // Nested tabs, inputs and links retain their own keyboard behavior.
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !edges.overflow) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      event.currentTarget.scrollTo({ left: event.key === "Home" ? 0 : event.currentTarget.scrollWidth, behavior: "instant" });
    }
  }

  const previous = <button type="button" className={styles.arrow} aria-label={`Previous ${label}`} aria-controls={id}
    disabled={!edges.previous} hidden={!edges.overflow} onClick={() => move(-1)}><Icon name="ph-caret-left" size={19} weight="bold" /></button>;
  const next = <button type="button" className={styles.arrow} aria-label={`Next ${label}`} aria-controls={id}
    disabled={!edges.next} hidden={!edges.overflow} onClick={() => move(1)}><Icon name="ph-caret-right" size={19} weight="bold" /></button>;

  return <div className={`${styles.root} ${className}`} data-horizontal-scroll={label} data-overflow={edges.overflow}>
    {controls === "above" && <div className={styles.toolbar} hidden={!edges.overflow}>
      <span className={styles.hint}>More columns</span>{previous}{next}
    </div>}
    <div ref={frameRef} className={`${styles.frame} ${controls === "inline" ? styles.inline : ""}`}>
      {controls === "inline" && previous}
      {/* A named scroll region needs focus and arrow keys without pretending to be a button. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <section ref={viewportRef} id={id} className={`${styles.viewport} ${viewportClassName}`} aria-label={label} data-scroll-viewport tabIndex={edges.overflow ? 0 : -1} onKeyDown={onKeyDown}>
        <div ref={contentRef} className={`${styles.content} ${contentClassName}`}>{children}</div>
      </section>
      {controls === "inline" && next}
    </div>
  </div>;
}
