import { NextResponse } from "next/server";

import { freeThrough } from "@/lib/availability";
import { getCatalog } from "@/lib/content";
import { addDays, businessDate, isISODate } from "@/lib/dates";
import { clientKey, createRateLimiter } from "@/lib/net/rate-limit";
import { getStore } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { canRecordEnquiries } from "@/lib/supabase/admin";

const allow = createRateLimiter(120, 60_000);

/**
 * Is this vehicle free on this date? (§17, §20)
 *
 * The answer is deliberately thin: free or not, and if not, the next date it
 * is. A customer does not need to know whether the car is booked, on hold or in
 * the workshop — that is Xotic's business, and §9's rule about not exposing
 * internal detail applies to the calendar as much as to the garage.
 *
 * It is also not a booking. §11 is explicit that the site must not confirm
 * anything on its own, so a "free" here means "worth asking about", and the
 * response says so.
 */
export async function GET(request: Request) {
  try {
  const url = new URL(request.url);
  const carSlug = url.searchParams.get("car") ?? "";
  const date = url.searchParams.get("date") ?? "";
  const days = Number(url.searchParams.get("days") ?? 1);

  if (!isISODate(date) || date < businessDate() || date > addDays(businessDate(), 730) ||
      !Number.isSafeInteger(days) || days < 1 || days > 30) {
    return NextResponse.json({ error: "Choose a valid upcoming date and a duration from 1 to 30 days." }, { status: 400 });
  }
  if (!allow(clientKey(request))) return NextResponse.json({ error: "Too many checks. Please try again shortly." }, { status: 429, headers: { "Retry-After": "60" } });

  const catalog = await getCatalog();
  if ((isSupabaseConfigured() || canRecordEnquiries()) && !catalog.live) {
    return NextResponse.json({ error: "Live availability is temporarily unavailable. Please try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const car = catalog.cars.find((item) => item.slug === carSlug);
  if (!car) {
    return NextResponse.json({ error: "Unknown vehicle." }, { status: 404 });
  }

  const entries = await getStore().listAvailability(car.slug, { from: date, to: addDays(date, 60 + days - 1) });
  const available = freeThrough(entries, car.slug, date, days);

  // The soonest day it could start, so a "no" comes with somewhere to go.
  let nextFree: string | null = null;
  if (!available) {
    const start = new Date(`${date}T00:00:00Z`).getTime();
    for (let offset = 1; offset <= 60; offset += 1) {
      const candidate = new Date(start + offset * 86_400_000).toISOString().slice(0, 10);
      if (freeThrough(entries, car.slug, candidate, days)) {
        nextFree = candidate;
        break;
      }
    }
  }

  // What else is free that day, so a "no" is never a dead end. Only worked out
  // when the answer is no — a second pass over the calendar to suggest
  // alternatives nobody asked for is a read for nothing.
  const alternatives: Array<{ slug: string; name: string }> = [];
  if (!available) {
    const alternativesCalendar = await getStore().listAvailability(undefined, { from: date, to: addDays(date, days - 1) });
    for (const item of catalog.cars) {
      if (alternatives.length === 3) break;
      if (
        item.slug !== car.slug &&
        item.type === car.type &&
        item.seats >= car.seats &&
        freeThrough(alternativesCalendar, item.slug, date, days)
      ) {
        alternatives.push({ slug: item.slug, name: item.name });
      }
    }
  }

  return NextResponse.json({ available, nextFree, alternatives }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[availability] Could not check calendar:", error);
    return NextResponse.json({ error: "Availability is temporarily unavailable. Please contact us to confirm." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
