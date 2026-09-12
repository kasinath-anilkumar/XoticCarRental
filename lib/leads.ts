/**
 * Lead references (§14).
 *
 *   XWC-260821-001
 *   │   │      └── the day's sequence, from 001
 *   │   └───────── the date, YYMMDD
 *   └───────────── the service
 *
 * The point of it is a shared vocabulary. A customer pastes it into WhatsApp,
 * an operator types it into the dashboard, and both are talking about the same
 * enquiry — which is precisely what a thread of unlabelled messages cannot do.
 *
 * The prefix names the service, because the first question staff ask about a
 * lead is what kind of job it is.
 */

/**
 * A new service needs no code entry to receive references. Prefixes are labels,
 * not identifiers: services with the same first eight letters share a counter,
 * and the stored service slug/name identifies the job. Existing references are
 * read as stored and never regenerated when this derivation changes.
 */
export function leadPrefix(serviceSlug: string): string {
  const letters = serviceSlug.normalize("NFKD").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
  return letters ? letters.padEnd(2, "X") : "ENQ";
}

/** YYMMDD in IST — the business's own day, not the server's timezone. */
export function leadDateStamp(now: Date): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const yy = String(ist.getUTCFullYear()).slice(2);
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/**
 * The next reference for a service on a day.
 *
 * `taken` is the set of references already issued with the same prefix and
 * date; the sequence is one past the highest, including references issued for
 * any other service sharing the prefix. The local writer serializes this scan;
 * production uses the database's atomic prefix/day counter instead.
 */
export function nextLeadId(serviceSlug: string, now: Date, taken: string[]): string {
  const prefix = leadPrefix(serviceSlug);
  const stamp = leadDateStamp(now);
  const head = `${prefix}-${stamp}-`;

  const highest = taken.reduce((max, id) => {
    if (!id.startsWith(head)) return max;
    const suffix = id.slice(head.length);
    const sequence = /^\d+$/.test(suffix) ? Number(suffix) : NaN;
    return Number.isSafeInteger(sequence) ? Math.max(max, sequence) : max;
  }, 0);

  return `${head}${String(highest + 1).padStart(3, "0")}`;
}

/** The statuses a lead moves through (§14). */
export const LEAD_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "follow_up",
  "confirmed",
  "lost",
  "cancelled",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quote sent",
  follow_up: "Follow-up required",
  confirmed: "Confirmed",
  lost: "Lost",
  cancelled: "Cancelled",
};

/** Leads in these states are still live work; the rest are closed. */
export const OPEN_STATUSES: LeadStatus[] = ["new", "contacted", "quoted", "follow_up"];
