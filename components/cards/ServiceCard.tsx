import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { Media } from "@/components/ui/Media";
import type { Service } from "@/lib/services";

/**
 * A service, as a picture tile.
 *
 * The photograph belongs to the occasion behind the service — a wedding car
 * looks like a wedding car whether the page calls it "Wedding" or "Engagement"
 * — so the caller passes the image in rather than the card reaching for a
 * catalog it has no business knowing about.
 *
 * Below 768px it drops to the city tile's height and loses the tagline: at that
 * width the grid is two-up and the line wrapped to three.
 */
export function ServiceCard({ service, image }: { service: Service; image: string | null }) {
  return (
    <Link
      href={`/services/${service.slug}`}
      prefetch={false}
      className="on-dark group relative block h-[150px] overflow-hidden rounded-md bg-slot text-text no-underline shadow-[var(--shadow-sm)] md:h-[230px]"
    >
      <Media
        src={image}
        alt=""
        placeholder={service.short}
        className="absolute inset-0 bg-transparent"
        icon={service.icon}
        sizes="(max-width: 767px) 50vw, 25vw"
      />
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(var(--color-bg-rgb)/0.18),rgb(var(--color-bg-rgb)/0.94))]" />
      <span className="pointer-events-none absolute right-6 bottom-6 left-6">
        <Icon name={service.icon} size={24} color="var(--color-accent-400)" />
        <span className="mt-1 block font-[family-name:var(--font-heading)] text-[19px] leading-tight">
          {service.short}
        </span>
        <span className="mt-0.5 hidden text-[12px] text-[var(--color-neutral-400)] md:block">
          {service.tagline}
        </span>
      </span>
    </Link>
  );
}
