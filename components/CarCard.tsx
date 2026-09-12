import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { Media } from "@/components/ui/Media";
import { carPrice, heroImage, homeCity, type Catalog } from "@/lib/catalog";
import { formatINR } from "@/lib/format";
import { copyJourneyParams } from "@/lib/journey-params";
import type { Car, Package } from "@/lib/types";
import { carEnquiryMessage, whatsappLink } from "@/lib/whatsapp";

export interface CarCardProps {
  catalog: Catalog;
  car: Car;
  /** Which package's rate the headline price shows. */
  pkg: Package;
  variant?: "full" | "compact";
  priority?: boolean;
  citySlug?: string;
  journeyQuery?: string;
}

/**
 * Ported from design/project/CarCard.dc.html — both variants.
 * Full: 172px photo, 4-up spec strip, price block, two actions.
 * Compact: 112×88 thumbnail beside a two-line summary.
 *
 * The first component on Tailwind. Two things worth knowing if you are
 * converting the next one:
 *
 *   `max-md:` is the honest translation of this codebase. The stylesheets were
 *   written desktop-first with `@media (max-width: 767px)` overrides, and
 *   `max-md:` is that same query. Rewriting each component mobile-first at the
 *   same time as moving it to utilities would make every diff a redesign.
 *
 *   Use `shadow-[var(--shadow-sm)]`, not `shadow-sm`. Tailwind composes its
 *   shadow utilities through ring and inset variables, and against a dark card
 *   on a light page that renders the edge a pixel differently. The raw token
 *   is exact.
 *
 *   The spacing scale lines up. `--spacing` is the design's own 2.8px rhythm,
 *   so `gap-2` is 5.6px and `p-4` is 11.2px — the numbers in `--space-N` are
 *   the numbers in the utility. A module value that is *not* a multiple of
 *   2.8px — a 16px pad, an 8px gap — has to be written out: `px-[16px]`.
 *
 *   Never emit two utilities for the same property and expect the later one in
 *   the string to win. Class order in the attribute means nothing; both sit in
 *   the utilities layer at equal specificity, so their order in Tailwind's
 *   generated sheet decides. A conditional style branches instead —
 *   `${active ? ACTIVE : IDLE}` — with the shared shape in a base string. The
 *   same rule is why <Media>'s frame kept a layered class: callers override it.
 *
 *   A `<p>` carries `margin: 0 0 8.4px` from the base sheet. A module that
 *   wrote `margin: 22.4px 0 0` zeroed that bottom margin as a side effect of
 *   the shorthand; `mt-8` does not, so the paragraph needs `mb-0` too.
 *
 *   Use `text-[14px]`, not `text-sm`. The named type scale sets a line-height
 *   as well as a size (1.428 for `text-sm`), while the stylesheets set only a
 *   size and inherited the body's 1.55. Two `text-sm`s were enough to shorten
 *   a page by 4px and fail the pixel diff.
 *
 * Below 768px the full card becomes the compact one: same markup reflowed,
 * rather than a second copy of every card in the DOM. The spec strip and the
 * extra-rate line drop out — at 112px wide there is no room, and the detail
 * page carries both.
 */
