import { addDays, isISODate, isTime } from "./dates";
import { resolvePlace } from "./places";
import { MAX_TRIP_DAYS, MAX_TRIP_STOPS } from "./trip-limits";
import type { LocationPoint, TripRequest } from "./types";

/** A price preview is not a bookable itinerary until the customer finishes it. */
export function bookingIssue(trip: TripRequest, locations: LocationPoint[], today: string): string | null {
  if (trip.stops.length < 2 || trip.stops.length > MAX_TRIP_STOPS || trip.stops.some((token) => !resolvePlace(token, locations))) {
    return "Select a pickup, a drop and each itinerary stop.";
  }
  if (!isISODate(trip.date) || trip.date < today || !isTime(trip.time)) {
    return "Choose a pickup date and time.";
  }
  if (trip.returnDate && (!isISODate(trip.returnDate) || trip.returnDate < trip.date)) {
    return "Choose a return date on or after pickup.";
  }
  if (trip.returnDate && trip.returnDate > addDays(trip.date, MAX_TRIP_DAYS - 1)) {
    return `Choose a rental of ${MAX_TRIP_DAYS} days or fewer.`;
  }
  return null;
}
