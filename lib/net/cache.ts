/**
 * The three things that stand between this site and a free map service.
 *
 * A combobox fires a lookup every time typing pauses, and the calculator asks
 * for a driving route every time a stop changes; a dozen people planning trips
 * at once would hammer a public service that asks to be treated politely. So:
 * repeat requests are answered from memory, identical requests in flight at the
 * same moment share one upstream call, and calls are spaced out to whatever gap
 * the provider asks for.
 *
 * All of it is per server instance and deliberately so — a cache that needed
 * Redis would be a new thing to run for a search box.
 */

interface Entry<T> {
  value: T;
  /** Epoch ms. */
  expires: number;
}

/**
 * A small map that forgets: entries past their TTL, and the oldest entries once
 * it is full. Place names do not change, so the TTL is about bounding memory
 * and re-trying a provider that was briefly unhappy, not about freshness.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly max: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Refresh insertion order so a popular query is not the next one evicted.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.entries.size > this.max) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

/**
 * Collapses concurrent calls for the same key onto one promise.
 *
 * Two visitors typing "kalpetta" in the same second is one upstream request,
 * not two — and on a cold start, the first keystroke's request is not raced by
 * the second's.
 */
export function createInflight<T>(): (key: string, run: () => Promise<T>) => Promise<T> {
  const pending = new Map<string, Promise<T>>();

  return (key, run) => {
    const existing = pending.get(key);
    if (existing) return existing;

    const promise = run().finally(() => {
      pending.delete(key);
    });
    pending.set(key, promise);
    return promise;
  };
}

/**
 * Spaces upstream calls at least `minIntervalMs` apart.
 *
 * Nominatim's usage policy is one request a second and it means it; Photon asks
 * only to be used fairly. Callers await the gate immediately before the fetch,
 * so a queued request still runs — it just runs late.
 */
export function createThrottle(minIntervalMs: number): () => Promise<void> {
  let nextAt = 0;

  return async () => {
    if (minIntervalMs <= 0) return;
    const now = Date.now();
    const at = Math.max(now, nextAt);
    nextAt = at + minIntervalMs;
    const wait = at - now;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  };
}
