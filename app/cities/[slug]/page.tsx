import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CarCard } from "@/components/CarCard";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { FaqBlock } from "@/components/content/FaqBlock";
import { BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/JsonLd";
import { ChargesExplained } from "@/components/trust/ChargesExplained";
import { Icon } from "@/components/ui/Icon";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { Media } from "@/components/ui/Media";
import {
  airportFor,
  carsBasedIn,
  carsForCity,
  cityFromPrice,
  cityRouteFares,
  pickupPointsIn,
} from "@/lib/catalog";
import { getCatalog } from "@/lib/content";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { getServices } from "@/lib/service-content";
import { cityFaq } from "@/lib/faq";
import { formatINR } from "@/lib/format";
import { rateFor } from "@/lib/pricing";
import { whatsappLink } from "@/lib/whatsapp";


export const revalidate = 3600;

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.cities.slice(0, 100).map((city) => ({ slug: city.slug }));
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getCatalog();
  const city = catalog.cities.find((c) => c.slug === slug);
  if (!city) return { title: "City not found" };

  const from = isPricingAvailable(catalog) ? cityFromPrice(catalog, city) : null;
  return {
    title: city.seoTitle ?? `Car rental with driver in ${city.name}`,
    description:
      city.seoDescription ??
      `Chauffeur-driven cars in ${city.name}, ${city.state}${from ? ` from ${formatINR(from)} for ${catalog.packages[0].label}` : ""}. Published fares, itemised before you book.`,
    alternates: { canonical: `/cities/${city.slug}` },
  };
}

