/**
 * The one place a call to somebody else's map service is actually made — the
 * geocoder in `lib/geo`, the router in `lib/route`.
 *
 * Two things every provider needs and none of them get by default: an honest
 * User-Agent (Nominatim rejects anonymous traffic outright, and rightly) and a
 * deadline. A search box that waits eight seconds for a suggestion has already
 * failed the person typing, so the request is abandoned long before the browser
 * would give up on it.
 */

const DEFAULT_TIMEOUT_MS = 4500;

/**
 * Identifies us upstream. `GEOCODER_CONTACT` should be an address a provider
 * can reach if our traffic ever bothers them — that is the whole point of the
 * header. One variable covers both services; a provider chasing us does not
 * care which of the two was noisy.
 */
export function userAgent(): string {
  const contact =
    process.env.GEOCODER_CONTACT ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://xoticcarrental.com";
  return `XoticCarRental/1.0 (+${contact})`;
}

export interface FetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Routers that take a list of stops want a body; everything else is a GET. */
  method?: "GET" | "POST";
  body?: unknown;
}

/** Aborts on the caller's signal or the deadline, whichever comes first. */
function deadline(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  // Node 20+ and every browser we support; the fallback keeps the deadline.
  return typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : timeout;
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    signal: deadline(options.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    headers: {
      "User-Agent": userAgent(),
      Accept: "application/json",
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}
