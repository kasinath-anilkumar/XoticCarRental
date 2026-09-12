/**
 * A fixed-window limiter for the endpoints that spend somebody else's quota.
 *
 * `/api/places` and `/api/directions` are public proxies to free services.
 * Without a ceiling, one script pointed at either burns the goodwill the whole
 * site depends on. The windows are deliberately generous — a visitor typing
 * "cochin international airport" with a debounce spends maybe ten of them.
 *
 * In memory, per instance. Behind several instances each gets its own window,
 * which is the right trade for a search box: no shared store to operate, and
 * the ceiling still holds within an order of magnitude.
 */

interface Window {
  count: number;
  /** Epoch ms at which the count resets. */
  resets: number;
}

export interface RateLimit {
  /** True when the request is within its allowance. */
  (key: string): boolean;
}

export function createRateLimiter(limit: number, windowMs: number, maxKeys = 5000): RateLimit {
  const windows = new Map<string, Window>();

  return (key) => {
    const now = Date.now();
    const current = windows.get(key);

    if (!current || current.resets <= now) {
      // Sweep on rollover rather than on a timer: no interval to leak, and the
      // map only grows while traffic does.
      if (windows.size >= maxKeys) {
        for (const [other, window] of windows) {
          if (window.resets <= now) windows.delete(other);
        }
        // Fresh attacker-controlled keys must not grow the map indefinitely.
        if (windows.size >= maxKeys) return false;
      }
      windows.set(key, { count: 1, resets: now + windowMs });
      return true;
    }

    current.count += 1;
    return current.count <= limit;
  };
}

/**
 * Best guess at who is calling.
 *
 * Behind Vercel or any sane proxy this is the real client; behind none of them
 * it is a shared bucket, which fails safe — a limiter that can be defeated by
 * omitting a header would be worse than one that is occasionally strict.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "anonymous";
}