export function CarCard({
  catalog,
  car,
  pkg,
  variant = "full",
  priority = false,
  citySlug,
  journeyQuery = "",
}: CarCardProps) {
  const city = citySlug
    ? (catalog.cities.find((c) => c.slug === citySlug) ?? homeCity(catalog, car))
    : homeCity(catalog, car);
  const price = formatINR(carPrice(catalog, car, pkg));
  const journeyParams = copyJourneyParams(journeyQuery);
  if (citySlug) journeyParams.set("city", citySlug);
  const query = journeyParams.toString();
  const href = `/cars/${car.slug}${query ? `?${query}` : ""}`;
  const waHref = whatsappLink(
    catalog.settings.whatsappNumber,
    carEnquiryMessage(car, city, pkg),
  );
  const image = heroImage(car);

  const nameLink =
    "font-heading font-medium leading-[1.2] text-text no-underline hover:text-accent-300";
  const priceValue = "font-heading leading-[1.1] text-accent-300";
  const unit = "text-[10px] text-neutral-500";

  if (variant === "compact") {
    return (
      <article className="flex gap-4 rounded-md bg-surface p-3 shadow-[var(--shadow-sm)]">
        <Media
          src={image}
          alt={car.name}
          placeholder={car.name}
          className="relative h-[88px] w-[112px] flex-none rounded-sm"
          sizes="112px"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link href={href} prefetch={false} className={`${nameLink} text-[15px]`}>
            {car.name}
          </Link>
          <p className="text-[11px] text-neutral-500">
            {car.year} · {car.type} · {car.seats} seats · With driver
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className={`${priceValue} text-[17px]`}>{price}</span>
            <span className={unit}>/ {pkg.label}</span>
          </p>
          <div className="mt-2 flex gap-2">
            <Link
              href={href}
              prefetch={false}
              className="btn btn-primary flex-1 px-[8px] py-[6px] text-[12px]"
            >
              Price &amp; details
            </Link>
            <a
              className="btn wa px-[10px] py-[6px] text-[12px]"
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Enquire about the ${car.name} on WhatsApp`}
            >
              <Icon name="ph-whatsapp-logo" size={15} />
            </a>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-md bg-surface shadow-[var(--shadow-sm)] transition-shadow duration-200 hover:shadow-[var(--shadow-md)]">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slot sm:aspect-[16/10] md:h-[184px]">
        <Media
          src={image}
          alt={car.name}
          placeholder={`Drop ${car.name} photo`}
          priority={priority}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
        />
        {/* Floating Badges Over Photo */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 sm:top-3 sm:left-3">
          {car.badge && (
            <span className="tag tag-accent text-[10px] sm:text-[11px] font-medium shadow-xs">
              {car.badge}
            </span>
          )}
        </div>
        <div className="pointer-events-none absolute top-2.5 right-2.5 flex items-center gap-1 rounded-sm bg-neutral-900 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-neutral-100 shadow-xs sm:top-3 sm:right-3">
          <Icon name="ph-map-pin" size={11} color="var(--color-accent)" />
          <span>{city.name}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div>
          <Link href={href} prefetch={false} className={`${nameLink} block text-[16px] sm:text-[18px]`}>
            {car.name}
          </Link>
          <p className="mt-[2px] text-[11px] text-neutral-500 sm:text-[12px]">
            {car.year} · {car.type}
          </p>
        </div>

        <div className="my-3 grid grid-cols-4 gap-1 border-y border-divider py-2.5 text-center">
          <Spec icon="ph-users-three" label={`${car.seats} seats`} />
          <Spec icon="ph-gear-six" label={car.transmission} />
          <Spec icon="ph-gas-pump" label={car.fuel} />
          <Spec icon="ph-steering-wheel" label="With driver" />
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-neutral-500">
            {pkg.label} package
          </span>
          <div className="text-right">
            <span className={`${priceValue} text-[18px] sm:text-[21px]`}>{price}</span>
            <span className={unit}> / trip</span>
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-[11px] text-neutral-500">
          <span>+{formatINR(car.extraKmRate)}/km after</span>
          <span>Driver bata {formatINR(car.bata)}/day</span>
        </div>

        <div className="mt-3.5 flex items-center gap-2 pt-1 sm:mt-auto">
          <Link
            href={href}
            prefetch={false}
            className="btn btn-primary min-h-[42px] flex-1 px-3 py-2 text-[12px] sm:text-[13px] font-medium hover:border-[var(--color-accent)]"
          >
            <span>Price &amp; details</span>
            <Icon name="ph-arrow-right" size={13} />
          </Link>
          <a
            className="btn wa min-h-[42px] min-w-[42px] px-3 py-2 text-[12px] sm:text-[13px] font-medium"
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Enquire about the ${car.name} on WhatsApp`}
          >
            <Icon name="ph-whatsapp-logo" size={17} />
            <span className="max-sm:hidden">Enquire</span>
          </a>
        </div>
      </div>
    </article>
  );
}

function Spec({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="flex flex-col items-center gap-[3px] text-center text-[10px] text-neutral-400">
      <Icon name={icon} size={16} color="var(--color-neutral-300)" />
      <span className="truncate max-w-full">{label}</span>
    </span>
  );
}
