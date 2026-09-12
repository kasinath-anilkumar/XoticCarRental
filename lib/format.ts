/**
 * Money and number formatting.
 *
 * The prototype used `Number.toLocaleString('en-IN')`. We implement the Indian
 * digit grouping directly instead: ICU data can differ between the Node build
 * that renders on the server and the browser that hydrates, and a rupee figure
 * that disagrees across that boundary is a React hydration error on every
 * screen. This is deterministic everywhere.
 */

const RUPEE = "₹";

/**
 * Indian grouping: the last three digits, then pairs.
 * 1234567 -> "12,34,567"
 */
export function groupIndian(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const digits = String(rounded);
  if (digits.length <= 3) return digits;

  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const paired = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${paired},${last3}`;
}

/** "₹12,34,567" — rounded to whole rupees, as every price in the design is. */
export function formatINR(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}${RUPEE}${groupIndian(value)}`;
}

/** For the odd place a bare grouped number reads better than a currency one. */
export function formatNumber(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}${groupIndian(value)}`;
}

/**
 * "2026-09-14" -> "14 Sep 2026". Built from a fixed month table rather than
 * Intl, for the same cross-runtime determinism as the currency formatter.
 */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${monthName} ${year}`;
}

/** "09:00" -> "9:00 am", "22:30" -> "10:30 pm". */
export function formatTime(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return hhmm;
  const hour = Number(match[1]);
  const meridiem = hour < 12 ? "am" : "pm";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${match[2]} ${meridiem}`;
}

/** Drops the trailing city/qualifier the way the design's route lines do. */
export function shortPlace(name: string): string {
  return name.split(",")[0].split(" (")[0];
}

/**
 * A driving time, from the router's minutes: "48 min", "2 hr 15 min".
 *
 * Free-flow — no router here models Kochi at six in the evening — so it is
 * shown beside the route rather than anywhere near the billable hours.
 */
export function formatDuration(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;

  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} hr`;
  return `${hours} hr ${rest} min`;
}
