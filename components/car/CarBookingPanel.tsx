"use client";

import { useEffect, useId, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { formatINR } from "@/lib/format";
import { rateFor } from "@/lib/pricing";
import type { Car, City, Package } from "@/lib/types";
import { carEnquiryMessage, whatsappLink } from "@/lib/whatsapp";

import { JourneyCalculatorLink } from "./JourneyCalculatorLink";
import { usePackageSelection } from "./PackageSelection";

export interface CarBookingProps {
  car: Car;
  city: City;
  whatsappNumber: string;
  gstPercent: number;
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
  gstPercent,
}: CarBookingProps) {
  const { packages, selected, select } = usePackageSelection();
  const waHref = whatsappLink(whatsappNumber, carEnquiryMessage(car, city, selected));
  const packageId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    // A tall card can scroll up before sticking, keeping its actions reachable
    // on short screens. Observe content size only; native CSS handles scrolling.
    const measure = () => panel.style.setProperty("--booking-panel-height", `${panel.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel, { box: "border-box" });
    return () => observer.disconnect();
  }, []);

  return (
    <aside ref={panelRef} className={styles.panel} aria-label="Booking options">
      <div className={styles.panelHeading}>
        <h2 className={styles.panelKicker}>Starts from</h2>
        <span className={styles.panelCity}><Icon name="ph-map-pin" size={14} />{city.name}</span>
      </div>
      <output className={styles.panelPrice} aria-label="Starting package price">{formatINR(priceFor(car, city, selected))}</output>
      <p className={styles.panelUnit}>{selected.label} · Chauffeur driven</p>

      <div className={styles.packageGroup}>
        <label className={styles.packageLabel} htmlFor={packageId}>Booking package</label>
        <select id={packageId} className={styles.packageSelect} value={selected.slug} onChange={(event) => select(event.target.value)}>
          {packages.map((pkg) => <option key={pkg.slug} value={pkg.slug}>{pkg.label}</option>)}
        </select>
      </div>

      <p className={styles.panelExtras}>Base rate in {city.name}. Driver bata of {formatINR(car.bata)}/day, {gstPercent}% GST and journey extras are additional.</p>

      <div className={styles.panelActions}>
        <JourneyCalculatorLink
          params={calculatorParams}
          packageSlug={selected.slug}
          className={`btn btn-solid ${styles.panelAction}`}
        >
          <Icon name="ph-calculator" size={17} />
          Get exact price for my route
        </JourneyCalculatorLink>
        <a
          className={`btn btn-secondary ${styles.panelAction}`}
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="ph-whatsapp-logo" size={18} />
          Enquire on WhatsApp
        </a>
      </div>
      <a className={styles.compareLink} href="#rate-card">Compare packages &amp; charges <Icon name="ph-arrow-down" size={14} /></a>
    </aside>
  );
}

/** The mobile action bar. Shares the panel's package selection. */
export function CarStickyBar({
  car,
  city,
  calculatorParams,
  styles,
}: CarBookingProps) {
  const { selected } = usePackageSelection();

  return (
    <section className={`stickybar ${styles.stickyBar}`} aria-label={`${car.name} booking action`}>
      <div className={styles.stickyPrice}>
        <span className={styles.stickyCar}>{car.name}</span>
        <span className={styles.stickyPriceValue}>
          From {formatINR(priceFor(car, city, selected))}
        </span>
        <span className={styles.stickyPriceUnit}>{selected.label} base · Extras apply</span>
      </div>
      <JourneyCalculatorLink
        params={calculatorParams}
        packageSlug={selected.slug}
        className={`btn btn-solid ${styles.stickyAction}`}
      >
        Price my route
      </JourneyCalculatorLink>
    </section>
  );
}
