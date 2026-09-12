import type { Metadata } from "next";
import Link from "next/link";

import { GalleryViewer } from "@/components/gallery/GalleryViewer";
import { Icon } from "@/components/ui/Icon";
import { getCatalog } from "@/lib/content";
import { galleryFromCars } from "@/lib/gallery";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Luxury Car & Occasion Gallery | Xotic",
  description:
    "Explore ideas for wedding arrivals, photoshoots, corporate travel, VIP transfers and touring in our luxury car and occasion gallery.",
  alternates: { canonical: "/gallery" },
  openGraph: { url: `${siteUrl()}/gallery` },
};

type Params = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function GalleryPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const raw = Array.isArray(params.category) ? params.category[0] : params.category;
  const catalog = await getCatalog();
  const categories = galleryFromCars(catalog.cars);
  const frameCount = categories.reduce((total, category) => total + category.frames.length, 0);

  return (
    <>
      {/* ── GALLERY HERO ───────────────────────────────────────────── */}
      <section className="on-dark border-b border-[var(--color-divider)] bg-[linear-gradient(135deg,#050505_0%,#141414_100%)] px-[var(--gutter-desktop)] pt-12 pb-14 max-md:px-[var(--gutter-mobile)] max-md:pt-8 max-md:pb-10">
        <div className="max-w-[840px]">
          <p className="kick">Fleet gallery</p>
          <h1 className="mb-3 text-[36px] font-medium leading-tight max-lg:text-[30px] max-md:text-[26px]">
            Luxury for every occasion.
          </h1>
          <p className="max-w-[68ch] text-[15px] leading-relaxed text-[var(--color-neutral-300)] max-md:text-[13.5px]">
            Browse published images from our vehicle listings. Select a vehicle type, then open
            an image for a closer look. Contact our team to confirm current condition and availability.
          </p>

          {/* Quick Metrics */}
          <div className="mt-8 flex flex-wrap items-center gap-6 border-t border-[var(--color-neutral-800)] pt-4 text-[12.5px] text-[var(--color-neutral-400)] max-md:gap-4">
            <span className="inline-flex items-center gap-1.5 text-text">
              <Icon name="ph-camera" size={15} color="var(--color-accent)" />
              {frameCount} Gallery images
            </span>
            <span className="inline-flex items-center gap-1.5 text-text">
              <Icon name="ph-squares-four" size={15} color="var(--color-accent)" />
              {categories.length} Categories to explore
            </span>
            <span className="inline-flex items-center gap-1.5 text-text">
              <Icon name="ph-map-trifold" size={15} color="var(--color-accent)" />
              Occasions, business &amp; travel
            </span>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE GALLERY VIEWER ─────────────────────────────── */}
      <section className="sec">
        {frameCount > 0 ? <GalleryViewer
          categories={categories}
          initialCategorySlug={raw ? String(raw) : undefined}
          whatsappNumber={catalog.settings.whatsappNumber}
        /> : <div className="rounded-lg border border-divider bg-surface p-6"><h2 className="text-xl">Vehicle images are being updated</h2><p className="mt-2">Contact our team for current vehicle photos and availability.</p><Link href="/contact" className="btn btn-primary mt-3">Contact our team</Link></div>}
      </section>

      {/* ── BOTTOM BOOKING INVITATION ──────────────────────────────── */}
      <section className="sec sec-tight border-t border-[var(--color-divider)]">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl border border-[var(--color-divider)] bg-surface p-8 shadow-sm max-md:p-6">
          <div className="max-w-[560px]">
            <p className="kick">Plan your occasion</p>
            <h2 className="font-[family-name:var(--font-heading)] text-[22px] font-medium text-text max-md:text-[19px]">
              Ready to book a chauffeur-driven luxury vehicle?
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-neutral-400)]">
              Whether you need a bride &amp; groom entrance car, an executive conference fleet, or a
              VIP airport pickup, explore a trip estimate and contact our team to confirm availability.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 max-md:w-full">
            <Link
              href="/price-calculator"
              className="btn btn-primary min-h-[44px] px-6 text-[13px] max-md:w-full max-md:justify-center"
            >
              <Icon name="ph-calculator" size={16} />
              <span>Estimate trip price</span>
            </Link>
            <Link
              href="/cars"
              className="btn btn-ghost min-h-[44px] px-5 text-[13px] max-md:w-full max-md:justify-center"
            >
              <span>Explore full fleet</span>
              <Icon name="ph-arrow-right" size={14} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
