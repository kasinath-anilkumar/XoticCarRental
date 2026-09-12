import type { Metadata } from "next";
import Link from "next/link";

import { SendToWhatsApp } from "@/components/summary/SendToWhatsApp";
import { PricingUnavailable } from "@/components/content/PricingUnavailable";
import { Icon } from "@/components/ui/Icon";
import { Media } from "@/components/ui/Media";
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
  if (issue) return <section className="sec"><h1 className="mb-4">Complete your booking details</h1><p>{issue}</p><Link className="btn btn-primary mt-4" href={`/price-calculator?${tripToParams(trip)}`}>Continue in the calculator</Link></section>;
  const resolved = await resolveRoutedQuote(catalog, trip);
  const { quote, car, pkg, city, occasion } = resolved;

  const backHref = `/price-calculator?${tripToParams(trip).toString()}`;
  const telHref = `tel:${catalog.settings.phoneDisplay.replace(/\s/g, "")}`;

  // Built from the stops that resolved, in visiting order — a trip with no
  // drop yet shows a pickup and says so, rather than inventing the other end.
  const stops = resolved.stops.map((stop, index) => ({
    role: index === 0 ? "Pickup" : index === resolved.stops.length - 1 ? "Drop" : `Stop ${index}`,
    icon: index === 0 ? "ph-map-pin-line" : index === resolved.stops.length - 1 ? "ph-flag" : "ph-path",
    name: stop.name,
    leg:
      index === 0
        ? `${formatDate(trip.date)} · ${formatTime(trip.time)}`
        : `${resolved.legs[index - 1]?.km ?? 0} km`,
  }));

  return (
    <>
      <div className="px-[var(--gutter-desktop)] pt-12 pb-[56px] max-md:px-[var(--gutter-mobile)] max-md:pt-[20px] max-md:pb-0">
        <p className="mb-6 flex flex-wrap items-center gap-3 text-[12px] text-[var(--color-neutral-600)]">
          <Link href={backHref} style={{ color: "inherit", textDecoration: "none" }}>
            Calculator
          </Link>
          <Icon name="ph-caret-right" size={12} />
          <span className="text-[var(--color-accent-300)]">Booking summary</span>
          <Icon name="ph-caret-right" size={12} />
          <span>WhatsApp confirmation</span>
        </p>

        <div className="grid grid-cols-[1fr_420px] items-start gap-12 max-lg:grid-cols-1">
          <div>
            <h1 className="mb-2 text-[34px] max-lg:text-[28px] max-md:text-[24px]">Check the details, then send it to us</h1>
            <p className="mb-8 text-[14px] text-[var(--color-neutral-400)]">
              One tap opens WhatsApp with this whole quote written out. Nothing is charged here.
            </p>

            <div className="flex gap-6 rounded-md bg-surface p-8 shadow-[var(--shadow-sm)] max-md:flex-col max-md:gap-4 max-md:p-6">
              <Media
                src={heroImage(car)}
                alt={car.name}
                placeholder={car.name}
                className="h-[130px] w-[196px] flex-none rounded-md max-md:h-[160px] max-md:w-full"
                sizes="(max-width: 767px) 100vw, 196px"
              />
              <div style={{ flex: 1 }}>
                <p className="font-[family-name:var(--font-heading)] text-[22px]">{car.name}</p>
                <p className="mb-4 text-[12px] text-[var(--color-neutral-500)]">
                  {car.year} · {car.type} · {car.seats} seats · {city.name}
                </p>
                <div className="grid grid-cols-[1fr_1fr] gap-x-8 gap-y-3 text-[13px] max-md:text-[12px]">
                  <p>
                    <span className="block text-[var(--color-neutral-500)]">Package</span>
                    {pkg.label}
                  </p>
                  <p>
                    <span className="block text-[var(--color-neutral-500)]">Occasion</span>
                    {occasion.name}
                  </p>
                  <p>
                    <span className="block text-[var(--color-neutral-500)]">Pickup</span>
                    {formatDate(trip.date)} at {formatTime(trip.time)}
                    {trip.returnDate && <span className="block">Through {formatDate(trip.returnDate)}</span>}
                  </p>
                  <p>
                    <span className="block text-[var(--color-neutral-500)]">Trip</span>
                    {tripTypeLabel(trip.tripType)} · {quote.km} km · {quote.hours} hr
                  </p>
                </div>
              </div>
            </div>

            {!resolved.complete && (
              <p className="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-[var(--color-accent-900)] p-4 text-[13px] text-text [&_a]:text-accent-text">
                <Icon name="ph-warning-circle" size={16} color="var(--color-accent)" />
                This quote has no route yet — the price below is the package alone.{" "}
                <Link href={backHref}>Add a pickup and drop</Link> to price the journey.
              </p>
            )}

            <div className="mt-6 flex flex-col gap-4">
              {stops.map((stop) => (
                <div key={stop.role} className="flex items-center gap-4 rounded-md bg-surface px-6 py-4 max-md:px-4 max-md:py-3">
                  <Icon name={stop.icon} size={20} color="var(--color-accent)" />
                  <div>
                    <p className="text-[11px] text-[var(--color-neutral-500)]">{stop.role}</p>
                    <p className="text-[14px]">{stop.name}</p>
                  </div>
                  <span className="ml-auto text-[12px] whitespace-nowrap text-[var(--color-neutral-500)]">{stop.leg}</span>
                </div>
              ))}
            </div>

            <h2 className="mt-12 mb-4 max-md:mt-8 max-md:mb-3 max-md:text-[19px]">Price breakdown</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <tbody>
                  {quote.lines.map((line) => (
                    <tr key={line.label}>
                      <td>
                        {line.label}
                        {line.note && <div className="text-[11px] text-[var(--color-neutral-600)]">{line.note}</div>}
                      </td>
                      <td className="text-right whitespace-nowrap">{formatINR(line.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ color: "var(--color-neutral-400)" }}>
                      GST {catalog.settings.gstPercent}%
                    </td>
                    <td className="text-right whitespace-nowrap" style={{ color: "var(--color-neutral-400)" }}>
                      {formatINR(quote.gst)}
                    </td>
                  </tr>
                  <tr>
                    <td className="font-[family-name:var(--font-heading)] text-[16px]">Total payable</td>
                    <td className="text-right font-[family-name:var(--font-heading)] text-[20px] text-[var(--color-accent-300)]">{formatINR(quote.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex flex-wrap gap-8">
              <div className="min-w-[240px] flex-1">
                <h3 style={{ marginBottom: "8.4px", fontSize: "20px" }}>Included</h3>
                {catalog.settings.inclusions.map((item) => (
                  <p key={item} className="flex gap-3 py-[3px] text-[13px] text-[var(--color-neutral-300)]">
                    <Icon name="ph-check" size={16} color="var(--color-accent)" />
                    {item}
                  </p>
                ))}
              </div>
              <div className="min-w-[240px] flex-1">
                <h3 style={{ marginBottom: "8.4px", fontSize: "20px" }}>Paid at actuals</h3>
                {catalog.settings.exclusions.map((item) => (
                  <p key={item} className="flex gap-3 py-[3px] text-[13px] text-[var(--color-neutral-400)]">
                    <Icon name="ph-minus" size={16} color="var(--color-neutral-600)" />
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <aside className="sticky top-[90px] flex flex-col gap-6 max-lg:static">
            <div className="rounded-lg bg-surface p-8 shadow-[var(--shadow-md)] max-md:p-6">
              <p className="text-[12px] text-[var(--color-neutral-500)]">Total payable</p>
              <p className="font-[family-name:var(--font-heading)] text-[42px] leading-[1.1] text-[var(--color-accent-300)] max-md:text-[32px]">{formatINR(quote.total)}</p>
              <p className="mb-6 text-[12px] text-[var(--color-neutral-400)]">
                {formatINR(quote.advance)} advance on WhatsApp confirms the car. Balance to the
                driver.
              </p>

              <div className="max-md:hidden">
                <SendToWhatsApp
                  trip={trip}
                  fallbackHref={resolved.whatsappHref}
                  withFields
                  className="btn wa btn-block"
                />
              </div>

              <a className="btn btn-secondary btn-block" style={{ minHeight: "44px" }} href={telHref}>
                <Icon name="ph-phone-call" size={17} />
                Or call {catalog.settings.phoneDisplay}
              </a>

              <div className="mt-6 flex flex-col gap-2 text-[12px] text-[var(--color-neutral-400)]">
                <span className="flex items-center gap-2">
                  <Icon name="ph-clock-user" size={14} color="var(--color-accent)" />
                  Our team will confirm availability and your final quote
                </span>
                <span className="flex items-center gap-2">
                  <Icon name="ph-arrows-clockwise" size={14} color="var(--color-accent)" />
                  Free cancellation up to 24 hours before
                </span>
                <span className="flex items-center gap-2">
                  <Icon name="ph-seal-check" size={14} color="var(--color-accent)" />
                  Driver details shared 12 hours before pickup
                </span>
              </div>
            </div>

            <div className="rounded-md bg-well p-6 shadow-[var(--shadow-sm)]">
              <p className="mb-4 flex items-center gap-3 text-[12px] text-[var(--color-neutral-500)]">
                <Icon name="ph-chat-teardrop-text" size={16} color="var(--color-whatsapp)" />
                What we receive
              </p>
              <p className="m-0 rounded-md bg-[var(--color-whatsapp-bubble)] p-4 text-[12px] leading-[1.6] whitespace-pre-line text-[var(--color-whatsapp-tint)] [font-family:inherit] [overflow-wrap:anywhere]">{resolved.message}</p>
            </div>
          </aside>
        </div>
      </div>

      <div className="stickybar hidden max-md:flex">
        <div className="flex-1">
          <span className="block text-[10px] text-[var(--color-neutral-500)]">Total payable</span>
          <span className="font-[family-name:var(--font-heading)] text-[21px] text-[var(--color-accent-300)]">{formatINR(quote.total)}</span>
        </div>
        <SendToWhatsApp
          trip={trip}
          fallbackHref={resolved.whatsappHref}
          className="btn wa"
          label="Send on WhatsApp"
          source="summary-mobile"
        />
      </div>
    </>
  );
}
