import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getCatalog } from "@/lib/content";
import { freeThrough } from "@/lib/availability";
import { addDays, businessDate } from "@/lib/dates";
import { enquiryError, EnquiryInputError, inputDate, inputPhone, inputText, inputTime, readEnquiryBody } from "@/lib/enquiry-validation";
import { resolvePlace } from "@/lib/places";
import { resolveRoutedQuote } from "@/lib/quote-server";
import { getStore } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { canRecordEnquiries } from "@/lib/supabase/admin";
import { MAX_TRIP_DAYS, MAX_TRIP_STOPS } from "@/lib/trip-limits";
import { quoteMessage, whatsappLink } from "@/lib/whatsapp";
import type { TripRequest } from "@/lib/types";

/** Totals are always recomputed from validated trip parameters and the current catalogue. */
export async function POST(request: Request) {
  try {
    const raw = await readEnquiryBody(request);
    const tripType = inputText(raw.tripType, "Trip type");
    if (tripType !== "local" && tripType !== "oneway" && tripType !== "round") {
      throw new EnquiryInputError("Choose a valid trip type.");
    }
    const date = inputDate(inputText(raw.date, "Date") ?? "");
    const returnValue = inputText(raw.returnDate, "Return date");
    const returnDate = returnValue ? inputDate(returnValue, "Return date") : undefined;
    if (returnDate && (returnDate < date || returnDate > addDays(date, MAX_TRIP_DAYS - 1))) {
      throw new EnquiryInputError("Return date must be on or after pickup and within a 30-day rental.");
    }
    const time = inputTime(inputText(raw.time, "Time") ?? "");
    const customerName = inputText(raw.customerName, "Name");
    const customerPhone = inputPhone(raw.customerPhone);
    const source = inputText(raw.source, "Source") ?? "summary";
    const haltHours = raw.haltHours === undefined ? 0 : Number(raw.haltHours);
    if (!Number.isFinite(haltHours) || haltHours < 0 || haltHours > 12) {
      throw new EnquiryInputError("Halt hours must be between 0 and 12.");
    }
    const stopValues = raw.stops === undefined
      ? [raw.from, raw.to, raw.returnTo].filter((value) => value !== undefined && value !== null && value !== "")
      : raw.stops;
    if (!Array.isArray(stopValues) || stopValues.length < 2 || stopValues.length > MAX_TRIP_STOPS) {
      throw new EnquiryInputError(`Choose between two and ${MAX_TRIP_STOPS} itinerary stops.`);
    }
    const stops = stopValues.map((value) => {
      const token = inputText(value, "Stop", 500);
      if (!token) throw new EnquiryInputError("Choose a place for every itinerary stop.");
      return token;
    });
    const trip: TripRequest = {
      tripType, date, returnDate, time, stops, haltHours,
      carSlug: inputText(raw.carSlug, "Vehicle") ?? "",
      packageSlug: inputText(raw.packageSlug, "Package") ?? "",
      occasionSlug: inputText(raw.occasionSlug, "Occasion") ?? "",
      customerPlace: inputText(raw.customerPlace, "Customer place", 500) ?? "",
    };
    const catalog = await getCatalog();
    if ((isSupabaseConfigured() || canRecordEnquiries()) && !catalog.live) {
      throw new EnquiryInputError("Live pricing is temporarily unavailable. Please try again shortly.", 503);
    }
    if (!catalog.cars.some((car) => car.slug === trip.carSlug)) throw new EnquiryInputError("Choose an available vehicle.");
    if (!catalog.packages.some((pkg) => pkg.slug === trip.packageSlug)) throw new EnquiryInputError("Choose a valid package.");
    if (!catalog.occasions.some((occasion) => occasion.slug === trip.occasionSlug)) throw new EnquiryInputError("Choose a valid occasion.");
    if (stops.some((token) => !resolvePlace(token, catalog.locations)) ||
        (trip.customerPlace && !resolvePlace(trip.customerPlace, catalog.locations))) {
      throw new EnquiryInputError("Choose valid pickup, drop and customer locations.");
    }
    const resolved = await resolveRoutedQuote(catalog, trip);
    // Each submitted token was validated above. Canonical passenger stops may
    // additionally contain the inferred return to pickup on a two-stop round trip.
    if (!resolved.from || !resolved.to) {
      throw new EnquiryInputError("Choose a pickup and a drop before sending the quote.");
    }
    if (!Number.isSafeInteger(resolved.quote.days) || resolved.quote.days < 1 || resolved.quote.days > MAX_TRIP_DAYS) {
      throw new EnquiryInputError("Please use a service enquiry for trips longer than 30 days.");
    }

    let leadId = `ASK-${randomUUID().slice(0, 8).toUpperCase()}`;
    let recorded = false;
    try {
      const store = getStore();
      const calendar = await store.listAvailability(resolved.car.slug, { from: date, to: addDays(date, resolved.quote.days - 1) });
      if (!freeThrough(calendar, resolved.car.slug, date, resolved.quote.days)) {
        throw new EnquiryInputError("This vehicle is no longer available for these dates. Please choose another vehicle or date.", 409);
      }
      const lead = await store.createLead({
        customerName,
        customerPhone,
        customerPlace: resolved.customer?.name ?? null,
        serviceSlug: resolved.occasion.slug,
        serviceName: resolved.occasion.name,
        carSlug: resolved.car.slug,
        carName: resolved.car.name,
        packageLabel: resolved.pkg.label,
        tripType,
        stops: resolved.stops.map((stop, index) => ({
          name: stop.name,
          role: index === 0 ? "pickup" : index === resolved.stops.length - 1 ? "drop" : "stop",
        })),
        pickupDate: date,
        pickupTime: time,
        haltHours,
        km: resolved.quote.km,
        transferKm: Math.round(resolved.transferKm),
        hours: resolved.quote.hours,
        days: resolved.quote.days,
        lines: resolved.quote.lines,
        subtotal: resolved.quote.subtotal,
        gst: resolved.quote.gst,
        total: resolved.quote.total,
        advance: resolved.quote.advance,
        status: "new",
        assignedTo: null,
        followUpOn: addDays(businessDate(), 1),
        notes: null,
        source,
        details: returnDate ? [{ label: "Return date", value: returnDate }] : [],
      });
      leadId = lead.leadId;
      recorded = true;
    } catch (error) {
      if (error instanceof EnquiryInputError) throw error;
      console.error("[enquiries] Could not record the lead:", error);
    }

    const message = quoteMessage({
      quote: resolved.quote,
      car: resolved.car,
      pkg: resolved.pkg,
      occasion: resolved.occasion,
      tripType,
      stops: resolved.stops,
      customer: resolved.customer,
      date,
      returnDate,
      time,
      gstPercent: catalog.settings.gstPercent,
      leadId,
    });
    return NextResponse.json({
      whatsappHref: whatsappLink(catalog.settings.whatsappNumber, message),
      leadId,
      total: resolved.quote.total,
      advance: resolved.quote.advance,
      recorded,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return enquiryError(error);
  }
}
