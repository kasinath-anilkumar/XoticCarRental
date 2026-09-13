import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createHeroSequence, type HeroSequence } from "./hero-sequence";

interface TestBitmap extends ImageBitmap { frame: number }
interface FetchJob {
  index: number;
  signal: AbortSignal;
  finished: boolean;
  resolve: (response: Response) => void;
  reject: (reason: unknown) => void;
}

const frames = Array.from({ length: 180 }, (_, index) => `/frame-${index}.jpg`);
let requests: FetchJob[];
let bitmapList: TestBitmap[];
let living: Set<TestBitmap>;
let peakBitmaps: number;
let rafs: Map<number, FrameRequestCallback>;
let deferredDecodes: Array<{ index: number; options: ImageBitmapOptions; resolve: (bitmap: ImageBitmap) => void }>;
let holdDecodes: boolean;
let canvas: HTMLCanvasElement;
let ctx: { clearRect: ReturnType<typeof vi.fn>; fillRect: ReturnType<typeof vi.fn>; drawImage: ReturnType<typeof vi.fn> };
let player: HeroSequence | undefined;

function bitmap(index: number, options: ImageBitmapOptions): TestBitmap {
  const value = {
    frame: index,
    width: options.resizeWidth!,
    height: options.resizeHeight!,
    close: vi.fn(() => living.delete(value)),
  } as unknown as TestBitmap;
  living.add(value);
  peakBitmaps = Math.max(peakBitmaps, living.size);
  bitmapList.push(value);
  return value;
}

beforeEach(() => {
  requests = [];
  bitmapList = [];
  living = new Set();
  peakBitmaps = 0;
  rafs = new Map();
  deferredDecodes = [];
  holdDecodes = false;
  player = undefined;
  ctx = { clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn() };
  canvas = { width: 300, height: 150, getContext: vi.fn(() => ctx) } as unknown as HTMLCanvasElement;
  let nextRaf = 0;
  vi.stubGlobal("window", {
    innerWidth: 1440,
    screen: { width: 1440 },
    devicePixelRatio: 2,
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      rafs.set(++nextRaf, callback);
      return nextRaf;
    }),
    cancelAnimationFrame: vi.fn((id: number) => rafs.delete(id)),
  });
  vi.stubGlobal("fetch", vi.fn((url: string, options: RequestInit) => new Promise<Response>((resolve, reject) => {
    const job: FetchJob = {
      index: Number(/frame-(\d+)/.exec(url)![1]),
      signal: options.signal!,
      finished: false,
      resolve,
      reject,
    };
    requests.push(job);
    job.signal.addEventListener("abort", () => {
      if (!job.finished) {
        job.finished = true;
        reject(new Error("Aborted"));
      }
    }, { once: true });
  })));
  vi.stubGlobal("createImageBitmap", vi.fn((blob: Blob & { index: number }, options: ImageBitmapOptions) => {
    if (holdDecodes) return new Promise<ImageBitmap>((resolve) => deferredDecodes.push({ index: blob.index, options, resolve }));
    return Promise.resolve(bitmap(blob.index, options));
  }));
});

