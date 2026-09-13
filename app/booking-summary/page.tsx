import type { Metadata } from "next";
import Link from "next/link";
import { QuoteLines } from "@/components/quote/QuoteLines";
import { RouteDistanceBreakdown } from "@/components/quote/RouteDistanceBreakdown";
import { MessagePreview } from "@/components/quote/MessagePreview";
import styles from "@/components/summary/Summary.module.css";

import { SendToWhatsApp } from "@/components/summary/SendToWhatsApp";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { Icon } from "@/components/ui/Icon";
import { Media } from "@/components/ui/Media";
import { ResponsiveDisclosure } from "@/components/ui/ResponsiveDisclosure";
import { JourneyRoadmap } from "@/components/ui/JourneyRoadmap";
import { heroImage, tripDefaults } from "@/lib/catalog";
import { getCatalog } from "@/lib/content";
import { isPricingAvailable } from "@/lib/catalog-readiness";
import { formatDate, formatINR, formatTime } from "@/lib/format";
import { tripTypeLabel } from "@/lib/pricing";
import { tripFromParams, tripToParams } from "@/lib/quote";
import { resolveRoutedQuote } from "@/lib/quote-server";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { canRecordEnquiries } from "@/lib/supabase/admin";
import { bookingIssue } from "@/lib/booking-readiness";
import { businessDate } from "@/lib/dates";


