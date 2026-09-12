import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CarCard } from "@/components/CarCard";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { ServiceEnquiryForm } from "@/components/services/ServiceEnquiryForm";
import { Icon } from "@/components/ui/Icon";
import { Media } from "@/components/ui/Media";
import {
  carsBasedIn,
  cityFromPrice,
  cityRouteFares,
  filterCars,
  pickupPointsIn,
  DEFAULT_FILTERS,
} from "@/lib/catalog";
import { getCatalog } from "@/lib/content";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { formatINR } from "@/lib/format";
import { SERVICES, serviceBySlug } from "@/lib/services";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

/**
 * A service in a city (§24).
 *
 * "Wedding car rental in Kochi" is what somebody actually types, and it is a
 * different question from either "wedding cars" or "cars in Kochi" — it wants
 * the fleet that is *there*, the rate *that city* charges, and the pickup
 * points it would really start from. Eleven services across eight cities is
 * eighty-eight pages, each with content the other eighty-seven do not have:
 * the cars based in that city, its multiplier, its published routes.
 *
 * They are generated rather than written because the alternative — hand-writing
 * eighty-eight pages — produces eighty-eight near-identical pages, which is the
 * thing search engines are built to discard. What varies here is real.
 */
export async function generateStaticParams() {
  const catalog = await getCatalog();
  return SERVICES.flatMap((service) =>
    catalog.cities.map((city) => ({ slug: service.slug, city: city.slug })),
  );
}