export default async function CityPage({ params }: { params: Params }) {
  const { slug } = await params;
  const catalog = await getCatalog();

  const city = catalog.cities.find((c) => c.slug === slug);
  if (!city) notFound();
  if (!isPricingAvailable(catalog)) {
    return <section className="sec"><h1 className="mb-6">Cars with a driver in {city.name}</h1><PricingUnavailable /></section>;
  }

  const fares = cityRouteFares(catalog, city);
  const based = carsBasedIn(catalog, city);
  const fleet = carsForCity(catalog, city);
  const airport = airportFor(catalog, city);
  const pickups = pickupPointsIn(catalog, city);
  const fromPrice = cityFromPrice(catalog, city);
  const faq = cityFaq(catalog, city);
  const defaultPackage = catalog.packages[0];
  const services = await getServices();

  const waHref = whatsappLink(
    catalog.settings.whatsappNumber,
    `Hi Xotic, I would like to enquire about a car with driver in ${city.name}.`,
  );

  const calculatorFor = (fromSlug: string, toSlug: string, packageSlug: string) =>
    `/price-calculator?from=${fromSlug}&to=${toSlug}&pkg=${packageSlug}&trip=round`;

  return (
    <>
      <FaqJsonLd items={faq} />
      <BreadcrumbJsonLd
        trail={[
          { name: "Home", path: "/" },
          { name: "Cities", path: "/cities" },
          { name: city.name, path: `/cities/${city.slug}` },
        ]}
      />

      {/* ── hero ──────────────────────────────────────────────────────── */}
      <section className="on-dark relative min-h-[calc(420px+var(--header-height))] bg-bg max-lg:h-auto max-lg:min-h-[calc(340px+var(--header-height))] max-md:min-h-[calc(300px+var(--header-height))]">
        <Media
          src={city.heroImage}
          alt=""
          placeholder={`Drop a ${city.name} photo`}
          lighten
          priority
          className="absolute inset-0 bg-transparent"
          icon="ph-map-pin"
          sizes="100vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(95deg,var(--color-bg)_18%,rgb(var(--color-bg-rgb)/0.78)_60%,rgb(var(--color-bg-rgb)/0.12))] max-md:bg-[linear-gradient(180deg,rgb(var(--color-bg-rgb)/0.52),rgb(var(--color-bg-rgb)/0.96))]" />
        <div className="pointer-events-none relative flex min-h-[calc(420px+var(--header-height))] flex-col justify-center px-[var(--gutter-desktop)] pt-[calc(44.8px+var(--header-height))] pb-[44.8px] max-md:justify-end max-md:px-[var(--gutter-mobile)] max-md:pt-[calc(20px+var(--header-height))] max-md:pb-[20px]">
          <p className="pointer-events-auto mt-0 mb-4 text-[12px] text-[var(--color-neutral-400)] [&_a]:text-inherit [&_a]:no-underline [&_a:hover]:text-[var(--color-accent-300)]">
            <Link href="/">Home</Link> / <Link href="/cities">Cities</Link> / {city.name}
          </p>
          <p className="kick">Car rental with driver</p>
          <h1 className="mt-0 mb-[4px] max-w-[18ch] text-[42px] max-lg:text-[32px] max-md:text-[25px]">Chauffeur-driven car rental in {city.name}</h1>
          <p className="mt-0 mb-6 text-[14px] text-[var(--color-neutral-400)]">{city.state}</p>

          <div className="mb-8 flex flex-wrap gap-8 text-[13px] text-[var(--color-neutral-300)] max-md:mb-6 max-md:gap-4 max-md:text-[12px]">
            {fromPrice && (
              <span className="inline-flex items-center gap-[6px] [&_strong]:font-[family-name:var(--font-heading)] [&_strong]:text-[17px] [&_strong]:text-text max-md:[&_strong]:text-[15px]">
                <strong>{formatINR(fromPrice)}</strong> from, for {defaultPackage.label}
              </span>
            )}
            <span className="inline-flex items-center gap-[6px] [&_strong]:font-[family-name:var(--font-heading)] [&_strong]:text-[17px] [&_strong]:text-text max-md:[&_strong]:text-[15px]">
              <strong>{based.length || catalog.cars.length}</strong> cars based here
            </span>
            <span className="inline-flex items-center gap-[6px] [&_strong]:font-[family-name:var(--font-heading)] [&_strong]:text-[17px] [&_strong]:text-text max-md:[&_strong]:text-[15px]">
              <strong>{pickups.length}</strong> pickup points
            </span>
            {airport && (
              <span className="inline-flex items-center gap-[6px] [&_strong]:font-[family-name:var(--font-heading)] [&_strong]:text-[17px] [&_strong]:text-text max-md:[&_strong]:text-[15px]">
                <Icon name="ph-airplane-tilt" size={14} /> {airport.name}
              </span>
            )}
          </div>

          <div className="pointer-events-auto flex flex-wrap gap-3 max-md:[&_.btn]:flex-1">
            <Link href="/price-calculator" className="btn btn-solid">
              <Icon name="ph-calculator" size={17} />
              Price my route
            </Link>
            <a className="btn wa" href={waHref} target="_blank" rel="noopener noreferrer">
              <Icon name="ph-whatsapp-logo" size={17} />
              Ask about {city.name}
            </a>
          </div>
        </div>
      </section>

      {/* ── city switcher rail ─────────────────────────────────────── */}
      <nav className="border-b border-[var(--color-divider)] px-[var(--gutter-desktop)] py-3.5 max-md:px-[var(--gutter-mobile)]" aria-label="Cities">
        <HorizontalScroll label="Cities" contentClassName="flex items-center gap-2 py-1">
        <span className="mr-1 text-[11.5px] uppercase tracking-wider text-[var(--color-neutral-500)] max-md:hidden">Hubs:</span>
        {catalog.cities.map((item) => {
          const active = item.slug === city.slug;
          return (
            <Link
              key={item.slug}
              href={`/cities/${item.slug}`}
              className={`rounded-md border px-3 py-1.5 text-[12.5px] whitespace-nowrap no-underline transition-colors max-md:inline-flex max-md:min-h-[40px] max-md:items-center max-md:px-3 ${active ? "border-[var(--color-accent)] bg-[var(--color-accent-800)] font-medium text-[var(--color-accent-100)] shadow-xs" : "border-[var(--color-divider)] bg-well/60 text-[var(--color-neutral-300)] hover:border-[var(--color-accent)] hover:text-text"}`}
              aria-current={active ? "page" : undefined}
            >
              {item.name}
            </Link>
          );
        })}
        </HorizontalScroll>
      </nav>

      {/* ── published fares ───────────────────────────────────────────── */}
      <section className="sec">
        <div className="sec-head">
          <div>
            <p className="kick">Published fares</p>
            <h2 className="h2">Routes from {city.name}</h2>
          </div>
          <Link href="/price-calculator" className="inline-flex items-center gap-2 text-[13px] whitespace-nowrap">
            Price a different route <Icon name="ph-arrow-right" size={14} />
          </Link>
        </div>

        {fares.length > 0 ? (
          <>
            <HorizontalScroll label="Route fares" controls="above">
              <table className="table">
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Distance</th>
                    <th>Drive</th>
                    <th>Package</th>
                    <th style={{ textAlign: "right" }}>From</th>
                    <th style={{ textAlign: "right" }}>5+ seats</th>
                  </tr>
                </thead>
                <tbody>
                  {fares.map((fare) => (
                    <tr key={fare.name}>
                      <td>
                        <Link
                          href={calculatorFor(fare.fromSlug, fare.toSlug, fare.packageSlug)}
                          className="border-b border-[var(--color-divider)] text-text no-underline hover:border-[var(--color-accent)] hover:text-accent-text"
                        >
                          {fare.name}
                        </Link>
                      </td>
                      <td className="text-[var(--color-neutral-400)]">{fare.km} km</td>
                      <td className="text-[var(--color-neutral-400)]">{fare.driveTime}</td>
                      <td className="text-[12px] text-[var(--color-neutral-400)]">{fare.packageLabel}</td>
                      <td className="text-right whitespace-nowrap text-[var(--color-accent-300)]">{formatINR(fare.price)}</td>
                      <td className="text-right whitespace-nowrap text-[var(--color-accent-300)]">
                        {fare.priceLarge ? formatINR(fare.priceLarge) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </HorizontalScroll>
            <p className="mt-4 max-w-[78ch] text-[12px] text-[var(--color-neutral-500)]">
              Round trip, cheapest car in each class, including the driver&rsquo;s bata and{" "}
              {catalog.settings.gstPercent}% GST. Tolls, parking and permits are at actuals. Tap a
              route to price it exactly.
            </p>
          </>
        ) : (
          <p className="text-[13px] text-[var(--color-neutral-500)]">
            No published routes for {city.name} yet — the calculator prices any route.
          </p>
        )}
      </section>

      {/* ── what a car costs here ─────────────────────────────────────── */}
      {based.length > 0 && (
        <section className="sec sec-tight">
          <p className="kick">The rate sheet</p>
          <h2 className="h2" style={{ marginBottom: "16.8px" }}>
            What a car costs in {city.name}
          </h2>

          <HorizontalScroll label="Vehicle rates" controls="above">
            <table className="table">
              <thead>
                <tr>
                  <th>Car</th>
                  <th>Seats</th>
                  {catalog.packages.map((pkg) => (
                    <th key={pkg.slug} style={{ textAlign: "right" }}>
                      {pkg.label}
                    </th>
                  ))}
                  <th style={{ textAlign: "right" }}>Extra km</th>
                  <th style={{ textAlign: "right" }}>Bata</th>
                </tr>
              </thead>
              <tbody>
                {based.map((car) => (
                  <tr key={car.slug}>
                    <td>
                      <Link href={`/cars/${car.slug}`} className="border-b border-[var(--color-divider)] text-text no-underline hover:border-[var(--color-accent)] hover:text-accent-text">
                        {car.name}
                      </Link>
                      <span className="block text-[11px] text-[var(--color-neutral-500)]">
                        {car.year} · {car.type}
                      </span>
                    </td>
                    <td className="text-[var(--color-neutral-400)]">{car.seats}</td>
                    {catalog.packages.map((pkg) => (
                      <td key={pkg.slug} className="text-right whitespace-nowrap text-[var(--color-accent-300)]">
                        {formatINR(rateFor(car, pkg.rateKey) * city.multiplier)}
                      </td>
                    ))}
                    <td className="text-[var(--color-neutral-400)]" style={{ textAlign: "right" }}>
                      {formatINR(car.extraKmRate)}
                    </td>
                    <td className="text-[var(--color-neutral-400)]" style={{ textAlign: "right" }}>
                      {formatINR(car.bata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </HorizontalScroll>
          <p className="mt-4 max-w-[78ch] text-[12px] text-[var(--color-neutral-500)]">
            Package rates carry {city.name}&rsquo;s ×{city.multiplier.toFixed(2)} operating
            multiplier. Extra km and bata are the car&rsquo;s own rates and are not multiplied.{" "}
            {catalog.settings.gstPercent}% GST applies to the total.
          </p>
        </section>
      )}

      {/* ── airport ───────────────────────────────────────────────────── */}
      {airport && (
        <section className="sec sec-tight">
          <div className="grid grid-cols-[1.2fr_1fr] items-start gap-12 max-lg:grid-cols-1 max-lg:gap-8">
            <div>
              <p className="kick">Airport transfers</p>
              <h2 className="h2" style={{ marginBottom: "11.2px" }}>
                Pickups at {airport.name}
              </h2>
              <p className="mb-6 max-w-[60ch] text-[14px] text-[var(--color-neutral-400)] [text-wrap:pretty]">
                Set {airport.name} as your pickup point in the calculator and the fare is worked out
                from there like any other route. A one-way drop from the airport carries the
                driver&rsquo;s return allowance — {catalog.settings.pricingRules.oneWayReturnPercent}% of the distance at the car&rsquo;s extra-km
                rate — shown as its own line before you send anything.
              </p>
              <Link href={`/price-calculator?from=${encodeURIComponent(airport.slug)}&trip=oneway`} className="btn btn-primary">
                <Icon name="ph-airplane-tilt" size={16} />
                Price an airport transfer
              </Link>
            </div>
            <div className="rounded-md bg-surface p-8 shadow-[var(--shadow-sm)]">
              <p className="mt-0 mb-4 font-[family-name:var(--font-heading)] text-[15px]">Pickup points in {city.name}</p>
              <ul className="m-0 flex list-none flex-col gap-[8px] p-0 text-[13px] text-[var(--color-neutral-300)] [&_li]:flex [&_li]:items-center [&_li]:gap-[8px]">
                {pickups.map((point) => (
                  <li key={point.slug}>
                    <Icon
                      name={point.isAirport ? "ph-airplane-tilt" : "ph-map-pin"}
                      size={14}
                      color="var(--color-accent)"
                    />
                    {point.name}
                  </li>
                ))}
              </ul>
              <p className="mt-6 mb-0 border-t border-[var(--color-divider)] pt-4 text-[12px] text-[var(--color-neutral-500)]">
                Not on the list? The calculator accepts any town or address in India.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── occasions here ────────────────────────────────────────────── */}
      <section className="sec sec-tight">
        <p className="kick">Why people book us</p>
        <h2 className="h2" style={{ marginBottom: "22.4px" }}>
          What a car in {city.name} gets used for
        </h2>
        <div className="grid-4">
          {catalog.occasions.map((occasion) => (
            <Link
              key={occasion.slug}
              href={services.some((service) => service.occasionSlug === occasion.slug)
                ? `/services/${services.find((service) => service.occasionSlug === occasion.slug)!.slug}/${city.slug}`
                : "/services"}
              className="block rounded-md bg-surface p-6 text-text no-underline shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]"
            >
              <Icon name={occasion.icon} size={22} color="var(--color-accent)" />
              <p className="mt-4 mb-[4px] font-[family-name:var(--font-heading)] text-[16px]">
                {occasion.name} in {city.name}
              </p>
              <p className="m-0 text-[12px] text-[var(--color-neutral-500)]">{occasion.tagline}</p>
              {occasion.surcharge > 0 && (
                <p className="mt-3 mb-0 text-[11px] text-accent-text">
                  +{formatINR(occasion.surcharge)} handling · {occasion.handlingNote}
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* ── fleet ─────────────────────────────────────────────────────── */}
      <section className="sec sec-tight">
        <div className="sec-head">
          <div>
            <p className="kick">Available here</p>
            <h2 className="h2">Cars in {city.name}</h2>
          </div>
          <Link href={`/cars?city=${city.slug}`} className="inline-flex items-center gap-2 text-[13px] whitespace-nowrap">
            Browse with filters <Icon name="ph-arrow-right" size={14} />
          </Link>
        </div>
        <div className="grid-cars">
          {fleet.map((car) => (
            <CarCard key={car.slug} catalog={catalog} car={car} pkg={defaultPackage} />
          ))}
        </div>
      </section>

      {/* ── charges ───────────────────────────────────────────────────── */}
      <section className="sec sec-tight">
        <ChargesExplained settings={catalog.settings} />
      </section>

      {/* ── faq ───────────────────────────────────────────────────────── */}
      <section className="sec sec-tight">
        <p className="kick">Questions</p>
        <h2 className="h2" style={{ marginBottom: "16.8px" }}>
          Booking a car in {city.name}
        </h2>
        <FaqBlock items={faq} />
      </section>

      <div className="stickybar hidden max-md:flex max-md:[&_.btn]:min-h-[44px] max-md:[&_.btn]:flex-1">
        <Link href="/price-calculator" className="btn btn-solid">
          <Icon name="ph-calculator" size={16} />
          Price a route
        </Link>
        <a className="btn wa" href={waHref} target="_blank" rel="noopener noreferrer">
          <Icon name="ph-whatsapp-logo" size={17} />
          WhatsApp
        </a>
      </div>
    </>
  );
}
