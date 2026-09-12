/**
 * Peak-season rates (§10).
 *
 * A luxury fleet does not cost the same in December as it does in June. The
 * wedding months and the festival weeks are when every car is out and every
 * enquiry is for the same three dates; the brief asks the pricing engine to
 * support that rather than leaving staff to quietly quote a different number
 * over the phone.
 *
 * A season is a recurring window, written as MM-DD, because "wedding season"
 * is a time of year and not a set of dates somebody has to re-enter each
 * January. A window may wrap the year end — 12-15 to 01-15 is one season, not
 * two — which is the one piece of arithmetic here worth a test.
 *
 * The multiplier applies to the package base only. Extra kilometres, the
 * driver's bata and the night charge are costs, not scarcity, and inflating
 * them would be dishonest rather than seasonal.
 */

import type { Season } from "./types";

/** MM-DD for a YYYY-MM-DD date. Returns "" for anything unparseable. */
export function monthDay(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(5) : "";
}

/**
 * Whether a season covers a date.
 *
 * Both ends are inclusive. A window whose end sorts before its start wraps the
 * year: the test becomes "on or after the start, OR on or before the end".
 */
export function seasonCovers(season: Season, date: string): boolean {
  const day = monthDay(date);
  if (!day) return false;

  const { startsOn, endsOn } = season;
  if (startsOn <= endsOn) return day >= startsOn && day <= endsOn;
  return day >= startsOn || day <= endsOn;
}

/**
 * The season in force on a date, or null.
 *
 * When windows overlap — a festival week inside the wedding months — the
 * dearer one wins. Anything else would let an editor lose a peak rate by
 * adding a second, gentler season on top of it.
 */
export function seasonFor(seasons: Season[], date: string): Season | null {
  let found: Season | null = null;
  for (const season of seasons) {
    if (!season.isActive || !seasonCovers(season, date)) continue;
    if (!found || season.multiplier > found.multiplier) found = season;
  }
  return found;
}
