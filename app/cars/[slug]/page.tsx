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
import { CheckAvailability } from "@/components/car/CheckAvailability";
import { PackageSelectionProvider } from "@/components/car/PackageSelection";
import { BreadcrumbJsonLd, CarJsonLd, FaqJsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { ResponsiveDisclosure } from "@/components/ui/ResponsiveDisclosure";
import { VehicleGallery } from "@/components/car/VehicleGallery";
import styles from "@/components/car/CarDetail.module.css";
import {
  homeCity,
  servesCity,
  similarCars,
  tripDefaults,
} from "@/lib/catalog";
import { getCatalog } from "@/lib/content";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { formatINR } from "@/lib/format";
import { businessDate } from "@/lib/dates";
import { rateFor } from "@/lib/pricing";
import { carFaq } from "@/lib/faq";
import { tripToParams } from "@/lib/quote";
import { carEnquiryMessage } from "@/lib/whatsapp";


const PANEL_CLASSES: Record<string, string> = styles;

export const revalidate = 3600;

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.cars.slice(0, 100).map((car) => ({ slug: car.slug }));
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
  ];

  const enquiryMessage = carEnquiryMessage(car, city, catalog.packages[0]);
  const faq = carFaq(catalog, car);
  const today = businessDate();

  const bookingProps = {
    car,
    city,
    whatsappNumber: catalog.settings.whatsappNumber,
    gstPercent: catalog.settings.gstPercent,
    calculatorParams: calculatorParams.toString(),
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

      <div className={styles.surface}><div className={styles.page}>
        <p className={styles.breadcrumb}><Link href="/">Home</Link> / <Link href="/cars">Browse cars</Link> / {car.name}</p>
        <header className={styles.heading}>
          <div>
            <div className={styles.eyebrow}>{car.type} · {car.year} · With chauffeur</div>
            <h1>{car.name}</h1>
            <p>Home city {city.name}, {city.state}</p>
            <ul className={styles.mobileSpecs} aria-label="Key vehicle specifications">{specs.map((spec) => <li key={spec.label}><Icon name={spec.icon} size={14} /><span>{spec.value}</span></li>)}</ul>
          </div>
          <div className={styles.tags}>{catalog.occasions.filter((occasion) => car.occasions.includes(occasion.slug)).map((occasion) => <span key={occasion.slug}>{occasion.name}</span>)}</div>
        </header>

        <nav className={styles.sectionNav} aria-label="Vehicle details">
          <a href="#rate-card">Packages &amp; rates</a>
          <a href="#vehicle-availability">Availability</a>
          <a href="#vehicle-inclusions">What&rsquo;s included</a>
          <a href="#vehicle-questions">Questions</a>
        </nav>

        <div className={styles.layout}>
          <div className={styles.showcase}><VehicleGallery images={car.images} name={car.name} /></div>
          <CarBookingPanel {...bookingProps} />
          <div className={styles.details}>
            <div className={styles.specs}>
              {specs.map((spec) => <div key={spec.label}><Icon name={spec.icon} size={22} color="var(--color-accent-text)" /><p>{spec.label}</p><strong>{spec.value}</strong></div>)}
            </div>
            <RateCard car={car} cities={catalog.cities.filter((item) => servesCity(car, item.slug))} packages={catalog.packages} settings={catalog.settings} homeCitySlug={city.slug} occasions={catalog.occasions.filter((occasion) => car.occasions.includes(occasion.slug))} />

            <div id="vehicle-availability" className={styles.jumpTarget} tabIndex={-1}><CheckAvailability carSlug={car.slug} today={today} /></div>

            <ResponsiveDisclosure title="What’s included" id="vehicle-inclusions" hideTitleOnDesktop className={styles.inclusionsDisclosure}>
            <div className={styles.inclusions}>
              <div><h3>Included</h3>{catalog.settings.inclusions.map((item) => <p key={item}><Icon name="ph-check" size={15} color="var(--color-accent-text)" />{item}</p>)}</div>
              <div><h3>Not included</h3>{catalog.settings.exclusions.map((item) => <p key={item}><Icon name="ph-minus" size={15} />{item}</p>)}</div>
            </div>
            <div className={styles.chauffeurNote}><Icon name="ph-user-circle-check" size={24} /><div><h3>Make the journey yours</h3><p>Share your language, timing and accessibility requirements when enquiring.</p></div></div>
            <div className={styles.mobileOccasions}><h3>Available for</h3><div className={styles.tags}>{catalog.occasions.filter((occasion) => car.occasions.includes(occasion.slug)).map((occasion) => <span key={occasion.slug}>{occasion.name}</span>)}</div></div>
            </ResponsiveDisclosure>

            <ResponsiveDisclosure title="What can change your price" className={styles.contentSection}>
              <ChargesExplained settings={catalog.settings} car={car} kicker={null} heading={null} />
            </ResponsiveDisclosure>
            <ResponsiveDisclosure title="Before you message us" className={styles.contentSection}>
              <MessagePreview message={enquiryMessage} />
            </ResponsiveDisclosure>
            <ResponsiveDisclosure title="Questions" id="vehicle-questions" className={styles.contentSection}><FaqBlock items={faq} /></ResponsiveDisclosure>
          </div>
        </div>

        <ResponsiveDisclosure title="Similar cars" className={styles.similar}>
          <div className={styles.similarGrid}>{similarCars(catalog, car).map((similar) => <CarCard key={similar.slug} catalog={catalog} car={similar} pkg={catalog.packages[0]} />)}</div>
        </ResponsiveDisclosure>
      </div></div>

      <CarStickyBar {...bookingProps} />
    </PackageSelectionProvider>
  );
}
