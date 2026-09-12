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
let rafs: Map<number, FrameRequestCallback>;
let deferredDecodes: Array<{ index: number; options: ImageBitmapOptions; resolve: (bitmap: ImageBitmap) => void }>;
let holdDecodes: boolean;
let canvas: HTMLCanvasElement;
let ctx: { clearRect: ReturnType<typeof vi.fn>; drawImage: ReturnType<typeof vi.fn> };
let player: HeroSequence | undefined;

function bitmap(index: number, options: ImageBitmapOptions): TestBitmap {
  const value = {
    frame: index,
    width: options.resizeWidth!,
    height: options.resizeHeight!,
    close: vi.fn(() => living.delete(value)),
  } as unknown as TestBitmap;
  living.add(value);
  bitmapList.push(value);
  return value;
}

beforeEach(() => {
  requests = [];
  bitmapList = [];
  living = new Set();
  rafs = new Map();
  deferredDecodes = [];
  holdDecodes = false;
  player = undefined;
  ctx = { clearRect: vi.fn(), drawImage: vi.fn() };
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

function respond(index: number, ok = true) {
  const job = requests.find((request) => request.index === index && !request.finished);
  if (!job) throw new Error(`No active request for frame ${index}`);
  job.finished = true;
  job.resolve({ ok, status: ok ? 200 : 404, blob: async () => ({ index }) } as unknown as Response);
}

async function fillDemand() {
  for (let round = 0; round < 20; round += 1) {
    await settle();
    const pending = requests.filter((request) => !request.finished);
    if (pending.length === 0) {
      paint();
      return;
    }
    for (const request of pending) respond(request.index);
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

  it("prioritizes a distant seek and keeps the last image until a closer frame arrives", async () => {
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
    expect(requests.filter((request) => !request.finished).map((request) => request.index)).toEqual([90, 91, 89]);
    expect(requests.filter((request) => [1, 2, 3].includes(request.index)).every((request) => request.signal.aborted)).toBe(true);
    respond(91);
    await settle();
    paint();
    expect(onFrame).toHaveBeenLastCalledWith(91);
    respond(90);
    await settle();
    paint();
    expect(onFrame).toHaveBeenLastCalledWith(90);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it.each([{ screenWidth: 1440, budget: 12, decodeWidth: 1440 }, { screenWidth: 390, budget: 8, decodeWidth: 960 }])(
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
      expect(bitmapList.every((image) => image.width === decodeWidth)).toBe(true);
      expect(bitmapList.some((image) => !living.has(image))).toBe(true);
      expect(requests.length).toBeLessThan(40);
      player.dispose();
      expect(living.size).toBe(0);
      expect(bitmapList.every((image) => vi.mocked(image.close).mock.calls.length === 1)).toBe(true);
    },
  );

  it("caps canvas DPR and repaints cover and contain synchronously on resize", async () => {
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
    player.resize(400, 300, true);
    const contained = ctx.drawImage.mock.calls.at(-1)!;
    expect(contained.slice(1)).toEqual([0, 56.25, 600, 337.5]);
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

  it("discards a completed decode made obsolete by a newer seek", async () => {
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
    expect(image.close).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(requests.filter((request) => !request.finished).map((request) => request.index)).toEqual([100, 101, 99]);
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
