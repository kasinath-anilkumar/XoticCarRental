import type { Car } from "./types";

export interface GalleryFrame {
  id: string;
  src: string;
  alt: string;
  carHref: string;
}

export interface GalleryCategory {
  slug: string;
  name: string;
  blurb: string;
  browseHref: string;
  frames: GalleryFrame[];
}

/** Published fleet imagery only; empty image slots never invent gallery files. */
export function galleryFromCars(cars: readonly Car[]): GalleryCategory[] {
  const categories = new Map<string, GalleryCategory>();
  const seen = new Set<string>();
  for (const car of cars) {
    const name = car.type.trim() || "Vehicles";
    for (const [index, image] of car.images.entries()) {
      const src = image.url.trim();
      if (!src || seen.has(src)) continue;
      seen.add(src);
      let category = categories.get(name);
      if (!category) {
        category = {
          slug: `type:${name}`,
          name,
          blurb: "Explore published vehicle images and open a car for details.",
          browseHref: `/cars?type=${encodeURIComponent(car.type)}`,
          frames: [],
        };
        categories.set(name, category);
      }
      category.frames.push({
        id: `${car.slug}-${image.kind}-${index}`,
        src,
        alt: image.alt?.trim() || `${car.name} — ${image.kind}`,
        carHref: `/cars/${encodeURIComponent(car.slug)}`,
      });
    }
  }
  return [...categories.values()];
}