export const metadata: Metadata = {
  title: "Booking summary",
  description: "Check your trip and price, then send the whole quote to us on WhatsApp.",
  // A quote is a personal, transient page; keep it out of the index.
  robots: { index: false, follow: true },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BookingSummaryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const catalog = await getCatalog();
  if ((isSupabaseConfigured() || canRecordEnquiries()) && !catalog.live) throw new Error("Live pricing is temporarily unavailable.");
  if (!isPricingAvailable(catalog)) {
    return <section className="sec"><h1 className="mb-6">Booking summary</h1><PricingUnavailable /></section>;
  }

  const defaults = tripDefaults(catalog, "");
  const trip = tripFromParams(params, defaults);
  const issue = bookingIssue(trip, catalog.locations, businessDate());
  if (issue) return <section className="sec"><h1 className="mb-4">Complete your booking details</h1><p>{issue}</p><Link className="btn btn-primary mt-4" href={`/price-calculator?${tripToParams(trip)}#calc-route`}>Continue in the calculator</Link></section>;
  const resolved = await resolveRoutedQuote(catalog, trip);
  const { quote, car, pkg, city, occasion } = resolved;

  const backHref = `/price-calculator?${tripToParams(trip).toString()}`;
  const telHref = `tel:${catalog.settings.phoneDisplay.replace(/\s/g, "")}`;

  // Built from the stops that resolved, in visiting order — a trip with no
  // drop yet shows a pickup and says so, rather than inventing the other end.
  const passengerLegs = resolved.legs.filter((leg) => !leg.transfer);
  const stops = resolved.stops.map((stop, index) => ({
    role: index === 0 ? "Pickup" : index === resolved.stops.length - 1 ? "Drop" : `Stop ${index}`,
    icon: index === 0 ? "ph-map-pin-line" : index === resolved.stops.length - 1 ? "ph-flag" : "ph-path",
    name: stop.name,
    leg:
      index === 0
        ? `${formatDate(trip.date)} · ${formatTime(trip.time)}`
        : `${passengerLegs[index - 1]?.km ?? 0} km`,
  }));

  return (
    <>
      <div className={styles.canvas}>
      <div className={styles.page}>
        <div className={styles.roadmap}><JourneyRoadmap label="Booking progress" steps={[
          { label: "Your journey", href: `${backHref}#calc-route`, complete: true },
          { label: "Car & package", href: `${backHref}#calc-vehicle`, complete: true },
          { label: "Booking summary", current: true },
        ]} /></div>
        <header className={styles.heading}><p className={styles.kicker}>Review your booking request</p><h1>Review your booking</h1><p>Send your trip to our team on WhatsApp to confirm availability and the final price.</p></header>

        <div className={styles.layout}>
          <section className={styles.vehicle} aria-label="Selected vehicle and package">
            <div className={styles.vehicleTop}>
              <Media src={heroImage(car)} alt={car.name} placeholder={car.name} className={styles.photo} sizes="(max-width: 639px) 112px, 170px" />
              <div className={styles.vehicleBody}>
                <p className={styles.kicker}>Selected vehicle</p><h2>{car.name}</h2>
                <p className={styles.vehicleMeta}>{car.year} · {car.type} · {city.name}</p>
                <div className={styles.vehicleFeatures}><span><Icon name="ph-users" size={15} />{car.seats} seats</span><span>Chauffeur driven</span></div>
                <Link className={styles.editLink} href={`${backHref}#calc-vehicle`}>Change car or package <Icon name="ph-arrow-right" size={14} /></Link>
              </div>
            </div>
            <dl className={styles.specs}>
              <div><dt><Icon name="ph-calendar-blank" size={16} />Pickup schedule</dt><dd>{formatDate(trip.date)}<span>{formatTime(trip.time)}{trip.returnDate && <> · Through {formatDate(trip.returnDate)}</>}</span></dd></div>
              <div><dt><Icon name="ph-package" size={16} />Package</dt><dd>{pkg.label}<span>{occasion.name}</span></dd></div>
              <div className={styles.tripSummary}><dt><Icon name="ph-path" size={16} />Journey</dt><dd>{tripTypeLabel(trip.tripType)}<span>{quote.km} km · {quote.hours} hr, including vehicle travel</span></dd></div>
            </dl>
          </section>

          <aside className={styles.receipt} aria-label="Booking price and contact">
            <div className={styles.receiptHeading}><div><p className={styles.kicker}>Your booking estimate</p><h2>Price breakdown</h2></div><Icon name="ph-receipt" size={26} /></div>
            <div className={styles.mobileOverview}><p>{car.name} · {pkg.label}</p><p>{formatDate(trip.date)} · {formatTime(trip.time)}</p><div><span>Estimated total</span><strong>{formatINR(quote.total)}</strong></div></div>
            <p className={styles.receiptNote}>For your selected package and full vehicle journey.</p>
            <div className={styles.quoteLines}>
            <QuoteLines quote={quote} gstPercent={catalog.settings.gstPercent} showSubtotal totalLabel="Total payable" />
            </div>
            <div className={styles.advance}><div><span>Indicative advance</span><strong>{formatINR(quote.advance)}</strong></div><p>The team will confirm availability, the final price and payment arrangements before you book.</p></div>
            <div id="summary-send" tabIndex={-1} className={styles.send}>
              <SendToWhatsApp trip={trip} fallbackHref={resolved.whatsappHref} withFields className={`btn btn-solid ${styles.sendAction}`} />
            </div>
            <p className={styles.confirmation}><Icon name="ph-lock-simple" size={17} />No payment is collected here. Send the message inside WhatsApp to complete your request.</p>
            <a className={`btn btn-secondary ${styles.callAction}`} href={telHref}><Icon name="ph-phone-call" size={17} />Or call {catalog.settings.phoneDisplay}</a>
          </aside>

          <ResponsiveDisclosure id="summary-itinerary" title="Trip itinerary & distance" hideTitleOnDesktop className={styles.itineraryDisclosure}>
          <section className={styles.itinerary}>
            <div className={styles.sectionTitle}><h2>Your itinerary</h2><Link href={`${backHref}#calc-route`}>Edit journey <Icon name="ph-pencil-simple" size={14} /></Link></div>
            <ol className={styles.stops}>{stops.map((stop) => <li key={stop.role} className={styles.stop}><span className={styles.stopIcon}><Icon name={stop.icon} size={17} /></span><div><p className={styles.stopRole}>{stop.role}</p><p className={styles.stopName}>{stop.name}</p><span className={styles.stopLeg}>{stop.leg}</span></div></li>)}</ol>
            <RouteDistanceBreakdown resolved={resolved} />
          </section>
          </ResponsiveDisclosure>

          <div className={styles.details}>
            <div className={styles.included}>
              <div><h3>Included</h3>{catalog.settings.inclusions.map((item) => <p key={item}><Icon name="ph-check" size={15} color="var(--color-accent-text)" />{item}</p>)}</div>
              <div><h3>Paid at actuals</h3>{catalog.settings.exclusions.map((item) => <p key={item}><Icon name="ph-minus" size={15} />{item}</p>)}</div>
            </div>
            <p className={styles.termsNote}>Our team will confirm cancellation terms and chauffeur details with your booking.</p>
            <div className={styles.message}><MessagePreview message={resolved.message} label="What we receive" /></div>
          </div>
        </div>
      </div>
      </div>

      <section className={`stickybar hidden max-md:flex ${styles.mobileAction}`} aria-label="Booking action">
        <div className="flex-1"><span className="block text-[10px] text-[var(--color-neutral-400)]">Total payable</span><span className="font-[family-name:var(--font-heading)] text-[23px] font-semibold">{formatINR(quote.total)}</span></div>
        <a className="btn btn-solid" href="#summary-send"><Icon name="ph-whatsapp-logo" size={18} />Send on WhatsApp</a>
      </section>
    </>
  );
}
