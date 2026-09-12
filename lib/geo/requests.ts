/** Shared upstream jobs with independent cancellation and bounded resource use. */
export function createSharedRequests<T>(maxPending = 32, timeoutMs = 6_000) {
  const pending = new Map<string, { promise: Promise<T>; controller: AbortController; users: number }>();

  return (key: string, work: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> => {
    if (signal?.aborted) return Promise.reject(signal.reason);
    let job = pending.get(key);
    if (job?.controller.signal.aborted) job = undefined;
    if (!job) {
      if (pending.size >= maxPending) return Promise.reject(new Error("Geocoder is busy"));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new DOMException("Geocoder timed out", "TimeoutError")), timeoutMs);
      const aborted = new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
      });
      job = { controller, users: 0, promise: Promise.race([Promise.resolve().then(() => work(controller.signal)), aborted]) };
      pending.set(key, job);
      const current = job;
      const cleanup = () => {
        clearTimeout(timer);
        if (pending.get(key) === current) pending.delete(key);
      };
      void job.promise.then(cleanup, cleanup);
    }
    const current = job;
    current.users += 1;
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (error: boolean, value: unknown) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", onAbort);
        current.users -= 1;
        if (current.users === 0) current.controller.abort(new DOMException("No active lookups", "AbortError"));
        if (error) reject(value); else resolve(value as T);
      };
      const onAbort = () => finish(true, signal?.reason);
      signal?.addEventListener("abort", onAbort, { once: true });
      void current.promise.then((value) => finish(false, value), (error) => finish(true, error));
    });
  };
}

/** Jobs wait only while active; cancelled jobs do not reserve future slots. */
export function createRequestGate(intervalMs: number) {
  let nextAt = 0;
  let tail = Promise.resolve();
  return (signal: AbortSignal): Promise<void> => {
    const task = tail.then(async () => {
      signal.throwIfAborted();
      const delay = Math.max(0, nextAt - Date.now());
      if (delay > 0) await new Promise<void>((resolve, reject) => {
        const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, delay);
        signal.addEventListener("abort", onAbort, { once: true });
      });
      signal.throwIfAborted();
      nextAt = Date.now() + intervalMs;
    });
    tail = task.catch(() => {});
    return task;
  };
}
