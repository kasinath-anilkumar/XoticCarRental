import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { Media } from "@/components/ui/Media";
import { getCatalog } from "@/lib/content";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { formatINR } from "@/lib/format";
import { SERVICE_GROUPS, serviceFromPrice, type Service } from "@/lib/services";
import { getServicePage } from "@/lib/service-content";
import { Pagination } from "@/components/ui/Pagination";
import { parsePage } from "@/lib/pagination";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

/**
 * Written out rather than interpolated: Tailwind scans source for whole class
 * names, so `grid-cols-[repeat(${n},1fr)]` would generate nothing at all.
 */
const COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-[repeat(2,1fr)]",
  3: "grid-cols-[repeat(3,1fr)]",
  4: "grid-cols-[repeat(4,1fr)]",
};

export const metadata: Metadata = {
  title: "What we drive for",
  description:
    "Weddings, photoshoots, corporate travel, airport transfers, VIP movement, tours and monthly chauffeurs — services across our published locations, each with its own rates and its own preparation.",
  alternates: { canonical: "/services" },
  openGraph: { url: `${siteUrl()}/services` },
};

/**
 * The services index.
 *
 * What it replaced was eleven identical text cards in one flat grid. That asks
 * a visitor to read eleven things to find the one they came for, gives the
 * business no way to say which work it actually leads with, and — alone among
 * the index pages here — offered no number to compare. Cities, packages and
 * the fleet all anchor with a price.
 *
 * So: three bands a visitor can sort themselves into (an occasion, a business
 * trip, a long journey), photography from the service's own occasion, and what
 * each one starts at. The first card in each band is wide, because within a
 * band there IS a service people ask for most, and a grid that pretends
 * otherwise makes the page harder to read rather than fairer.
 */
export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const [catalog, servicePage] = await Promise.all([getCatalog(), getServicePage(parsePage(params.page))]);
  const services = servicePage.data;
  if (!isPricingAvailable(catalog)) {
    return (
      <section className="sec">
        <h1 className="mb-6">Services with a chauffeur</h1>
        <PricingUnavailable />
        <nav aria-label="Services" className="mt-6 flex flex-wrap gap-3">
          {services.map((service) => <Link key={service.slug} href={`/services/${service.slug}`} className="btn btn-secondary">{service.short}</Link>)}
        </nav>
      </section>
    );
  }
  const heroFor = (occasionSlug: string) =>
    catalog.occasions.find((occasion) => occasion.slug === occasionSlug)?.heroImage ?? null;

  return (
    <>
      <section className="sec">
        <p className="kick">Services</p>
        <h1 className="mb-2 font-[family-name:var(--font-heading)] text-[32px] leading-tight sm:text-[40px]">
          What is the journey for?
        </h1>
        <p className="max-w-[66ch] text-[15px] text-[var(--color-neutral-400)] [text-wrap:pretty]">
          {servicePage.total} services, with published packages and dedicated chauffeurs. What changes is the
          preparation, the questions we ask when you enquire, and — for weddings and VIP movement —
          a handling charge shown on its own line in the quote. Prices below are where each one
          starts; the route decides the rest.
        </p>
      </section>

      {SERVICE_GROUPS.map((group) => {
        const grouped = services.filter((service) => service.group === group.key);
        if (grouped.length === 0) return null;

        return (
          <section key={group.key} className="sec sec-tight">
            <div className="mb-5 max-w-[62ch]">
              <h2 className="h2">{group.name}</h2>
              <p className="mt-1 text-[13px] text-[var(--color-neutral-400)]">{group.blurb}</p>
            </div>

            {/* Uniform tiles, and a column count that matches the band, so
                every row fills. A fixed three-up left the four-service bands
                ending on a lone card beside two columns of nothing — twice on
                one page, which reads as a layout that broke rather than a list
                that ended. The bands are the hierarchy here: a reader picks a
                heading and then reads three or four things, not eleven. */}
            <div
              className={`grid gap-4 max-lg:grid-cols-[repeat(2,1fr)] max-md:grid-cols-1 ${
                COLUMNS[grouped.length] ?? "grid-cols-[repeat(3,1fr)]"
              }`}
            >
              {grouped.map((service) => (
                <ServiceTile
                  key={service.slug}
                  service={service}
                  image={heroFor(service.occasionSlug)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <section className="sec sec-tight">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-divider)] bg-[var(--color-surface)] p-6 sm:p-8">
          <h2 className="font-[family-name:var(--font-heading)] text-[21px]">
            Not sure which one it is?
          </h2>
          <p className="mt-1 mb-5 max-w-[64ch] text-[14px] text-[var(--color-neutral-400)]">
            Most bookings are simpler than the list makes them look — a car, a date and a route.
            Price it yourself and we will tell you what it actually costs, or send the details and
            somebody will call back the same day.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/price-calculator" className="btn btn-primary">
              <Icon name="ph-calculator" size={17} />
              Price a trip
            </Link>
            <Link href="/contact" className="btn btn-secondary">
              <Icon name="ph-chat-circle-text" size={17} />
              Tell us what you need
            </Link>
            <Link href="/packages" className="btn btn-ghost">
              <Icon name="ph-package" size={17} />
              Every package
            </Link>
            <Link href="/cars" className="btn btn-ghost">
              <Icon name="ph-car-simple" size={17} />
              Browse the fleet
            </Link>
          </div>
        </div>
      </section>
      <div className="sec sec-tight"><Pagination total={servicePage.total} page={servicePage.page} pageSize={24} path="/services" label="services" /></div>
    </>
  );
}

/**
 * One service, as a photographic tile.
 *
 * The photograph belongs to the occasion behind the service, which is the same
 * picture its own page opens with — so arriving there is a continuation rather
 * than a surprise.
 */
function ServiceTile({
  service,
  image,
}: {
  service: Service;
  image: string | null;
}) {
  const from = serviceFromPrice(service);

  return (
    <Link
      href={`/services/${service.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-divider)] bg-[var(--color-surface)] no-underline transition-colors hover:border-[var(--color-accent-solid)]"
    >
      <div className="on-dark relative h-[150px]">
        <Media
          src={image}
          alt=""
          placeholder={service.short}
          className="absolute inset-0 size-full object-cover"
          icon={service.icon}
          sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
        />
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.15),rgb(0_0_0/0.72))]" />

        {/* The price sits at the top and the name along the bottom: side by
            side they fought for the same row, and "Engagement & reception
            cars" ran straight into its own figure. */}
        {from !== null && (
          <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-[rgb(0_0_0/0.55)] px-[10px] py-[3px] text-[11px] backdrop-blur-sm">
            from{" "}
            <strong className="font-[family-name:var(--font-heading)] text-[13px] text-[var(--color-accent-400)]">
              {formatINR(from)}
            </strong>
          </span>
        )}

        <span className="pointer-events-none absolute right-4 bottom-4 left-4">
          <Icon name={service.icon} size={20} color="var(--color-accent-400)" />
          <span className="mt-1 block font-[family-name:var(--font-heading)] text-[18px] leading-tight text-balance">
            {service.name}
          </span>
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="flex-1 text-[13px] text-[var(--color-neutral-400)] [text-wrap:pretty]">
          {service.tagline}
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-[13px] text-[var(--color-accent)]">
          What it includes
          <Icon name="ph-arrow-right" size={14} />
        </span>
      </div>
    </Link>
  );
}
