import Link from "next/link";

import { Media } from "@/components/ui/Media";
import type { City } from "@/lib/types";

/**
 * A city tile: photograph, a scrim, and the name in the bottom corner.
 *
 * `text-text` rather than `inherit`, deliberately — inherit cancels the global
 * link colour but then loses to `.on-dark`, which put near-black caption text
 * on a dark photograph.
 *
 * In a horizontal rail the tile needs a fixed size, and it has to hold at every
 * width: a bare `h-[96px]` would lose to `md:h-[150px]`, which is inside a
 * media query, so the rail states its height at both.
 */
export function CityCard({ city, rail = false }: { city: City; rail?: boolean }) {
  const size = rail ? "h-[96px] w-[132px] md:h-[96px]" : "h-[110px] md:h-[150px]";

  return (
    <Link
      href={`/cities/${city.slug}`}
      prefetch={false}
      className={`on-dark group relative block overflow-hidden rounded-md bg-slot text-text no-underline ${size}`}
    >
      <Media
        src={city.heroImage}
        alt=""
        placeholder={city.name}
        className="absolute inset-0 bg-transparent"
        icon="ph-map-pin"
        sizes="(max-width: 767px) 50vw, 16vw"
      />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(var(--color-bg-rgb)/0),rgb(var(--color-bg-rgb)/0.9))]" />
      <span className="pointer-events-none absolute bottom-4 left-4">
        <span className="block font-heading text-[15px] group-hover:text-accent-300">
          {city.name}
        </span>
        <span className="text-[11px] text-neutral-400">{city.carCount} cars</span>
      </span>
    </Link>
  );
}