afterEach(() => {
  player?.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function settle() {
  // Drain fetch, blob, decode and finally continuations without real timers.
  for (let tick = 0; tick < 16; tick += 1) await Promise.resolve();
}

function paint() {
  const callbacks = [...rafs.values()];
  rafs.clear();
  for (const callback of callbacks) callback(0);
}

function respond(index: number, ok = true, bytes = 93_000) {
  const job = requests.find((request) => request.index === index && !request.finished);
  if (!job) throw new Error(`No active request for frame ${index}`);
  job.finished = true;
  job.resolve({ ok, status: ok ? 200 : 404, blob: async () => ({ index, size: bytes }) } as unknown as Response);
}

async function fillDemand(bytes = 93_000) {
  for (let round = 0; round < 20; round += 1) {
    await settle();
    const pending = requests.filter((request) => !request.finished);
    if (pending.length === 0) {
      paint();
      return;
    }
    for (const request of pending) respond(request.index, true, bytes);
  }
  throw new Error("Demand did not settle; the player may be loading continuously.");
}

describe("hero frame player", () => {
  it("starts a small frame window and includes decoding in the three-slot limit", async () => {
    holdDecodes = true;
    player = createHeroSequence({ canvas, frames });
    expect(requests.map((request) => request.index)).toEqual([0, 1, 2]);
    for (const index of [0, 1, 2]) respond(index);
    await settle();
    expect(deferredDecodes).toHaveLength(3);
    expect(requests).toHaveLength(3);
    const first = deferredDecodes[0];
    first.resolve(bitmap(first.index, first.options));
    await settle();
    expect(requests.map((request) => request.index)).toEqual([0, 1, 2, 3]);
    player.dispose();
    for (const decode of deferredDecodes.slice(1)) decode.resolve(bitmap(decode.index, decode.options));
    await settle();
    expect(living.size).toBe(0);
  });

  it("opens one slot for a distant seek and avoids painting ahead then hopping backward", async () => {
    const onReady = vi.fn();
    const onFrame = vi.fn();
    player = createHeroSequence({ canvas, frames, onReady, onFrame });
    respond(0);
    await settle();
    paint();
    expect(onFrame).toHaveBeenLastCalledWith(0);
    const clears = ctx.clearRect.mock.calls.length;
    player.seek(90);
    paint();
    expect(ctx.clearRect).toHaveBeenCalledTimes(clears);
    await settle();
    expect(requests.filter((request) => !request.finished).map((request) => request.index)).toEqual([2, 3, 90]);
    expect(requests.filter((request) => request.signal.aborted)).toHaveLength(1);
    respond(2);
    respond(3);
    await settle();
    paint();
    expect(onFrame).toHaveBeenLastCalledWith(3);
    respond(91);
    await settle();
    paint();
    expect(onFrame).toHaveBeenLastCalledWith(3);
    respond(90);
    await settle();
    paint();
    expect(onFrame).toHaveBeenLastCalledWith(90);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it.each([{ screenWidth: 1440, budget: 12, decodeWidth: 1280 }, { screenWidth: 390, budget: 8, decodeWidth: 768 }])(
    "closes evicted frames and stays within the $budget bitmap budget",
    async ({ screenWidth, budget, decodeWidth }) => {
      Object.defineProperty(window.screen, "width", { value: screenWidth });
      player = createHeroSequence({ canvas, frames });
      for (const target of [0, 10, 20, 30]) {
        player.seek(target);
        await fillDemand();
        expect(living.size).toBeLessThanOrEqual(budget);
      }
      expect(living.size).toBe(budget);
      expect(peakBitmaps).toBeLessThanOrEqual(budget);
      expect(bitmapList.every((image) => image.width === decodeWidth)).toBe(true);
      expect(bitmapList.some((image) => !living.has(image))).toBe(true);
      expect(requests.length).toBeLessThan(40);
      player.dispose();
      expect(living.size).toBe(0);
      expect(bitmapList.every((image) => vi.mocked(image.close).mock.calls.length === 1)).toBe(true);
    },
  );

  it("caps canvas DPR and repaints cover synchronously on resize", async () => {
    player = createHeroSequence({ canvas, frames });
    respond(0);
    await settle();
    paint();
    player.resize(400, 300);
    expect([canvas.width, canvas.height]).toEqual([600, 450]);
    const cover = ctx.drawImage.mock.calls.at(-1)!;
    expect(cover[1]).toBeCloseTo(-100);
    expect(cover[2]).toBeCloseTo(0);
    expect(cover[3]).toBeCloseTo(800);
    expect(cover[4]).toBeCloseTo(450);
    const draws = ctx.drawImage.mock.calls.length;
    player.resize(400, 300);
    expect(ctx.drawImage).toHaveBeenCalledTimes(draws);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.clearRect).not.toHaveBeenCalled();
    player.resize(1920, 1200);
    expect(canvas.width).toBeLessThanOrEqual(1280);
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(1280 * 720);
  });

  it("decodes a centred crop matching portrait surfaces and discards other shapes", async () => {
    Object.defineProperty(window.screen, "width", { value: 390 });
    const crops: number[][] = [];
    const fullDecodes: TestBitmap[] = [];
    vi.stubGlobal("createImageBitmap", vi.fn((image: { index?: number; frame?: number }, ...args: unknown[]) => {
      if (args.length === 0) {
        const full = bitmap(image.index!, { resizeWidth: 1920, resizeHeight: 1080 });
        fullDecodes.push(full);
        return Promise.resolve(full);
      }
      if (args.length === 1) return Promise.resolve(bitmap(image.index!, args[0] as ImageBitmapOptions));
      crops.push(args.slice(0, 4) as number[]);
      return Promise.resolve(bitmap(image.index ?? image.frame!, args[4] as ImageBitmapOptions));
    }));
    player = createHeroSequence({ canvas, frames });
    player.resize(360, 640, true);
    expect([canvas.width, canvas.height]).toEqual([432, 768]);
    await fillDemand();
    expect(fullDecodes.length).toBeGreaterThan(0);
    expect(fullDecodes.every((image) => !living.has(image))).toBe(true);
    expect(crops.every((crop) => crop.join() === "656,0,608,1080")).toBe(true);
    const portraitFrames = [...living];
    expect(portraitFrames.every((image) => image.width === 432 && image.height === 768)).toBe(true);
    expect(ctx.drawImage.mock.calls.at(-1)!.slice(1)).toEqual([0, 0, 432, 768]);

    player.resize(360, 480, true);
    expect(portraitFrames.every((image) => !living.has(image))).toBe(true);
    await fillDemand();
    expect(crops.at(-1)!.join()).toBe("555,0,810,1080");
    expect([...living].every((image) => image.width === 499 && image.height === 665)).toBe(true);

    player.resize(390, 219);
    await fillDemand();
    expect([...living].every((image) => image.width === 768 && image.height === 432)).toBe(true);
    expect(ctx.drawImage.mock.calls.at(-1)![0].width).toBe(768);
  });

  it("closes a bitmap decoded after disposal and never paints or signals readiness", async () => {
    holdDecodes = true;
    const onReady = vi.fn();
    player = createHeroSequence({ canvas, frames, onReady });
    respond(0);
    await settle();
    player.seek(1);
    player.dispose();
    const pending = deferredDecodes[0];
    const image = bitmap(pending.index, pending.options);
    pending.resolve(image);
    await settle();
    paint();
    expect(image.close).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
    expect(rafs.size).toBe(0);
    expect(requests.every((request) => request.signal.aborted)).toBe(true);
  });

  it("retains late successful decodes so moving targets do not starve the visible sequence", async () => {
    holdDecodes = true;
    const onReady = vi.fn();
    player = createHeroSequence({ canvas, frames, onReady });
    respond(0);
    await settle();
    const pending = deferredDecodes[0];
    player.seek(100);
    await settle();
    const image = bitmap(pending.index, pending.options);
    pending.resolve(image);
    await settle();
    paint();
    expect(image.close).not.toHaveBeenCalled();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(requests.filter((request) => !request.finished).map((request) => request.index)).toEqual([2, 100, 101]);
  });

  it("paints an already decoded seek synchronously and reuses visited encoded frames", async () => {
    const onFrame = vi.fn();
    player = createHeroSequence({ canvas, frames, onFrame });
    await fillDemand();
    player.seek(2);
    expect(onFrame).toHaveBeenLastCalledWith(2);
    expect(rafs.size).toBe(0);
    await fillDemand();
    player.seek(30);
    await fillDemand();
    player.seek(60);
    await fillDemand();
    expect([...living].some((image) => image.frame === 0)).toBe(false);
    player.seek(0);
    await fillDemand();
    expect(onFrame).toHaveBeenLastCalledWith(0);
    expect(requests.filter((request) => request.index === 0)).toHaveLength(1);
    expect(bitmapList.filter((image) => image.frame === 0)).toHaveLength(2);
  });

  it("limits cancellation during repeated distant jumps", async () => {
    player = createHeroSequence({ canvas, frames });
    for (const target of [50, 100, 150]) {
      player.seek(target);
      await settle();
    }
    expect(requests.filter((request) => request.signal.aborted)).toHaveLength(1);
    await fillDemand();
    expect(ctx.drawImage.mock.calls.at(-1)?.[0].frame).toBe(150);
  });

  it("evicts visited encoded data by byte budget instead of retaining the entire sequence", async () => {
    player = createHeroSequence({ canvas, frames });
    for (const target of [0, 10, 20, 30]) {
      player.seek(target);
      await fillDemand(300_000);
    }
    player.seek(0);
    await fillDemand();
    expect(requests.filter((request) => request.index === 0)).toHaveLength(2);
  });

  it.each([1, 2])("keeps painting through continuous %s-frame seeks while fetch and decode are delayed", async (step) => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const underlyingFetch = globalThis.fetch;
    let decoders = 0;
    let peakDecoders = 0;
    let peakLoads = 0;
    const measure = () => {
      peakDecoders = Math.max(peakDecoders, decoders);
      peakLoads = Math.max(peakLoads, decoders + requests.filter((request) => !request.finished).length);
    };
    vi.stubGlobal("fetch", vi.fn((url: string, options: RequestInit) => {
      const result = underlyingFetch(url, options);
      const request = requests.at(-1)!;
      measure();
      const timeout = setTimeout(() => { if (!request.finished) respond(request.index); }, 60);
      request.signal.addEventListener("abort", () => clearTimeout(timeout), { once: true });
      return result;
    }));
    vi.stubGlobal("createImageBitmap", vi.fn((blob: Blob & { index: number }, options: ImageBitmapOptions) => {
      decoders += 1;
      measure();
      return new Promise<ImageBitmap>((resolve) => setTimeout(() => {
        decoders -= 1;
        resolve(bitmap(blob.index, options));
      }, 30));
    }));
    window.requestAnimationFrame = vi.fn((callback) => setTimeout(() => callback(Date.now()), 16) as unknown as number);
    window.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));
    const paintedFrames: Array<{ time: number; index: number }> = [];
    player = createHeroSequence({ canvas, frames, onFrame: (index) => paintedFrames.push({ time: Date.now(), index }) });
    await vi.advanceTimersByTimeAsync(240);
    expect(requests.length).toBeLessThanOrEqual(4);
    const start = Date.now();
    for (let target = step; target < 179 + step; target += step) {
      await vi.advanceTimersByTimeAsync(16);
      player.seek(Math.min(179, target));
    }
    const end = Date.now();
    const during = paintedFrames.filter((frame) => frame.time >= start && frame.time <= end);
    const times = [start, ...during.map((frame) => frame.time), end];
    const longestGap = Math.max(...times.slice(1).map((time, index) => time - times[index]));
    expect(during.length).toBeGreaterThanOrEqual(step === 1 ? 24 : 12);
    expect(longestGap).toBeLessThanOrEqual(180);
    expect(requests.filter((request) => request.signal.aborted)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(paintedFrames.at(-1)?.index).toBe(179);
    expect(paintedFrames.every((frame, index) => index === 0 || frame.index >= paintedFrames[index - 1].index)).toBe(true);
    expect(peakLoads).toBeLessThanOrEqual(3);
    expect(peakDecoders).toBeLessThanOrEqual(3);
    expect(peakBitmaps).toBeLessThanOrEqual(12);
    expect(decoders).toBe(0);
    player.dispose();
    expect(living.size).toBe(0);
  });

  it("does not retry failed frames in a loop and leaves the poster when decoding is unsupported", async () => {
    player = createHeroSequence({ canvas, frames });
    for (let round = 0; round < 4; round += 1) {
      for (const request of requests.filter((request) => !request.finished)) respond(request.index, false);
      await settle();
    }
    expect(requests).toHaveLength(4);
    player.seek(0);
    await settle();
    expect(requests).toHaveLength(4);
    player.dispose();
    vi.stubGlobal("createImageBitmap", undefined);
    const onReady = vi.fn();
    player = createHeroSequence({ canvas, frames, onReady });
    player.seek(50);
    player.resize(400, 300);
    expect(requests).toHaveLength(4);
    expect(onReady).not.toHaveBeenCalled();
  });
});