type Params = Promise<{ slug: string; city: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, city: citySlug } = await params;
  const service = serviceBySlug(slug);
  const catalog = await getCatalog();
  const city = catalog.cities.find((item) => item.slug === citySlug);
  if (!service || !city) return { title: "Not found" };

  const from = isPricingAvailable(catalog) ? cityFromPrice(catalog, city) : null;
  const title = `${service.name} in ${city.name}`;

  return {
    title,
    description: `${service.tagline} in ${city.name}, ${city.state}.${
      from ? ` From ${formatINR(from)} including the driver's allowance and GST.` : ""
    } ${service.blurb}`.slice(0, 300),
    alternates: { canonical: `/services/${service.slug}/${city.slug}` },
    openGraph: { title, url: `${siteUrl()}/services/${service.slug}/${city.slug}` },
  };
}

export default async function ServiceCityPage({ params }: { params: Params }) {
  const { slug, city: citySlug } = await params;
  const service = serviceBySlug(slug);
  const catalog = await getCatalog();
  const city = catalog.cities.find((item) => item.slug === citySlug);
  if (!service || !city) notFound();
  if (!isPricingAvailable(catalog)) {
    return (
      <section className="sec">
        <h1 className="mb-3">{service.name} in {city.name}</h1>
        <p className="mb-6 max-w-[65ch] text-[var(--color-neutral-400)]">{service.blurb}</p>
        <PricingUnavailable />
        <div id="enquiry" className="mt-8 max-w-3xl scroll-mt-[calc(var(--header-height)+20px)]">
          <ServiceEnquiryForm service={service} />
        </div>
      </section>
    );
  }

  const occasion = catalog.occasions.find((item) => item.slug === service.occasionSlug);
  const pkg = catalog.packages[0]!;

  // The fleet that is actually here, narrowed to the ones this service suits
  // and the ones allowed to travel to this city (§6).
  const cars = filterCars(
    catalog,
    { ...DEFAULT_FILTERS, city: city.slug, occasion: service.occasionSlug },
    pkg,
    { wantedCity: city.slug },
  ).slice(0, 4);

  const based = carsBasedIn(catalog, city);
  const pickups = pickupPointsIn(catalog, city);
  const fares = cityRouteFares(catalog, city).slice(0, 6);
  const from = cityFromPrice(catalog, city);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${service.name} in ${city.name}`,
    serviceType: service.name,
    description: service.blurb,
    provider: { "@type": "AutoRental", name: "Xotic Car Rental", url: siteUrl() },
    areaServed: { "@type": "City", name: city.name, address: { "@type": "PostalAddress", addressRegion: city.state } },
    ...(from
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: from,
            description: `${pkg.label}, including the driver's allowance and GST`,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="on-dark relative isolate flex min-h-[340px] items-end overflow-hidden">
        <Media
          src={city.heroImage}
          alt=""
          placeholder={`${city.name} photo`}
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
              "linear-gradient(180deg, rgb(0 0 0 / 0.45) 0%, rgb(0 0 0 / 0.2) 45%, rgb(0 0 0 / 0.75) 100%)",
          }}
        />
        <div className="mx-auto w-full max-w-[1180px] px-4 pt-[calc(var(--header-height)+32px)] pb-9 sm:px-6">
          <p className="text-[12px] opacity-90">
            <Link href="/services" className="text-inherit no-underline">
              Services
            </Link>{" "}
            /{" "}
            <Link href={`/services/${service.slug}`} className="text-inherit no-underline">
              {service.short}
            </Link>{" "}
            / {city.name}
          </p>
          <h1 className="mt-2 max-w-[20ch] font-[family-name:var(--font-heading)] text-[30px] leading-[1.08] sm:text-[40px]">
            {service.name} in {city.name}
          </h1>
          <p className="mt-3 max-w-[58ch] text-[15px] opacity-90">{service.blurb}</p>

          <div className="mt-4 flex flex-wrap gap-6 text-[13px]">
            {from && (
              <span>
                <strong className="font-[family-name:var(--font-heading)] text-[17px]">
                  {formatINR(from)}
                </strong>{" "}
                from, {pkg.label}
              </span>
            )}
            <span>
              <strong className="font-[family-name:var(--font-heading)] text-[17px]">
                {based.length}
              </strong>{" "}
              {based.length === 1 ? "car" : "cars"} based here
            </span>
            <span>
              <strong className="font-[family-name:var(--font-heading)] text-[17px]">
                {pickups.length}
              </strong>{" "}
              pickup {pickups.length === 1 ? "point" : "points"}
            </span>
          </div>
        </div>
      </section>

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

            {/* The half of this page that only exists because it is about a
                city: what the rate is here, and where the car would meet you. */}
            <h2 className="h2 mt-9 mb-3">Rates in {city.name}</h2>
            <p className="mb-4 max-w-[62ch] text-[13px] text-[var(--color-neutral-400)]">
              {city.name} runs at ×{city.multiplier.toFixed(2)} on the shared rate card, and the
              distance is measured from the yard the car actually leaves — out to you and back
              afterwards. Extra kilometres, the driver&rsquo;s allowance and the night charge are
              the car&rsquo;s own rates and carry no multiplier.
            </p>

            {fares.length > 0 && (
              <ul className="m-0 list-none p-0">
                {fares.map((fare) => (
                  <li key={fare.name}>
                    <Link
                      href={`/price-calculator?from=${fare.fromSlug}&to=${fare.toSlug}&pkg=${fare.packageSlug}&trip=round&occ=${service.occasionSlug}`}
                      className="flex items-baseline justify-between gap-4 border-b border-[var(--color-divider)] py-2 text-[13px] text-[var(--color-neutral-300)] no-underline"
                    >
                      <span className="text-[var(--color-text)]">{fare.name}</span>
                      <span className="text-[11px] whitespace-nowrap text-[var(--color-neutral-500)]">
                        {fare.km} km · from {formatINR(fare.price)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {pickups.length > 0 && (
              <>
                <h2 className="h2 mt-9 mb-3">Where we pick up in {city.name}</h2>
                <div className="flex flex-wrap gap-2">
                  {pickups.map((point) => (
                    <span
                      key={point.slug}
                      className="rounded-full border border-[var(--color-divider)] px-3 py-1 text-[12px] text-[var(--color-neutral-300)]"
                    >
                      {point.name}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div id="enquiry" className="scroll-mt-[calc(var(--header-height)+16px)]">
            <ServiceEnquiryForm service={service} />
          </div>
        </div>
      </section>

      {cars.length > 0 && (
        <section className="sec">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="h2">
              {service.short} cars in {city.name}
            </h2>
            <Link href={`/cars?city=${city.slug}`} className="btn btn-ghost">
              Every car in {city.name}
              <Icon name="ph-arrow-right" size={15} />
            </Link>
          </div>
          <div className="grid-4">
            {cars.map((car) => (
              <CarCard key={car.slug} car={car} catalog={catalog} pkg={pkg} />
            ))}
          </div>
        </section>
      )}

      <section className="sec">
        <h2 className="h2 mb-1">{service.short} elsewhere</h2>
        <p className="mb-4 text-[13px] text-[var(--color-neutral-400)]">
          The same service, priced at each city&rsquo;s own rate.
        </p>
        <div className="flex flex-wrap gap-2">
          {catalog.cities
            .filter((item) => item.slug !== city.slug)
            .map((item) => (
              <Link
                key={item.slug}
                href={`/services/${service.slug}/${item.slug}`}
                className="rounded-full border border-[var(--color-divider)] px-3 py-1.5 text-[13px] text-[var(--color-text)] no-underline hover:border-[var(--color-accent-solid)]"
              >
                {service.short} in {item.name}
              </Link>
            ))}
        </div>

        <p className="mt-6 text-[13px] text-[var(--color-neutral-400)]">
          Or another service in {city.name}:{" "}
          {SERVICES.filter((item) => item.slug !== service.slug)
            .slice(0, 6)
            .map((item, index) => (
              <span key={item.slug}>
                {index > 0 && ", "}
                <Link href={`/services/${item.slug}/${city.slug}`}>{item.short.toLowerCase()}</Link>
              </span>
            ))}
          .
        </p>
      </section>

      {occasion && occasion.surcharge > 0 && (
        <section className="sec sec-tight">
          <p className="text-[13px] text-[var(--color-neutral-400)]">
            {occasion.name} bookings carry a {formatINR(occasion.surcharge)} handling charge —{" "}
            {occasion.handlingNote.toLowerCase()} — shown on its own line in the quote.
          </p>
        </section>
      )}
    </>
  );
}
