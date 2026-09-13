"use client";

import { useMemo, useState } from "react";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { Media } from "@/components/ui/Media";
import type { CarImage } from "@/lib/types";
import styles from "./VehicleGallery.module.css";

export function VehicleGallery({ images, name }: { images: CarImage[]; name: string }) {
  const frames = useMemo(() => {
    const seen = new Set<string>();
    return [...images].sort((a, b) => Number(b.kind === "hero") - Number(a.kind === "hero")).filter((image) => {
      if (!image.url || seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    });
  }, [images]);
  const [index, setIndex] = useState(0);
  const activeIndex = Math.min(index, Math.max(0, frames.length - 1));
  const selected = frames[activeIndex];

  return (
    <section className={styles.gallery} aria-label="Vehicle gallery">
      <div className={styles.stage}>
        <Media src={selected?.url ?? null} alt={selected?.alt || name} placeholder={name} className={styles.mainImage} priority={activeIndex === 0} sizes="(max-width: 1023px) 100vw, 65vw" />
        <span className={styles.caption}>{selected?.kind === "hero" ? "The exterior" : selected?.kind ?? "Vehicle gallery"}</span>
        {frames.length > 1 && <output className={styles.position}>{String(activeIndex + 1).padStart(2, "0")} / {String(frames.length).padStart(2, "0")}</output>}
      </div>
      {frames.length > 1 && <div className={styles.galleryFooter}>
        <p>Vehicle photos<br /><span>Choose a view</span></p>
        <HorizontalScroll label={`${name} photos`} className={styles.thumbs} contentClassName={styles.thumbList}>
          {frames.map((frame, frameIndex) => (
            <button key={frame.url} type="button" className={styles.thumbnail} aria-pressed={activeIndex === frameIndex} aria-label={`Show ${name} ${frame.kind} photo`} onClick={() => setIndex(frameIndex)}>
              <Media src={frame.url} alt="" placeholder={frame.kind} className={styles.thumbImage} sizes="90px" />
            </button>
          ))}
        </HorizontalScroll>
      </div>}
    </section>
  );
}
