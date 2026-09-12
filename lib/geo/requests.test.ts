import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequestGate, createSharedRequests } from "./requests";

afterEach(() => vi.useRealTimers());

describe("shared geocoding requests", () => {
  it("shares an upstream call without letting one visitor cancel another", async () => {
    const requests = createSharedRequests<number>();
    const first = new AbortController();
    let complete!: (value: number) => void;
    let upstream!: AbortSignal;
    const work = vi.fn((signal: AbortSignal) => {
      upstream = signal;
      return new Promise<number>((resolve) => { complete = resolve; });
    });
    const a = requests("same", work, first.signal);
    const b = requests("same", work);
    const rejected = expect(a).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    first.abort();
    await rejected;
    expect(upstream.aborted).toBe(false);
    complete(7);
    await expect(b).resolves.toBe(7);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("cancels abandoned work and allows a replacement for the same query", async () => {
    const requests = createSharedRequests<number>();
    const abort = new AbortController();
    let upstream!: AbortSignal;
    const a = requests("same", async (signal) => {
      upstream = signal;
      return new Promise<number>(() => {});
    }, abort.signal);
    const rejected = expect(a).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    abort.abort();
    await rejected;
    expect(upstream.aborted).toBe(true);
    await expect(requests("same", async () => 8)).resolves.toBe(8);
  });

  it("bounds distinct queued jobs and deadlines even an unresponsive adapter", async () => {
    vi.useFakeTimers();
    const requests = createSharedRequests<number>(1, 100);
    const first = requests("one", () => new Promise(() => {}));
    const timeout = expect(first).rejects.toMatchObject({ name: "TimeoutError" });
    await expect(requests("two", async () => 2)).rejects.toThrow("busy");
    await vi.advanceTimersByTimeAsync(100);
    await timeout;
    await expect(requests("three", async () => 3)).resolves.toBe(3);
  });

  it("cancelled queued work does not reserve an additional interval", async () => {
    vi.useFakeTimers();
    const gate = createRequestGate(100);
    await gate(new AbortController().signal);
    const abort = new AbortController();
    const waiting = gate(abort.signal);
    const rejected = expect(waiting).rejects.toMatchObject({ name: "AbortError" });
    abort.abort();
    const next = vi.fn();
    const final = gate(new AbortController().signal).then(next);
    await rejected;
    await vi.advanceTimersByTimeAsync(100);
    await final;
    expect(next).toHaveBeenCalledTimes(1);
  });
});
