/**
 * Conversion tracking (§25).
 *
 * The measurement the brief asks for is one journey: Instagram or an ad, then
 * the site, then an enquiry, then WhatsApp, then a booking. Three of those five
 * steps happen in the browser, so they are the three this file can see —
 * a WhatsApp tap, a phone tap and an enquiry submitted.
 *
 * Nothing loads unless the environment names an ID. A site with no analytics
 * configured ships no third-party script at all, which is the correct default:
 * an empty GA container that slows the first paint measures nothing.
 */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

/** The events worth counting. Named once so the dashboards agree. */
export type TrackEvent =
  | "whatsapp_click"
  | "call_click"
  | "enquiry_submit"
  | "quote_calculated"
  | "availability_check";

interface Gtag {
  (command: "event", name: string, params?: Record<string, unknown>): void;
  (command: "config" | "js", ...args: unknown[]): void;
}

interface Fbq {
  (command: "track" | "trackCustom" | "init", name: string, params?: Record<string, unknown>): void;
}

declare global {
  interface Window {
    gtag?: Gtag;
    fbq?: Fbq;
    dataLayer?: unknown[];
  }
}

/**
 * Record one event with whichever tags are loaded.
 *
 * Deliberately silent when nothing is configured, and deliberately not async:
 * this is called from click handlers that are about to navigate away, and a
 * promise nobody awaits would be cancelled with the page.
 */
export function track(event: TrackEvent, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;

  window.gtag?.("event", event, params);

  // Meta's standard events are a fixed vocabulary; ours map onto Lead and
  // Contact, and anything else goes through as a custom event.
  if (window.fbq) {
    if (event === "enquiry_submit") window.fbq("track", "Lead", params);
    else if (event === "whatsapp_click" || event === "call_click") {
      window.fbq("track", "Contact", params);
    } else window.fbq("trackCustom", event, params);
  }
}
