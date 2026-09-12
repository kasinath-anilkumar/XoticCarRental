"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { useModalDialog } from "@/components/ui/useModalDialog";
import { whatsappLink } from "@/lib/whatsapp";
import type { GalleryItem } from "./GalleryViewer";

interface GalleryLightboxProps {
  items: GalleryItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  whatsappNumber: string;
}

export function GalleryLightbox({ items, index, onIndexChange, onClose, whatsappNumber }: GalleryLightboxProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  useModalDialog(dialog);
  const activeLightboxItem = items[index];
  const showNext = () => onIndexChange((index + 1) % items.length);
  const showPrev = () => onIndexChange((index - 1 + items.length) % items.length);

  return (
    <dialog ref={dialog} aria-label={`${activeLightboxItem.categoryName} photo preview`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") { event.preventDefault(); showNext(); }
        if (event.key === "ArrowLeft") { event.preventDefault(); showPrev(); }
      }}
      className="on-dark fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none flex-col items-center justify-between border-0 bg-transparent p-4 max-md:p-2">
      {/* Clickable Backdrop Button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo preview"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 size-full cursor-default bg-black/94 backdrop-blur-md"
      />

      {/* Top Bar: Counter & Close Action */}
      <div className="relative z-10 flex w-full max-w-6xl items-center justify-between py-2 text-white">
        <div className="flex items-center gap-3">
          <span className="rounded bg-[var(--color-accent)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-accent-ink)]">
            {activeLightboxItem.categoryName}
          </span>
          <span className="text-[12.5px] text-neutral-300">
            Photo {index + 1} of {items.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 cursor-pointer place-items-center rounded-full bg-neutral-800/80 text-white transition-colors hover:bg-neutral-700"
            aria-label="Close photo preview (Escape)"
          >
            <Icon name="ph-x" size={18} />
          </button>
        </div>
      </div>

      {/* Center Image Container with Previous & Next Arrows */}
      <div className="relative flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center">
        {/* Previous Button */}
        <button
          type="button"
          onClick={showPrev}
          className="absolute left-2 z-10 grid size-11 cursor-pointer place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-all hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-ink)] max-md:left-1 max-md:size-9"
          aria-label="Previous photo (Arrow Left)"
        >
          <Icon name="ph-caret-left" size={20} />
        </button>

        {/* Active Image Frame */}
        <div className="relative h-full w-full max-w-[88vw] overflow-hidden rounded-lg">
          <Image
            src={activeLightboxItem.src}
            alt={`${activeLightboxItem.categoryName} — frame ${activeLightboxItem.index}`}
            fill
            loading="eager"
            sizes="90vw"
            className="object-contain"
          />
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={showNext}
          className="absolute right-2 z-10 grid size-11 cursor-pointer place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-all hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-ink)] max-md:right-1 max-md:size-9"
          aria-label="Next photo (Arrow Right)"
        >
          <Icon name="ph-caret-right" size={20} />
        </button>
      </div>

      {/* Bottom Info Bar & Direct Booking Actions */}
      <div className="relative z-10 pointer-events-auto w-full max-w-3xl rounded-lg bg-neutral-900/90 p-4 text-white backdrop-blur-md max-md:p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-[440px]">
            <p className="font-[family-name:var(--font-heading)] text-[16px] font-semibold text-white">
              {activeLightboxItem.categoryName}
            </p>
            <p className="mt-0.5 text-[12px] text-neutral-300">
              {activeLightboxItem.blurb}
            </p>
          </div>

          <div className="flex items-center gap-2 max-md:w-full">
            <Link
              href={`/services/${activeLightboxItem.serviceSlug}`}
              className="btn btn-primary min-h-[40px] flex-1 text-[12px] justify-center"
            >
              <span>Book this service</span>
              <Icon name="ph-arrow-right" size={13} />
            </Link>
            <a
              href={whatsappLink(
                whatsappNumber,
                `Hi Xotic, I was viewing the gallery for ${activeLightboxItem.categoryName} (Photo #${activeLightboxItem.index}) and would like to enquire about availability.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost min-h-[40px] flex-1 text-[12px] justify-center text-white"
            >
              <Icon name="ph-whatsapp-logo" size={15} color="#25D366" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </dialog>
  );
}
