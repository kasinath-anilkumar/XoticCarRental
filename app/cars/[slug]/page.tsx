import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CarCard } from "@/components/CarCard";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { FaqBlock } from "@/components/content/FaqBlock";
import { RateCard } from "@/components/car/RateCard";
import { MessagePreview } from "@/components/quote/MessagePreview";
import { ChargesExplained } from "@/components/trust/ChargesExplained";
import { CarBookingPanel, CarStickyBar } from "@/components/car/CarBookingPanel";
import { PackageSelectionProvider } from "@/components/car/PackageSelection";
import { BreadcrumbJsonLd, CarJsonLd, FaqJsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { Media } from "@/components/ui/Media";
import {
  galleryImages,
  heroImage,
  homeCity,
  occasionBySlug,
  similarCars,
  tripDefaults,
} from "@/lib/catalog";
import { getCatalog } from "@/lib/content";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { formatINR } from "@/lib/format";
import { rateFor } from "@/lib/pricing";
import { carFaq } from "@/lib/faq";
import { resolveQuote, tripToParams } from "@/lib/quote";


/**
 * The booking panel's classes.
 *
 * They live here rather than inside the panel because the panel is a client
 * component rendered from two places, and one map keeps both call sites and the
 * mobile bar in step.
 */
const PANEL_CLASSES: Record<string, string> = {
  panel: "sticky top-[90px] rounded-lg bg-surface p-8 shadow-[var(--shadow-md)] max-lg:static max-md:mt-8 max-md:p-6",
  panelKicker: "text-[12px] text-[var(--color-neutral-500)]",
  panelPriceRow: "flex items-baseline gap-3",
  panelPrice: "font-[family-name:var(--font-heading)] text-[36px] text-[var(--color-accent-300)] max-md:text-[28px]",
  panelUnit: "text-[12px] text-[var(--color-neutral-500)]",
  panelExtras: "mt-2 text-[12px] text-[var(--color-neutral-400)]",
  packageGroup: "my-6",
  packageLabel: "mb-3 text-[11px] tracking-[0.1em] uppercase text-[var(--color-neutral-500)]",
  packageList: "flex flex-col gap-2",
  packageOption: "flex items-center justify-between gap-4 rounded-md border p-4 text-left text-text no-underline",
  packageOptionIdle: "border-[var(--color-divider)] bg-well hover:border-[var(--color-accent)]",
  packageOptionActive: "border-[var(--color-accent)] bg-[var(--color-accent-900)]",
  packageName: "block font-[family-name:var(--font-heading)] text-[14px]",
  packageSub: "text-[11px] text-[var(--color-neutral-500)]",
  packagePrice: "font-[family-name:var(--font-heading)] text-[16px] text-[var(--color-neutral-300)]",
  packagePriceActive: "font-[family-name:var(--font-heading)] text-[16px] text-[var(--color-accent-300)]",
  reply: "mt-4 flex items-center justify-center gap-2 text-[11px] text-[var(--color-neutral-500)]",
  driver: "mt-6 flex items-center gap-4 border-t border-[var(--color-divider)] pt-6 max-md:hidden",
  driverAvatar: "size-[44px] flex-none rounded-full",
  driverTitle: "font-[family-name:var(--font-heading)] text-[13px]",
  driverBody: "text-[11px] text-[var(--color-neutral-500)]",
  stickyPrice: "flex-1",
  stickyPriceValue: "font-[family-name:var(--font-heading)] text-[19px] text-[var(--color-accent-300)]",
  stickyPriceUnit: "block text-[10px] text-[var(--color-neutral-500)]",
  stickyBar: "hidden max-md:flex",
};

export const revalidate = 3600;

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.cars.map((car) => ({ slug: car.slug }));
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getCatalog();
  const car = catalog.cars.find((c) => c.slug === slug);
  if (!car) return { title: "Car not found" };
  if (!isPricingAvailable(catalog)) {
    return { title: `${car.name} with a driver`, alternates: { canonical: `/cars/${car.slug}` } };
  }

  const city = homeCity(catalog, car);
  const from = formatINR(rateFor(car, catalog.packages[0].rateKey) * city.multiplier);

  return {
    title: `${car.name} with driver in ${city.name}`,
    description: `Hire a ${car.year} ${car.name} with a chauffeur in ${city.name}. From ${from} for the ${catalog.packages[0].label} package, plus ${formatINR(car.extraKmRate)}/km beyond it. Itemised quote before you book.`,
    alternates: { canonical: `/cars/${car.slug}` },
  };
}

