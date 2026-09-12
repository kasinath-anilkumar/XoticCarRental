import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CarCard } from "@/components/CarCard";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { ServiceEnquiryForm } from "@/components/services/ServiceEnquiryForm";
import { Icon } from "@/components/ui/Icon";
import { Media } from "@/components/ui/Media";
import { carsForOccasion } from "@/lib/catalog";
import { getCatalog } from "@/lib/content";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { getService, getServicePage } from "@/lib/service-content";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getServicePage(1, 100)).data.map((service) => ({ slug: service.slug }));
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const service = await getService(slug);
  if (!service) return { title: "Service not found" };

  return {
    title: `${service.name} with driver`,
    description: service.blurb,
    alternates: { canonical: `/services/${service.slug}` },
    openGraph: {
      title: `${service.name} with driver`,
      description: service.blurb,
      url: `${siteUrl()}/services/${service.slug}`,
    },
  };
}

export default async function ServicePage({ params }: { params: Params }) {
  const { slug } = await params;
  const service = await getService(slug);
  if (!service) notFound();

  const catalog = await getCatalog();
  const related = (await getServicePage(1, 8)).data;
  if (!isPricingAvailable(catalog)) {
    return (
      <section className="sec">
        <h1 className="mb-3">{service.name}</h1>
        <p className="mb-6 max-w-[65ch] text-[var(--color-neutral-400)]">{service.blurb}</p>
        <PricingUnavailable />
        <div id="enquiry" className="mt-8 max-w-3xl scroll-mt-[calc(var(--header-height)+20px)]">
          <ServiceEnquiryForm service={service} />
        </div>
      </section>
    );
  }
  const occasion = catalog.occasions.find((item) => item.slug === service.occasionSlug);
  const cars = occasion ? carsForOccasion(catalog, occasion).slice(0, 4) : catalog.cars.slice(0, 4);
  const pkg = catalog.packages[0];

  // Everything this page claims, in a form a search engine can read.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    serviceType: service.name,
    description: service.blurb,
    provider: { "@type": "AutoRental", name: "Xotic Car Rental", url: siteUrl() },
    areaServed: catalog.cities.map((city) => ({ "@type": "City", name: city.name })),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `${service.name} packages`,
      itemListElement: service.packages.map((item) => ({
        "@type": "Offer",
        name: item.name,
        description: item.detail,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <section className="on-dark relative isolate flex min-h-[380px] items-end overflow-hidden sm:min-h-[440px]">
        <Media
          src={occasion?.heroImage ?? null}
          alt=""
          placeholder={`Drop a ${service.short} photo`}
          lighten
          priority
          className="absolute inset-0 -z-10 size-full object-cover"
          icon={service.icon}
          sizes="100vw"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, rgb(0 0 0 / 0.45) 0%, rgb(0 0 0 / 0.15) 45%, rgb(0 0 0 / 0.72) 100%)",
          }}
        />
        <div className="mx-auto w-full max-w-[1180px] px-4 pt-[calc(var(--header-height)+40px)] pb-10 sm:px-6">
          <p className="kick">{service.kicker}</p>
          <h1 className="max-w-[18ch] font-[family-name:var(--font-heading)] text-[30px] leading-[1.08] sm:text-[42px]">
            {service.title}
          </h1>
          <p className="mt-3 max-w-[58ch] text-[15px] opacity-90">{service.blurb}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="#enquiry" className="btn btn-primary">
              <Icon name="ph-paper-plane-tilt" size={16} />
              Enquire about this
            </Link>
            <Link href={`/price-calculator?occ=${service.occasionSlug}`} className="btn btn-ghost">
              <Icon name="ph-calculator" size={16} />
              Price it yourself
            </Link>
          </div>
        </div>
      </section>

      {/* Every service, one tap away — this is the site's spine (§2). */}
      <nav
        aria-label="Services"
        className="scrollbar-none flex gap-2 overflow-x-auto border-b border-[var(--color-divider)] px-4 py-3 sm:px-6"
      >
        {related.map((item) => {
          const active = item.slug === service.slug;
          return (
            <Link
              key={item.slug}
              href={`/services/${item.slug}`}
              aria-current={active ? "page" : undefined}
              className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] no-underline transition-colors ${
                active
                  ? "border-[var(--color-accent-solid)] bg-[var(--color-accent-solid)] text-[var(--color-accent-ink)]"
                  : "border-[var(--color-divider)] text-[var(--color-neutral-400)] hover:text-[var(--color-text)]"
              }`}
            >
              <Icon name={item.icon} size={15} />
              {item.short}
            </Link>
          );
        })}
      </nav>

      <section className="sec">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="h2 mb-4">{service.h2}</h2>
            {service.includes.map((item) => (
              <div key={item.title} className="mb-3 flex gap-3">
                <Icon
                  name="ph-check-circle"
                  size={20}
                  color="var(--color-accent)"
                  style={{ flex: "none" }}
                />
                <div>
                  <p className="text-[15px] font-medium">{item.title}</p>
                  <p className="text-[13px] text-[var(--color-neutral-400)]">{item.detail}</p>
                </div>
              </div>
            ))}

            <p className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-surface)] p-4 text-[13px] text-[var(--color-neutral-400)]">
              <Icon name="ph-info" size={15} color="var(--color-accent)" /> {service.note}
            </p>
          </div>

          <div id="enquiry" className="scroll-mt-[calc(var(--header-height)+16px)]">
            <ServiceEnquiryForm service={service} />
          </div>
        </div>
      </section>

      {/* §19 — the ready-made shapes, so a customer has something to point at. */}
      <section className="sec">
        <h2 className="h2 mb-1">Ready-made packages</h2>
        <p className="mb-5 text-sm text-[var(--color-neutral-400)]">
          Starting points, not fixed menus. Every one is re-quoted for your dates and your route
          before you pay anything.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {service.packages.map((item) => (
            <div
              key={item.name}
              className="rounded-[var(--radius-lg)] border border-[var(--color-divider)] bg-[var(--color-surface)] p-4"
            >
              <p className="font-[family-name:var(--font-heading)] text-[17px]">{item.name}</p>
              <p className="mt-1 text-[13px] text-[var(--color-neutral-400)]">{item.detail}</p>
              <p className="mt-3 font-[family-name:var(--font-heading)] text-[21px] text-[var(--color-accent-text)]">
                {item.price}
              </p>
              <p className="text-[11px] text-[var(--color-neutral-400)]">{item.unit}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <h2 className="h2 mb-1">Where you need it</h2>
        <p className="mb-4 text-[13px] text-[var(--color-neutral-400)]">
          Each city has its own rate, its own fleet and its own pickup points.
        </p>
        <div className="flex flex-wrap gap-2">
          {catalog.cities.map((city) => (
            <Link
              key={city.slug}
              href={`/services/${service.slug}/${city.slug}`}
              className="rounded-full border border-[var(--color-divider)] px-3 py-1.5 text-[13px] text-[var(--color-text)] no-underline hover:border-[var(--color-accent-solid)]"
            >
              {service.short} in {city.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="h2">Cars booked for this</h2>
          <Link
            href={`/cars${service.carFilter.type ? `?type=${encodeURIComponent(service.carFilter.type)}` : ""}`}
            className="btn btn-ghost"
          >
            See the whole fleet
            <Icon name="ph-arrow-right" size={15} />
          </Link>
        </div>
        <div className="grid-4">
          {cars.map((car) => (
            <CarCard key={car.slug} car={car} catalog={catalog} pkg={pkg} />
          ))}
        </div>
      </section>
    </>
  );
}
