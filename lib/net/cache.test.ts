import { afterEach, describe, expect, it, vi } from "vitest";

import { createInflight, createThrottle, TtlCache } from "./cache";
import { createRateLimiter } from "./rate-limit";

/**
 * The politeness layer. Fake timers throughout — the point of every one of
 * these is what happens as time passes, and a test that waits for real seconds
 * to prove a one-second gap is a test nobody runs.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe("TtlCache", () => {
  it("returns a value until it expires", () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(1000, 10);

    cache.set("kochi", "hit");
    expect(cache.get("kochi")).toBe("hit");

    vi.advanceTimersByTime(1001);
    expect(cache.get("kochi")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("evicts the least recently read once full", () => {
    const cache = new TtlCache<string>(10_000, 2);

    cache.set("a", "1");
    cache.set("b", "2");
    // Reading "a" makes "b" the stale one.
    cache.get("a");
    cache.set("c", "3");

    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("1");
    expect(cache.get("c")).toBe("3");
  });
});

describe("createInflight", () => {
  it("shares one call between concurrent callers", async () => {
    const inflight = createInflight<number>();
    let calls = 0;
    const run = () => {
      calls += 1;
      return Promise.resolve(42);
    };

    const [first, second] = await Promise.all([inflight("k", run), inflight("k", run)]);

    expect(calls).toBe(1);
    expect(first).toBe(42);
    expect(second).toBe(42);
  });

  it("lets the next caller start again once it has settled", async () => {
    const inflight = createInflight<number>();
    let calls = 0;
    const run = () => {
      calls += 1;
      return Promise.resolve(1);
    };

    await inflight("k", run);
    await inflight("k", run);

    expect(calls).toBe(2);
  });

  it("does not strand the key when the call fails", async () => {
    const inflight = createInflight<number>();

    await expect(inflight("k", () => Promise.reject(new Error("down")))).rejects.toThrow("down");
    await expect(inflight("k", () => Promise.resolve(7))).resolves.toBe(7);
  });
});

describe("createThrottle", () => {
  it("spaces successive calls by the interval", async () => {
    vi.useFakeTimers();
    const gate = createThrottle(1000);
    const passed: number[] = [];

    const run = async (label: number) => {
      await gate();
      passed.push(label);
    };

    void run(1);
    void run(2);
    void run(3);

    await vi.advanceTimersByTimeAsync(0);
    expect(passed).toEqual([1]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(passed).toEqual([1, 2]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(passed).toEqual([1, 2, 3]);
  });

  it("is a no-op when the provider has no limit", async () => {
    vi.useFakeTimers();
    const gate = createThrottle(0);

    let done = false;
    void gate().then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });
});

describe("createRateLimiter", () => {
  it("allows up to the limit, then refuses until the window rolls", () => {
    vi.useFakeTimers();
    const allow = createRateLimiter(2, 1000);

    expect(allow("ip")).toBe(true);
    expect(allow("ip")).toBe(true);
    expect(allow("ip")).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(allow("ip")).toBe(true);
  });

  it("counts each caller separately", () => {
    const allow = createRateLimiter(1, 1000);

    expect(allow("one")).toBe(true);
    expect(allow("two")).toBe(true);
    expect(allow("one")).toBe(false);
  });
});
