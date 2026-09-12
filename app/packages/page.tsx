import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { getCatalog } from "@/lib/content";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { getServicePage } from "@/lib/service-content";
import { Pagination } from "@/components/ui/Pagination";
import { parsePage } from "@/lib/pagination";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Packages",
  description:
    "Wedding, corporate, airport, chauffeur, intercity tour and VIP packages — what each one covers and what it starts at.",
  alternates: { canonical: "/packages" },
  openGraph: { url: `${siteUrl()}/packages` },
};

/**
 * Every package in one place (§19).
 *
 * The service pages each carry their own; this is the page for the customer who
 * wants to compare a wedding convoy against a tour against a monthly driver
 * before deciding which conversation to have. The prices are starting points,
 * and saying so once at the top is more honest than an asterisk on each card.
 */
export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const [catalog, servicePage] = await Promise.all([getCatalog(), getServicePage(parsePage(params.page))]);
  const services = servicePage.data;
  if (!isPricingAvailable(catalog)) {
    return <section className="sec"><h1 className="mb-6">Packages for your journey</h1><PricingUnavailable /></section>;
  }

  return (
    <section className="sec">
      <p className="kick">Packages</p>
      <h1 className="mb-1 font-[family-name:var(--font-heading)] text-[32px] leading-tight sm:text-[38px]">
        Ready-made, then priced for your route
      </h1>
      <p className="mb-3 max-w-[66ch] text-sm text-[var(--color-neutral-400)]">
        Each package is a shape we have run enough times to price honestly: the hours, the
        kilometres, the driver&rsquo;s allowance and the running costs already counted. The figure
        shown is where it starts — the final number depends on the route, the date and the car, and
        comes back in writing before anything is due.
      </p>
      <p className="mb-8 text-[13px] text-[var(--color-neutral-400)]">
        All prices exclude {catalog.settings.gstPercent}% GST unless the package says
        &ldquo;all in&rdquo;.
      </p>

      <nav aria-label="Jump to a service" className="mb-9 flex flex-wrap gap-2">
        {services.map((service) => (
          <a
            key={service.slug}
            href={`#${service.slug}`}
            className="rounded-full border border-[var(--color-divider)] px-3 py-1.5 text-[13px] text-[var(--color-neutral-400)] no-underline hover:text-[var(--color-text)]"
          >
            {service.short}
          </a>
        ))}
      </nav>

      {services.map((service) => (
        <div
          key={service.slug}
          id={service.slug}
          className="mb-10 scroll-mt-[calc(var(--header-height)+16px)]"
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-[22px]">
              <Icon name={service.icon} size={20} color="var(--color-accent)" />
              {service.name}
            </h2>
            <Link
              href={`/services/${service.slug}`}
              className="text-[13px] text-[var(--color-accent)] no-underline"
            >
              What it includes <Icon name="ph-arrow-right" size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {service.packages.map((item) => (
              <Link
                key={item.name}
                href={`/services/${service.slug}#enquiry`}
                className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-divider)] bg-[var(--color-surface)] p-4 no-underline transition-colors hover:border-[var(--color-accent-solid)]"
              >
                <p className="font-[family-name:var(--font-heading)] text-[17px] text-[var(--color-text)]">
                  {item.name}
                </p>
                <p className="mt-1 flex-1 text-[13px] text-[var(--color-neutral-400)]">
                  {item.detail}
                </p>
                <p className="mt-3 font-[family-name:var(--font-heading)] text-[21px] text-[var(--color-accent)]">
                  {item.price}
                </p>
                <p className="text-[11px] text-[var(--color-neutral-400)]">{item.unit}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Link href="/price-calculator" className="btn btn-primary">
          <Icon name="ph-calculator" size={17} />
          Price your own route
        </Link>
        <Link href="/contact" className="btn btn-ghost">
          <Icon name="ph-chat-circle-text" size={17} />
          Ask for something custom
        </Link>
      </div>
      <div className="sec sec-tight"><Pagination total={servicePage.total} page={servicePage.page} pageSize={24} path="/packages" label="services" /></div>
    </section>
  );
}