export default async function CarDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const catalog = await getCatalog();

  const car = catalog.cars.find((c) => c.slug === slug);
  if (!car) notFound();
  if (!isPricingAvailable(catalog)) {
    return <section className="sec"><h1 className="mb-6">{car.name} with a driver</h1><PricingUnavailable /></section>;
  }

  const city = homeCity(catalog, car);

  // The trip the calculator opens with, minus the date (filled in at request
  // time there) and minus the package, which the booking panel appends from
  // whatever the visitor has selected.
  const calculatorParams = tripToParams({ ...tripDefaults(catalog, ""), carSlug: car.slug });
  calculatorParams.delete("date");
  calculatorParams.delete("pkg");

  const specs = [
    { icon: "ph-users-three", label: "Seating", value: `${car.seats} + driver` },
    { icon: "ph-gear-six", label: "Transmission", value: car.transmission },
    { icon: "ph-gas-pump", label: "Fuel", value: car.fuel },
    {
      icon: "ph-suitcase-rolling",
      label: "Luggage",
      value: car.seats > 7 ? "8 bags" : car.seats > 4 ? "4 bags" : "2 bags",
    },
  ];

  const weddingSurcharge = occasionBySlug(catalog, "wedding").surcharge;

  // A representative local trip in this car, so the message preview and the
  // FAQ quote figures that came out of the real engine rather than prose.
  const sampleQuote = resolveQuote(catalog, {
    ...tripDefaults(catalog, "2026-01-01"),
    carSlug: car.slug,
  });
  const faq = carFaq(catalog, car);

  const bookingProps = {
    car,
    city,
    whatsappNumber: catalog.settings.whatsappNumber,
    calculatorParams: calculatorParams.toString(),
    // The availability check needs a floor for its date field, and the server's
    // day is the one the calendar is written in.
    today: new Date().toISOString().slice(0, 10),
    styles: PANEL_CLASSES,
  };

  return (
    <PackageSelectionProvider packages={catalog.packages}>
      <CarJsonLd
        car={car}
        city={city}
        pkg={catalog.packages[0]}
        images={car.images.map((image) => image.url)}
      />
      <FaqJsonLd items={faq} />
      <BreadcrumbJsonLd
        trail={[
          { name: "Home", path: "/" },
          { name: "Browse cars", path: "/cars" },
          { name: car.name, path: `/cars/${car.slug}` },
        ]}
      />

      <div className="px-[var(--gutter-desktop)] pt-12 pb-[56px] max-md:px-[var(--gutter-mobile)] max-md:pt-6 max-md:pb-0">
        <p className="mb-6 text-[12px] text-[var(--color-neutral-600)] [&_a]:text-inherit [&_a]:no-underline [&_a:hover]:text-[var(--color-accent-300)]">
          <Link href="/">Home</Link> / <Link href="/cars">Browse cars</Link> /{" "}
          <span className="text-[var(--color-neutral-300)]">{car.name}</span>
        </p>

        <div className="grid grid-cols-[1fr_400px] items-start gap-12 max-lg:grid-cols-1">
          <div>
            <Media
              src={heroImage(car)}
              alt={car.name}
              placeholder={`Drop ${car.name} photo`}
              className="h-[420px] rounded-lg max-lg:h-[340px] max-md:h-[210px] max-md:rounded-md"
              priority
              sizes="(max-width: 1023px) 100vw, 60vw"
            />
            <div className="mt-4 grid grid-cols-[repeat(3,1fr)] gap-4 max-md:gap-2">
              {galleryImages(car).map((image) => (
                <Media
                  key={image.label}
                  src={image.url}
                  alt={`${car.name} — ${image.label.toLowerCase()}`}
                  placeholder={image.label}
                  className="h-[104px] rounded-md max-md:h-[60px]"
                  sizes="200px"
                />
              ))}
            </div>

            <div className="mt-12 flex flex-wrap items-start justify-between gap-8 max-md:mt-6 max-md:gap-3">
              <div>
                <h1 className="mb-2 text-[36px] max-md:text-[24px]">{car.name}</h1>
                <p className="text-[13px] text-[var(--color-neutral-500)]">
                  {car.year} · {car.type} · Home city {city.name}, {city.state}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2 max-md:justify-start">
                {car.occasions.map((occasionSlug) => (
                  <span key={occasionSlug} className="tag tag-outline">
                    {occasionBySlug(catalog, occasionSlug).name}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-[repeat(4,1fr)] gap-4 max-lg:grid-cols-[repeat(2,1fr)] max-md:mt-6 max-md:gap-2">
              {specs.map((spec) => (
                <div key={spec.label} className="rounded-md bg-surface p-4">
                  <Icon name={spec.icon} size={20} color="var(--color-accent)" />
                  <p className="mt-2 text-[11px] text-[var(--color-neutral-500)]">{spec.label}</p>
                  <p className="font-[family-name:var(--font-heading)] text-[15px]">{spec.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 mb-4 max-md:mt-8 max-md:mb-3 max-md:text-[19px]">
              <RateCard
                car={car}
                cities={catalog.cities}
                packages={catalog.packages}
                settings={catalog.settings}
                homeCitySlug={city.slug}
                weddingSurcharge={weddingSurcharge}
              />
            </div>

            <div className="mt-12 grid grid-cols-[1fr_1fr] gap-8 max-md:mt-8 max-md:grid-cols-1 max-md:gap-6">
              <div>
                <h3 style={{ marginBottom: "8.4px", fontSize: "20px" }}>Included</h3>
                {catalog.settings.inclusions.map((item) => (
                  <p key={item} className="flex gap-3 py-[4px] text-[13px] text-[var(--color-neutral-300)]">
                    <Icon name="ph-check" size={16} color="var(--color-accent)" />
                    {item}
                  </p>
                ))}
              </div>
              <div>
                <h3 style={{ marginBottom: "8.4px", fontSize: "20px" }}>Not included</h3>
                {catalog.settings.exclusions.map((item) => (
                  <p key={item} className="flex gap-3 py-[4px] text-[13px] text-[var(--color-neutral-400)]">
                    <Icon name="ph-minus" size={16} color="var(--color-neutral-600)" />
                    {item}
                  </p>
                ))}
              </div>
            </div>

            <h2 className="mt-12 mb-4 max-md:mt-8 max-md:mb-3 max-md:text-[19px]">What can change your price</h2>
            <ChargesExplained
              settings={catalog.settings}
              car={car}
              kicker={null}
              heading={null}
            />

            <h2 className="mt-12 mb-4 max-md:mt-8 max-md:mb-3 max-md:text-[19px]">Before you message us</h2>
            <MessagePreview message={sampleQuote.message} defaultOpen />

            <h2 className="mt-12 mb-4 max-md:mt-8 max-md:mb-3 max-md:text-[19px]">Questions</h2>
            <FaqBlock items={faq} />

            <h2 className="mt-12 mb-4 max-md:mt-8 max-md:mb-3 max-md:text-[19px]">Similar cars</h2>
            <div className="grid-cars-3">
              {similarCars(catalog, car).map((similar) => (
                <CarCard
                  key={similar.slug}
                  catalog={catalog}
                  car={similar}
                  pkg={catalog.packages[0]}
                />
              ))}
            </div>
          </div>

          <CarBookingPanel {...bookingProps} />
        </div>
      </div>

      <CarStickyBar {...bookingProps} />
    </PackageSelectionProvider>
  );
}
