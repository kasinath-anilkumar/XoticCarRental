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
      if (preference.matches || connection?.saveData || frames.length < 2 || typeof createImageBitmap !== "function") return;

      let visible = true;
      let scheduled = 0;
      let active = false;
      let prepared = false;
      let geometryDirty = true;
      let start = 0;
      let leadIn = 0;
      let distance = 1;
      let mobile = false;
      let overlay = true;
      let progress = 0;
      let previousTime = 0;
      const activate = () => {
        surface.style.opacity = "1";
        root.dataset.motion = "true";
        active = true;
        geometryDirty = true;
      };
      const player = createHeroSequence({
        canvas: surface,
        frames,
        onReady: () => {
          prepared = true;
          // Late loading must not add scroll distance above someone who has
          // already continued to the booking form. Activate on returning up.
          if (window.scrollY <= start + 1 && !document.hidden) activate();
          schedule();
        },
        onFrame: (index) => { root.dataset.frame = String(index); },
      });

      // Geometry changes on resize/readiness, not on every scroll frame.
      const measure = () => {
        geometryDirty = false;
        const bounds = media.getBoundingClientRect();
        const stage = root.firstElementChild as HTMLElement;
        start = root.getBoundingClientRect().top + window.scrollY;
        // Very short windows scroll through the stage before the image pins.
        leadIn = Math.max(0, stage.offsetHeight - window.innerHeight);
        distance = Math.max(1, root.offsetHeight - stage.offsetHeight);
        mobile = window.innerWidth < 768;
        // Copy that sits over the frames fades to reveal them; copy beside them stays.
        const text = copy.current;
        overlay = !!text && text.offsetTop < media.offsetTop + media.offsetHeight && media.offsetTop < text.offsetTop + text.offsetHeight
          && text.offsetLeft < media.offsetLeft + media.offsetWidth && media.offsetLeft < text.offsetLeft + text.offsetWidth;
        // Phones show a 9:16 portrait frame.
        player.resize(bounds.width, bounds.height, mobile);
      };
      const update = (time: number) => {
        scheduled = 0;
        if (!visible || document.hidden) { previousTime = 0; return; }
        if (!active) {
          if (!prepared || window.scrollY > start + 1) return;
          activate();
        }
        if (geometryDirty) measure();
        const target = Math.min(1, Math.max(0, (window.scrollY - start - leadIn) / distance));
        // Ease coarse mouse-wheel steps over a short, frame-rate-independent
        // interval. Native page scrolling, touch and keyboard remain in charge.
        const elapsed = previousTime ? Math.min(64, time - previousTime) : 16;
        previousTime = time;
        progress = Math.abs(target - progress) < 0.0005
          ? target
          : progress + (target - progress) * (1 - Math.exp(-elapsed / 80));
        player.seek(Math.round(progress * (frames.length - 1)));
        if (copy.current) {
          copy.current.style.opacity = overlay ? Math.max(0, 1 - progress * 2.6).toFixed(3) : "1";
          copy.current.style.transform = overlay ? `translate3d(0, ${(-progress * 48).toFixed(2)}px, 0)` : "none";
        }
        const inert = overlay && progress > 0.28;
        if (actions.current && actions.current.inert !== inert) actions.current.inert = inert;
        if (outro.current) outro.current.style.opacity = mobile ? "0" : Math.min(1, Math.max(0, (progress - 0.55) * 4)).toFixed(3);
        if (progressBar.current) progressBar.current.style.transform = `scaleX(${progress.toFixed(4)})`;
        if (progress !== target) schedule();
        else previousTime = 0;
      };
      const schedule = () => {
        if (!scheduled && visible && !document.hidden) scheduled = requestAnimationFrame(update);
      };
      const resize = () => {
        geometryDirty = true;
        schedule();
      };
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) schedule();
        else { cancelAnimationFrame(scheduled); scheduled = 0; previousTime = 0; }
      });
      observer.observe(root);
      const sizeObserver = new ResizeObserver(resize);
      sizeObserver.observe(media);
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", resize, { passive: true });
      document.addEventListener("visibilitychange", schedule);
      measure();

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
    connection?.addEventListener("change", configure);
    return () => {
      stop?.();
      preference.removeEventListener("change", configure);
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
            <Link href="/cars#fleet-results" className="btn btn-solid">Explore the fleet <Icon name="ph-arrow-up-right" size={17} /></Link>
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
