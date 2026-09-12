"use client";

import { Icon } from "@/components/ui/Icon";
import { Media } from "@/components/ui/Media";
import { formatINR } from "@/lib/format";
import { rateFor } from "@/lib/pricing";
import type { Car, City, Package } from "@/lib/types";
import { carEnquiryMessage, whatsappLink } from "@/lib/whatsapp";

import { CheckAvailability } from "./CheckAvailability";
import { JourneyCalculatorLink } from "./JourneyCalculatorLink";
import { usePackageSelection } from "./PackageSelection";

export interface CarBookingProps {
  /** Today, from the server — a client clock can be anything at all. */
  today: string;
  car: Car;
  city: City;
  whatsappNumber: string;
  /** Query string for the calculator, without the package. */
  calculatorParams: string;
  styles: Record<string, string>;
}

function priceFor(car: Car, city: City, pkg: Package): number {
  return rateFor(car, pkg.rateKey) * city.multiplier;
}

export function CarBookingPanel({
  car,
  city,
  whatsappNumber,
  calculatorParams,
  styles,
  today,
}: CarBookingProps) {
  const { packages, selected, select } = usePackageSelection();
  const waHref = whatsappLink(whatsappNumber, carEnquiryMessage(car, city, selected));

  return (
    <aside className={styles.panel}>
      <p className={styles.panelKicker}>Starts from</p>
      <p className={styles.panelPriceRow}>
        <span className={styles.panelPrice}>{formatINR(priceFor(car, city, selected))}</span>
        <span className={styles.panelUnit}>/ {selected.label}</span>
      </p>
      <p className={styles.panelExtras}>
        + {formatINR(car.extraKmRate)}/km and {formatINR(car.extraHrRate)}/hr beyond the package
      </p>

      <div className={styles.packageGroup}>
        <p className={styles.packageLabel}>Choose a package</p>
        <div className={styles.packageList}>
          {packages.map((pkg) => {
            const active = pkg.slug === selected.slug;
            return (
              <button
                key={pkg.slug}
                type="button"
                onClick={() => select(pkg.slug)}
                aria-pressed={active}
                className={`${styles.packageOption} ${
                  active ? styles.packageOptionActive : styles.packageOptionIdle
                }`}
              >
                <span>
                  <span className={styles.packageName}>{pkg.label}</span>
                  <span className={styles.packageSub}>{pkg.sub}</span>
                </span>
                <span
                  className={active ? styles.packagePriceActive : styles.packagePrice}
                >
                  {formatINR(priceFor(car, city, pkg))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <JourneyCalculatorLink
        params={calculatorParams}
        packageSlug={selected.slug}
        className="btn btn-primary btn-block"
        style={{ minHeight: "44px" }}
      >
        <Icon name="ph-calculator" size={17} />
        Get exact price for my route
      </JourneyCalculatorLink>
      <a
        className="btn wa btn-block"
        style={{ minHeight: "44px" }}
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon name="ph-whatsapp-logo" size={18} />
        Enquire on WhatsApp
      </a>

      <p className={styles.reply}>
        <Icon name="ph-lightning" size={14} color="var(--color-accent)" />
        Contact our team to confirm availability
      </p>

      {/* §20 — the question a customer looking at one car actually has. */}
      <CheckAvailability carSlug={car.slug} today={today} />

      <div className={styles.driver}>
        <Media
          src={null}
          alt=""
          placeholder="Driver"
          className={styles.driverAvatar}
          icon="ph-user-circle-check"
          sizes="44px"
        />
        <div>
          <p className={styles.driverTitle}>Chauffeur arrangements</p>
          <p className={styles.driverBody}>
            Share your language, timing and accessibility requirements when enquiring.
          </p>
        </div>
      </div>
    </aside>
  );
}

/** The mobile action bar. Shares the panel's package selection. */
export function CarStickyBar({
  car,
  city,
  whatsappNumber,
  calculatorParams,
  styles,
}: CarBookingProps) {
  const { selected } = usePackageSelection();
  const waHref = whatsappLink(whatsappNumber, carEnquiryMessage(car, city, selected));

  return (
    <div className={`stickybar ${styles.stickyBar}`}>
      <div className={styles.stickyPrice}>
        <span className={styles.stickyPriceValue}>
          {formatINR(priceFor(car, city, selected))}
        </span>
        <span className={styles.stickyPriceUnit}>/ {selected.label}</span>
      </div>
      <JourneyCalculatorLink
        params={calculatorParams}
        packageSlug={selected.slug}
        className="btn btn-primary"
        style={{ minHeight: "44px" }}
      >
        Exact price
      </JourneyCalculatorLink>
      <a
        className="btn wa"
        style={{ minHeight: "44px" }}
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Enquire about the ${car.name} on WhatsApp`}
      >
        <Icon name="ph-whatsapp-logo" size={18} />
      </a>
    </div>
  );
}
