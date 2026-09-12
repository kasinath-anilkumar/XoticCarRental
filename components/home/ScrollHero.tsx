"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { Icon } from "@/components/ui/Icon";
import { createHeroSequence } from "@/lib/hero-sequence";

import styles from "./ScrollHero.module.css";

/** Scroll selects a frame; nothing plays on a timer or captures the wheel. */
export function ScrollHero({ frames }: { frames: string[] }) {
  const section = useRef<HTMLElement>(null);
  const visual = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const outro = useRef<HTMLParagraphElement>(null);
  const progressBar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = section.current;
    const surface = canvas.current;
    const media = visual.current;
    if (!root || !surface || !media) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Short screens need a normally scrolling hero so every action stays reachable.
    const compactViewport = window.matchMedia("(max-height: 699px) and (max-width: 767px), (max-height: 499px)");
    const connection = (navigator as Navigator & {
      connection?: EventTarget & { saveData?: boolean };
    }).connection;
    let stop: (() => void) | undefined;

    const configure = () => {
      stop?.();
      stop = undefined;
      delete root.dataset.motion;
      delete root.dataset.frame;
      surface.style.opacity = "0";
      if (copy.current) { copy.current.style.opacity = "1"; copy.current.style.transform = "none"; }
      if (actions.current) actions.current.inert = false;
      if (outro.current) outro.current.style.opacity = "0";
      if (preference.matches || compactViewport.matches || connection?.saveData || frames.length < 2 || typeof createImageBitmap !== "function") return;

      let visible = true;
      let scheduled = 0;
      const player = createHeroSequence({
        canvas: surface,
        frames,
        onReady: () => {
          surface.style.opacity = "1";
          root.dataset.motion = "true";
          schedule();
        },
        onFrame: (index) => { root.dataset.frame = String(index); },
      });

      const update = () => {
        scheduled = 0;
        if (!visible || document.hidden || !root.dataset.motion) return;
        const rect = root.getBoundingClientRect();
        const stage = root.firstElementChild as HTMLElement;
        const distance = Math.max(1, root.offsetHeight - stage.offsetHeight);
        const progress = Math.min(1, Math.max(0, -rect.top / distance));
        const mobile = window.innerWidth < 768;
        player.seek(Math.round(progress * (frames.length - 1)));
        if (copy.current) {
          copy.current.style.opacity = mobile ? "1" : String(Math.max(0, 1 - progress * 2.6));
          copy.current.style.transform = mobile ? "none" : `translate3d(0, ${-progress * 48}px, 0)`;
        }
        if (actions.current) actions.current.inert = !mobile && progress > 0.28;
        if (outro.current) outro.current.style.opacity = mobile ? "0" : String(Math.min(1, Math.max(0, (progress - 0.55) * 4)));
        if (progressBar.current) progressBar.current.style.transform = `scaleX(${progress})`;
      };
      const schedule = () => {
        if (!scheduled && visible && !document.hidden) scheduled = requestAnimationFrame(update);
      };
      const resize = () => {
        const bounds = media.getBoundingClientRect();
        player.resize(bounds.width, bounds.height, window.innerWidth < 768);
        schedule();
      };
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) schedule();
      });
      observer.observe(root);
      const sizeObserver = new ResizeObserver(resize);
      sizeObserver.observe(media);
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", resize, { passive: true });
      document.addEventListener("visibilitychange", schedule);
      resize();

      stop = () => {
        cancelAnimationFrame(scheduled);
        observer.disconnect();
        sizeObserver.disconnect();
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", schedule);
        player.dispose();
      };
    };

    configure();
    preference.addEventListener("change", configure);
    compactViewport.addEventListener("change", configure);
    connection?.addEventListener("change", configure);
    return () => {
      stop?.();
      preference.removeEventListener("change", configure);
      compactViewport.removeEventListener("change", configure);
      connection?.removeEventListener("change", configure);
    };
  }, [frames]);

  return (
    <section ref={section} className={`on-dark ${styles.hero}`} aria-label="Chauffeur-driven luxury journeys" data-frame-count={frames.length}>
      <div className={styles.stage}>
        <div ref={visual} className={styles.visual}>
          <Image
            src={frames[0] ?? "/brand/xotic_hero.png"}
            alt="A vintage Ambassador, Toyota Fortuner and Mercedes-Benz prepared for an arrival outside a palm-lined resort"
            fill
            preload
            sizes="100vw"
            className={styles.poster}
          />
          <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
        </div>
        <div className={styles.shade} aria-hidden="true" />

        <div ref={copy} className={styles.copy}>
          <p className={styles.eyebrow}><span /> Chauffeur-driven · Across India</p>
          <h1 className={styles.heading}>Luxury cars.<br /><span>Extraordinary journeys.</span></h1>
          <p className={styles.description}>
            For the wedding, the welcome, the weekend away.
            Arrive in a car that makes the moment yours.
          </p>
          <div ref={actions} className={styles.actions}>
            <Link href="/cars" className="btn btn-primary">Explore the fleet <Icon name="ph-arrow-right" size={17} /></Link>
            <span className={styles.assurance}><Icon name="ph-steering-wheel" size={17} /> Your car. Our chauffeur.</span>
          </div>
        </div>

        <p ref={outro} className={styles.outro} aria-hidden="true">An arrival to remember.<br /><span>A journey made for you.</span></p>

        <div className={styles.bottom}>
          <div className={styles.scrollCue} aria-hidden="true">
            <span className={styles.scrollIcon}><Icon name="ph-caret-down" size={16} /></span>
            <span>Scroll to experience</span>
            <span className={styles.track}><span ref={progressBar} /></span>
          </div>
          <a href="#journey-search" className={styles.bookingLink}>Plan your journey <Icon name="ph-arrow-right" size={17} /></a>
        </div>
      </div>
    </section>
  );
}
