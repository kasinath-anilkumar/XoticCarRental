import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CarCard } from "@/components/CarCard";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { ServiceEnquiryForm } from "@/components/services/ServiceEnquiryForm";
import { Icon } from "@/components/ui/Icon";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { ResponsiveDisclosure } from "@/components/ui/ResponsiveDisclosure";
import { EditorialIntro, editorial } from "@/components/content/Editorial";
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
    <div className={editorial.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <EditorialIntro eyebrow={service.kicker} title={service.title} description={service.blurb} mobileTitle={service.name} mobileDescription={service.tagline}
        image={occasion?.heroImage ?? null} imageLabel={service.name}
        breadcrumb={[{label: "Services", href: "/services"}]} breadcrumbCurrent={service.short}
        actions={<><Link href="#enquiry" className="btn btn-primary">Get a quote <Icon name="ph-arrow-up-right" size={17} /></Link><Link href={`/price-calculator?occ=${service.occasionSlug}`} className="btn btn-secondary">Estimate price</Link></>} />

      {/* Every service, one tap away — this is the site's spine (§2). */}
      <nav
        aria-label="Services"
        className={editorial.contextNav}
      >
        <HorizontalScroll label="Services" contentClassName="flex items-center gap-2 py-1">
        {related.map((item) => {
          const active = item.slug === service.slug;
          return (
            <Link
              key={item.slug}
              href={`/services/${item.slug}`}
              aria-current={active ? "page" : undefined}
              className={editorial.contextLink}
            >
              <Icon name={item.icon} size={15} />
              {item.short}
            </Link>
          );
        })}
        </HorizontalScroll>
      </nav>

      <section className="sec">
        <div className={`${editorial.twoColumns} ${editorial.enquiryLayout}`}>
          <div>
            <ResponsiveDisclosure title="What’s included" id="service-details" hideTitleOnDesktop>
            <h2 className={`h2 mb-4 ${editorial.secondaryHeading}`}>{service.h2}</h2>
            <ul className={editorial.features}>{service.includes.map((item, index) => (
              <li key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.title}</h3><p>{item.detail}</p></div></li>
            ))}</ul>
            </ResponsiveDisclosure>
            <p className={editorial.note}>{service.note}</p>
          </div>

          <div id="enquiry" tabIndex={-1} className={editorial.enquiryTarget}>
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
        <HorizontalScroll label={`${service.short} packages`} controls="above">
        <div className={`${editorial.grid} ${editorial.packageRail}`}>
          {service.packages.map((item) => (
            <div
              key={item.name}
              className={editorial.card}
            >
              <h3>{item.name}</h3>
              <p className="mt-1 text-[13px] text-[var(--color-neutral-400)]">{item.detail}</p>
              <p className={editorial.price}>
                {item.price}
              </p>
              <span className={editorial.unit}>{item.unit}</span><Link href="#enquiry" className="btn btn-secondary mt-6">Enquire about this package</Link>
            </div>
          ))}
        </div>
        </HorizontalScroll>
      </section>

      <section className="sec">
        <ResponsiveDisclosure title="Find this service in your city" hideTitleOnDesktop>
        <h2 className={`h2 mb-1 ${editorial.secondaryHeading}`}>Where you need it</h2>
        <p className="mb-4 text-[13px] text-[var(--color-neutral-400)]">
          Each city has its own rate, its own fleet and its own pickup points.
        </p>
        <div className={editorial.pillList}>
          {catalog.cities.map((city) => (
            <Link
              key={city.slug}
              href={`/services/${service.slug}/${city.slug}`}
              className="rounded-sm border border-[var(--color-divider)] px-3 py-1.5 text-[13px] text-[var(--color-text)] no-underline hover:border-[var(--color-accent-solid)]"
            >
              {service.short} in {city.name}
            </Link>
          ))}
        </div>
        </ResponsiveDisclosure>
      </section>

      <section className={`sec ${editorial.carRail}`}>
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="h2">Find a car for the occasion</h2>
          <Link
            href={`/cars${service.carFilter.type ? `?type=${encodeURIComponent(service.carFilter.type)}` : ""}`}
            className="btn btn-ghost"
          >
            See the whole fleet
            <Icon name="ph-arrow-right" size={15} />
          </Link>
        </div>
        <HorizontalScroll label={`${service.short} cars`} controls="above">
        <div className="grid-cars">
          {cars.map((car) => (
            <CarCard key={car.slug} car={car} catalog={catalog} pkg={pkg} />
          ))}
        </div>
        </HorizontalScroll>
      </section>
    </div>
  );
}
