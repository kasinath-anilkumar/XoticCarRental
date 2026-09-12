export interface HeroSequenceOptions {
  canvas: HTMLCanvasElement;
  frames: readonly string[];
  /** The frame actually painted, which may be a nearby loaded frame. */
  onFrame?: (index: number) => void;
  onReady?: () => void;
}

export interface HeroSequence {
  seek(index: number): void;
  resize(width: number, height: number, contain?: boolean): void;
  dispose(): void;
}

const inactivePlayer: HeroSequence = {
  seek() {},
  resize() {},
  dispose() {},
};

/**
 * A demand-driven image sequence: only the current frame and its immediate
 * neighbours load. Decoded frames have an explicit memory budget; scrolling
 * to the end never starts a background download of the whole sequence.
 */
export function createHeroSequence({ canvas, frames, onFrame, onReady }: HeroSequenceOptions): HeroSequence {
  if (typeof window === "undefined" || typeof createImageBitmap !== "function" || frames.length === 0) {
    return inactivePlayer;
  }

  let context: CanvasRenderingContext2D | null;
  try {
    context = canvas.getContext("2d", { alpha: true });
  } catch {
    return inactivePlayer;
  }
  if (!context) return inactivePlayer;
  const ctx = context;

  const mobile = (window.screen?.width || window.innerWidth) < 768;
  const capacity = mobile ? 8 : 12;
  const decodeWidth = mobile ? 960 : 1440;
  const radius = mobile ? 2 : 3;
  const decoded = new Map<number, ImageBitmap>();
  const running = new Map<number, AbortController>();
  const failed = new Set<number>();
  let target = 0;
  let direction = 1;
  let disposed = false;
  let ready = false;
  let contain = false;
  let painted = -1;
  let animationFrame: number | null = null;
  let wanted = nearby();

  function nearby(): number[] {
    const indices = [target];
    for (let distance = 1; distance <= radius; distance += 1) {
      for (const index of [target + distance * direction, target - distance * direction]) {
        if (index >= 0 && index < frames.length) indices.push(index);
      }
    }
    return indices;
  }

  function touch(index: number, bitmap: ImageBitmap) {
    decoded.delete(index);
    decoded.set(index, bitmap);
  }

  function trim() {
    while (decoded.size > capacity) {
      // Retain the displayed frame so resizing can repaint immediately even
      // during a distant seek. All other entries follow least-recent use.
      const oldest = [...decoded.keys()].find((index) => index !== painted && index !== target);
      if (oldest === undefined) break;
      decoded.get(oldest)!.close();
      decoded.delete(oldest);
    }
  }

  function draw(force = false) {
    if (disposed || decoded.size === 0 || canvas.width < 1 || canvas.height < 1) return;
    let closest = -1;
    for (const index of decoded.keys()) {
      if (closest < 0 || Math.abs(index - target) < Math.abs(closest - target)) closest = index;
    }
    if (!force && closest === painted) return;
    const bitmap = decoded.get(closest)!;
    if (bitmap.width < 1 || bitmap.height < 1) return;
    const scale = (contain ? Math.min : Math.max)(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Clear and draw in the same task; a waiting fetch never clears the last
    // successful picture. Transparent margins are needed for contain mode.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    touch(closest, bitmap);
    const changed = painted !== closest;
    painted = closest;
    if (!ready) {
      ready = true;
      onReady?.();
    }
    if (changed && !disposed) onFrame?.(closest);
  }

  function scheduleDraw() {
    if (disposed || animationFrame !== null) return;
    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = null;
      draw();
    });
  }

  function current(index: number, controller: AbortController) {
    return !disposed && !controller.signal.aborted && wanted.includes(index);
  }

  async function load(index: number, controller: AbortController) {
    try {
      const response = await fetch(frames[index], { signal: controller.signal, credentials: "same-origin" });
      if (!response.ok) throw new Error(`Hero frame returned ${response.status}.`);
      if (!current(index, controller)) return;
      const blob = await response.blob();
      if (!current(index, controller)) return;
      const bitmap = await createImageBitmap(blob, {
        resizeWidth: decodeWidth,
        resizeHeight: Math.round(decodeWidth * 9 / 16),
        resizeQuality: "high",
      });
      // ImageBitmap decoding itself cannot be aborted. Dispose or a newer
      // seek may have made its result obsolete while decoding was underway.
      if (!current(index, controller)) {
        bitmap.close();
        return;
      }
      touch(index, bitmap);
      trim();
      scheduleDraw();
    } catch {
      // One failed file must not start an automatic retry loop. An intentional
      // later seek back to that frame permits another attempt.
      if (current(index, controller)) failed.add(index);
    } finally {
      running.delete(index);
      pump();
    }
  }

  function pump() {
    if (disposed) return;
    for (const index of wanted) {
      if (running.size >= 3) break;
      if (decoded.has(index) || running.has(index) || failed.has(index)) continue;
      const controller = new AbortController();
      running.set(index, controller);
      void load(index, controller);
    }
  }

  const player: HeroSequence = {
    seek(index) {
      if (disposed || !Number.isFinite(index)) return;
      const next = Math.max(0, Math.min(frames.length - 1, Math.round(index)));
      if (next !== target) {
        direction = next > target ? 1 : -1;
        target = next;
        failed.delete(target);
        wanted = nearby();
        for (const [frame, controller] of running) {
          if (!wanted.includes(frame)) controller.abort();
        }
      }
      scheduleDraw();
      pump();
    },

    resize(width, height, fitContain = false) {
      if (disposed || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      const ratio = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
      const nextWidth = Math.max(1, Math.round(width * ratio));
      const nextHeight = Math.max(1, Math.round(height * ratio));
      contain = fitContain;
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
      draw(true);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
      for (const controller of running.values()) controller.abort();
      for (const bitmap of decoded.values()) bitmap.close();
      decoded.clear();
      failed.clear();
    },
  };

  pump();
  return player;
}
