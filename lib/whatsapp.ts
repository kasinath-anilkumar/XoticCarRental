/**
 * WhatsApp handoff.
 *
 * Every conversion path on this site ends in a wa.me link with the quote
 * already written out, so the customer never retypes anything and the operator
 * receives a complete, itemised request. Ported from the prototype's
 * `waText()` / `waLink()`.
 */

import { formatINR } from "./format";
import { tripTypeLabel } from "./pricing";
import type { ResolvedPlace } from "./places";
import type { Car, City, Occasion, Package, Quote, TripType } from "./types";

export function whatsappLink(whatsappNumber: string, text: string): string {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
}

export interface QuoteMessageInput {
  quote: Quote;
  car: Car;
  pkg: Package;
  occasion: Occasion;
  tripType: TripType;
  /** The itinerary in visiting order: pickup, events, final drop. */
  stops: ResolvedPlace[];
  /** Where the customer is, if they said. Staff route the nearest car by it. */
  customer: ResolvedPlace | null;
  date: string;
  time: string;
  gstPercent: number;
  /** The reference the operator and the dashboard share (§14). */
  leadId?: string;
}

/** The full itemised booking request. This is what the operator receives. */
export function quoteMessage(input: QuoteMessageInput): string {
  const { quote, car, pkg, occasion, tripType, stops, customer, date, time, gstPercent } = input;

  const lines: string[] = ["Hi Xotic, I would like to book this trip."];
  if (input.leadId) lines.push(`Ref: ${input.leadId}`);

  lines.push(
    "",
    `Car: ${car.name} (${car.year}, ${car.type})`,
    `Package: ${pkg.label}${quote.days > 1 ? ` × ${quote.days} days` : ""}`,
    `Service: ${occasion.name}`,
  );

  if (customer) lines.push(`My location: ${customer.name}`);

  // The itinerary, named by its role: an operator reads "pickup / stop / drop",
  // not three identical lines.
  stops.forEach((stop, index) => {
    const role =
      index === 0 ? "Pickup" : index === stops.length - 1 ? "Final drop" : `Stop ${index}`;
    const when = index === 0 ? ` on ${date} at ${time}` : "";
    lines.push(`${role}: ${stop.name}${when}`);
  });

  lines.push(`Trip: ${tripTypeLabel(tripType)} · ${quote.km} km · ${quote.hours} hr`, "");

  for (const line of quote.lines) {
    lines.push(`• ${line.label} — ${formatINR(line.amount)}`);
  }

  lines.push(
    `• GST ${gstPercent}% — ${formatINR(quote.gst)}`,
    "",
    `Estimated total: ${formatINR(quote.total)}`,
    `Advance to confirm: ${formatINR(quote.advance)}`,
    "",
    // §11: the site never confirms a booking, and the message it hands over
    // must not read as though it has.
    "This is an estimated rate. Please confirm final pricing and availability.",
  );

  return lines.join("\n");
}

/** The enquiry a car card or detail page sends — no route chosen yet. */
export function carEnquiryMessage(car: Car, city: City, pkg: Package): string {
  return `Hi Xotic, I am interested in the ${car.name} (${city.name}) on the ${pkg.label} package. Is it available?`;
}

/** The catch-all enquiry behind every "Chat on WhatsApp" button. */
export const GENERAL_ENQUIRY_MESSAGE =
  "Hi Xotic, I would like to enquire about a car with driver.";
