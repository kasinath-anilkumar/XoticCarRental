/**
 * Whether a vehicle can be offered for a date (§17).
 *
 * "Booked vehicles must not appear as available for overlapping requests" is
 * the requirement, and the awkward half of it is that the fleet list is a
 * static page while availability is live. So the rule lives here, pure and
 * testable, and each caller decides when to ask: the browse page filters on the
 * date in the query string, the calculator on the date in the trip.
 *
 * Dates are plain YYYY-MM-DD strings and compare lexicographically, which is
 * the one thing that format is good at.
 */

import type { Availability } from "./store/types";
import { addDays, isISODate } from "./dates";

/** A hold covers a date when the date falls inside it, both ends included. */
export function covers(entry: Availability, date: string): boolean {
  return entry.startsOn <= date && date <= entry.endsOn;
}

/**
 * The slugs that cannot take a job on this date.
 *
 * Every status blocks: a car in maintenance and a car on hold are both unable
 * to do the work, and the difference between them matters to staff, not to the
 * customer looking at a list.
 */
export function unavailableOn(entries: Availability[], date: string): Set<string> {
  const blocked = new Set<string>();
  for (const entry of entries) {
    if (covers(entry, date)) blocked.add(entry.carSlug);
  }
  return blocked;
}

/** Does this vehicle have a clear run across every day of a trip? */
export function freeThrough(
  entries: Availability[],
  carSlug: string,
  startDate: string,
  days: number,
): boolean {
  if (!isISODate(startDate) || !Number.isSafeInteger(days) || days < 1 || days > 366) return false;
  let endsOn: string;
  try {
    endsOn = addDays(startDate, days - 1);
  } catch {
    return false;
  }
  return !entries.some((entry) =>
    entry.carSlug === carSlug && entry.startsOn <= endsOn && entry.endsOn >= startDate,
  );
}
