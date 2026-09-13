import Link from "next/link";
import styles from "./CarCard.module.css";

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

/** Image-led catalog card. Pricing and navigation retain the selected journey. */
export function CarCard({
  catalog,
  car,
  pkg,
  variant = "full",
  priority = false,
  citySlug,
  journeyQuery = "",
}: CarCardProps) {
  const baseCity = homeCity(catalog, car);
  const city = citySlug
    ? (catalog.cities.find((c) => c.slug === citySlug) ?? baseCity)
    : baseCity;
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

  return (
    <article className={variant === "compact" ? `${styles.card} ${styles.compact}` : styles.card}>
      <Link href={href} prefetch={false} className={styles.photo} aria-label={`Explore ${car.name}`}>
        <Media src={image} alt={car.name} placeholder={car.name} priority={priority}
          className={styles.image} sizes={variant === "compact" ? "140px" : "(max-width: 639px) 100vw, (max-width: 1199px) 50vw, 33vw"} />
        {car.badge && <div className={styles.imageTop}><span className={styles.badge}>{car.badge}</span></div>}
        <span className={styles.location}><Icon name="ph-map-pin" size={13} />{city.slug === baseCity.slug ? "Based in" : "Serves"} {city.name}</span>
      </Link>
      <div className={styles.body}>
        <p className={styles.category}>{car.type}<span>{car.year} · With chauffeur</span></p>
        <h3 className={styles.name}><Link href={href} prefetch={false}>{car.name}</Link></h3>
        <ul className={styles.specs}>
          <li><Icon name="ph-users-three" size={15} />{car.seats} seats</li>
          <li><Icon name="ph-gear-six" size={15} />{car.transmission}</li>
          <li><Icon name="ph-gas-pump" size={15} />{car.fuel}</li>
        </ul>
        <div className={styles.pricing}>
          <span className={styles.package}><small>Base rate in {baseCity.name}</small>{pkg.label}</span>
          <span className={styles.amount}>{price}</span>
        </div>
        <p className={styles.extras}><span>Extra km {formatINR(car.extraKmRate)}/km</span><span>Driver bata {formatINR(car.bata)}/day</span></p>
        <p className={styles.priceNote}>{catalog.settings.gstPercent}% GST and journey extras additional.</p>
        <div className={styles.actions}>
          <Link href={href} prefetch={false} className={styles.details}><span>Price &amp; details</span><Icon name="ph-arrow-right" size={17} /></Link>
          <a className={styles.enquire} href={waHref} target="_blank" rel="noopener noreferrer" aria-label={`Enquire about the ${car.name} on WhatsApp`}><Icon name="ph-whatsapp-logo" size={20} /></a>
        </div>
      </div>
    </article>
  );
}
