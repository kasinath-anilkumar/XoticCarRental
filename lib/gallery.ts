/**
 * The gallery's categories (§21).
 *
 * The eight the brief names, in the order it names them. Each frame is a file
 * under public/media/gallery — placeholders today, photographs the day Xotic
 * sends them, with no code change: the filenames are the contract.
 */

export interface GalleryCategory {
  slug: string;
  name: string;
  blurb: string;
  /** Where this category's work can be booked. */
  serviceSlug: string;
  frames: number;
}

export const GALLERY: GalleryCategory[] = [
  {
    slug: "weddings",
    name: "Weddings",
    blurb: "Ideas for bridal cars, wedding convoys and guest transport.",
    serviceSlug: "wedding",
    frames: 3,
  },
  {
    slug: "bride-groom",
    name: "Bride & groom",
    blurb: "Arrival ideas for the couple, with space for wedding decor.",
    serviceSlug: "wedding",
    frames: 3,
  },
  {
    slug: "photoshoots",
    name: "Photoshoots",
    blurb: "Luxury cars for still photography, advertising and film.",
    serviceSlug: "photoshoot",
    frames: 3,
  },
  {
    slug: "corporate",
    name: "Corporate events",
    blurb: "Conference fleets, client movement and executive day hire.",
    serviceSlug: "corporate",
    frames: 3,
  },
  {
    slug: "vip-transfers",
    name: "VIP transfers",
    blurb: "Airport pickups, venue transfers and dedicated chauffeur service.",
    serviceSlug: "vip-transfers",
    frames: 3,
  },
  {
    slug: "luxury-cars",
    name: "Luxury cars",
    blurb: "Luxury sedans and SUVs for leisure, business and special occasions.",
    serviceSlug: "leisure",
    frames: 3,
  },
  {
    slug: "chauffeur",
    name: "Chauffeur services",
    blurb: "Chauffeur services for daily travel and longer arrangements.",
    serviceSlug: "monthly-chauffeur",
    frames: 3,
  },
  {
    slug: "tours",
    name: "Tours",
    blurb: "Hill roads, backwaters and the long southern circuits.",
    serviceSlug: "south-india-tour",
    frames: 3,
  },
];

export function categoryBySlug(slug: string): GalleryCategory | undefined {
  return GALLERY.find((category) => category.slug === slug);
}

/** Every frame in a category, as public paths. */
export function framesFor(category: GalleryCategory): string[] {
  return Array.from(
    { length: category.frames },
    (_, index) => `/media/gallery/${category.slug}-${index + 1}.png`,
  );
}
