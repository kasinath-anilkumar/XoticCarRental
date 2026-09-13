"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import type { GalleryCategory } from "@/lib/gallery";
import styles from "./GalleryViewer.module.css";

export interface GalleryItem {
  id: string;
  src: string;
  alt: string;
  categorySlug: string;
  categoryName: string;
  carHref: string;
  blurb: string;
  index: number;
}

export interface GalleryViewerProps {
  categories: GalleryCategory[];
  initialCategorySlug?: string;
  whatsappNumber: string;
}

const PAGE_SIZE = 12;
const GalleryLightbox = dynamic(
  () => import("./GalleryLightbox").then((module) => module.GalleryLightbox),
  { loading: () => <output className="mt-4 block text-sm">Opening photo…</output> },
);

/**
 * Interactive luxury gallery portfolio with real-time category filtering,
 * responsive cards, and a full-screen interactive lightbox modal with
 * keyboard navigation and direct booking actions.
 */
export function GalleryViewer({
  categories,
  initialCategorySlug,
  whatsappNumber,
}: GalleryViewerProps) {
  const [activeCategory, setActiveCategory] = useState<string>(
    initialCategorySlug && categories.some((c) => c.slug === initialCategorySlug)
      ? initialCategorySlug
      : "all",
  );

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Flatten all frames into a list of gallery items
  const allItems: GalleryItem[] = useMemo(() => {
    return categories.flatMap((category) =>
      category.frames.map((frame, i) => ({
        ...frame,
        categorySlug: category.slug,
        categoryName: category.name,
        blurb: category.blurb,
        index: i + 1,
      })),
    );
  }, [categories]);

  // Filter items based on active category
  const filteredItems = useMemo(() => {
    if (activeCategory === "all") return allItems;
    return allItems.filter((item) => item.categorySlug === activeCategory);
  }, [allItems, activeCategory]);

  const activeCategoryObj = useMemo(() => {
    return categories.find((c) => c.slug === activeCategory);
  }, [categories, activeCategory]);

  // Handle URL history state update without full page reload
  const handleCategorySelect = (slug: string) => {
    setActiveCategory(slug);
    setVisibleCount(PAGE_SIZE);
    setLightboxIndex(null);
    const newUrl = slug === "all" ? "/gallery" : `/gallery?category=${encodeURIComponent(slug)}`;
    window.history.replaceState(null, "", newUrl);
  };

  return (
    <div>
      <nav aria-label="Gallery categories" className={styles.filters}>
        <HorizontalScroll label="Gallery categories" contentClassName={styles.filterItems}>
        <button type="button" onClick={() => handleCategorySelect("all")} aria-pressed={activeCategory === "all"}><Icon name="ph-squares-four" size={16} /><span>All vehicles</span><span>({allItems.length})</span></button>
        {categories.map((category) => <button key={category.slug} type="button" onClick={() => handleCategorySelect(category.slug)} aria-pressed={activeCategory === category.slug}><span>{category.name}</span><span>({category.frames.length})</span></button>)}
        </HorizontalScroll>
      </nav>
      {activeCategoryObj && <div className={styles.resultHeader}><div><h2>{activeCategoryObj.name}</h2><p>{activeCategoryObj.blurb}</p></div><Link href={activeCategoryObj.browseHref}>Browse these vehicles <Icon name="ph-arrow-up-right" size={16} /></Link></div>}
      <div className={styles.masonry}>
        {filteredItems.slice(0, visibleCount).map((item, index) => (
          <button key={item.id} type="button" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setLightboxIndex(index); }} aria-haspopup="dialog" aria-label={`View ${item.categoryName}, photo ${item.index}`} className={styles.frame}>
            <Image src={item.src} alt={item.alt} fill sizes="(max-width: 767px) 50vw, (max-width: 1000px) 50vw, 33vw" />
            <span className={styles.scrim} />
            <span className={styles.caption}><span><strong>{item.categoryName}</strong><small>Photo {String(item.index).padStart(2, "0")}</small></span><span className={styles.expand}><Icon name="ph-arrow-up-right" size={18} /></span></span>
          </button>
        ))}
      </div>
      <div className={styles.more}>
        <output>Showing {Math.min(visibleCount, filteredItems.length)} of {filteredItems.length} photos</output>
        {visibleCount < filteredItems.length && <button type="button" className="btn btn-secondary" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Show more photos <Icon name="ph-plus" size={16} /></button>}
      </div>
      {lightboxIndex !== null && filteredItems[lightboxIndex] && <GalleryLightbox items={filteredItems} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} whatsappNumber={whatsappNumber} />}
    </div>
  );
}
