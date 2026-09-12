"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import type { GalleryCategory } from "@/lib/gallery";

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
      {/* Category Pills Navigator */}
      <nav aria-label="Gallery categories" className="mb-8 max-md:mb-5">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => handleCategorySelect("all")}
            aria-pressed={activeCategory === "all"}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-all ${
              activeCategory === "all"
                ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-xs"
                : "border border-[var(--color-divider)] bg-surface text-[var(--color-neutral-400)] hover:border-[var(--color-accent)] hover:text-text"
            }`}
          >
            <Icon name="ph-squares-four" size={15} />
            <span>All vehicles</span>
            <span className="text-[11px]">
              ({allItems.length})
            </span>
          </button>

          {categories.map((category) => {
            const isActive = activeCategory === category.slug;
            return (
              <button
                key={category.slug}
                type="button"
                onClick={() => handleCategorySelect(category.slug)}
                aria-pressed={isActive}
                className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-xs"
                    : "border border-[var(--color-divider)] bg-surface text-[var(--color-neutral-400)] hover:border-[var(--color-accent)] hover:text-text"
                }`}
              >
                <Icon name="ph-car-profile" size={15} />
                <span>{category.name}</span>
                <span className="text-[11px]">
                  ({category.frames.length})
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Category Header Blurb */}
      {activeCategoryObj && (
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-divider)] pb-4">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-[22px] font-semibold text-text max-md:text-[18px]">
              {activeCategoryObj.name}
            </h2>
            <p className="mt-1 text-[13px] text-[var(--color-neutral-400)]">
              {activeCategoryObj.blurb}
            </p>
          </div>
          <Link
            href={activeCategoryObj.browseHref}
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--color-accent-300)] hover:text-[var(--color-accent-200)]"
          >
            <span>Browse these vehicles</span>
            <Icon name="ph-arrow-right" size={13} />
          </Link>
        </div>
      )}

      {/* Responsive Gallery Grid */}
      <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1 max-md:gap-4">
        {filteredItems.slice(0, visibleCount).map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setLightboxIndex(index); }}
            aria-haspopup="dialog"
            aria-label={`View ${item.categoryName}, photo ${item.index}`}
            className="group relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-lg border border-[var(--color-divider)] bg-[var(--color-slot)] p-0 text-left shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-md)]"
          >
            <Image
              src={item.src}
              alt={item.alt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {/* Gradient Overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgb(0,0,0,0.85)] via-[rgb(0,0,0,0.2)] to-transparent opacity-80 transition-opacity group-hover:opacity-95" />

            {/* Floating Top Badge */}
            <div className="absolute top-3 left-3">
              <span className="rounded bg-black/75 px-2.5 py-0.5 text-[10.5px] font-medium text-white backdrop-blur-xs">
                {item.categoryName}
              </span>
            </div>

            {/* Center Zoom Lens Trigger on Hover */}
            <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="grid size-11 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-ink)] shadow-lg transition-transform duration-200 group-hover:scale-110">
                <Icon name="ph-magnifying-glass-plus" size={20} />
              </span>
            </div>

            {/* Bottom Card Caption */}
            <div className="absolute right-3.5 bottom-3 left-3.5 flex items-end justify-between text-white">
              <div>
                <p className="font-[family-name:var(--font-heading)] text-[15px] font-medium text-white">
                  {item.categoryName} · Photo #{item.index}
                </p>
                <p className="mt-0.5 text-[11.5px] text-neutral-300">
                  Tap to view full frame
                </p>
              </div>
              <span className="text-[11px] text-[var(--color-accent-300)] font-medium">
                Expand ↗
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 text-center">
        <output className="block text-sm text-[var(--color-neutral-400)]">
          Showing {Math.min(visibleCount, filteredItems.length)} of {filteredItems.length} photos
        </output>
        {visibleCount < filteredItems.length && (
          <button type="button" className="btn btn-secondary mt-3"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Show more photos
          </button>
        )}
      </div>

      {lightboxIndex !== null && filteredItems[lightboxIndex] && (
        <GalleryLightbox items={filteredItems} index={lightboxIndex}
          onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)}
          whatsappNumber={whatsappNumber} />
      )}
    </div>
  );
}
