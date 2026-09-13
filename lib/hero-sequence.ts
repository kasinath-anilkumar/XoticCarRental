export interface HeroSequenceOptions {
  canvas: HTMLCanvasElement;
  frames: readonly string[];
  /** The frame actually painted, which may be a nearby loaded frame. */
  onFrame?: (index: number) => void;
  onReady?: () => void;
}

export interface HeroSequence {
  seek(index: number): void;
  /** Portrait surfaces decode a centred crop matching their own shape. */
  resize(width: number, height: number, portrait?: boolean): void;
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
    context = canvas.getContext("2d", { alpha: false, desynchronized: true });
  } catch {
    return inactivePlayer;
  }
  if (!context) return inactivePlayer;
  const ctx = context;

  const mobile = (window.screen?.width || window.innerWidth) < 768;
  const capacity = mobile ? 8 : 12;
  const decodeWidth = mobile ? 768 : 1280;
  const decodeHeight = decodeWidth * 9 / 16;
  const lookAhead = mobile ? 4 : 8;
  const blobBudget = (mobile ? 3 : 6) * 1024 * 1024;
  const blobCapacity = mobile ? 32 : 64;
  const decoded = new Map<number, ImageBitmap>();
  const encoded = new Map<number, Blob>();
  const running = new Map<number, { controller: AbortController; phase: "fetch" | "decode" }>();
  const failed = new Set<number>();
  let encodedBytes = 0;
  let decoding = 0;
  let target = 0;
  let direction = 1;
  let moving = false;
  let disposed = false;
  let ready = false;
  // Width/height of the portrait crop; null decodes whole landscape frames.
  let cropAspect: number | null = null;
  // Bitmaps decoded for a previous shape are discarded, never painted.
  let shape = 0;
  let source: { width: number; height: number } | undefined;
  let painted = -1;
  let lastCancellation = Number.NEGATIVE_INFINITY;
  let animationFrame: number | null = null;
  let wanted = nearby();

  function nearby(): number[] {
    const indices = [target];
    // Startup remains four frames (three on mobile). Once scrolling starts,
    // spend the small window mostly in the direction the visitor is moving.
    const ahead = moving ? lookAhead : mobile ? 2 : 3;
    for (let distance = 1; distance <= ahead; distance += 1) {
      const index = target + distance * direction;
      if (index >= 0 && index < frames.length) indices.push(index);
    }
    const behind = target - direction;
    if (moving && behind >= 0 && behind < frames.length) indices.push(behind);
    return indices;
  }

  function touch(index: number, bitmap: ImageBitmap) {
    decoded.delete(index);
    decoded.set(index, bitmap);
  }

  function trim() {
    // Reserve room before a decode starts, including bitmaps whose promises
    // have not settled yet, rather than briefly exceeding the memory budget.
    while (decoded.size > capacity - decoding) {
      // Retain the displayed frame so resizing can repaint immediately even
      // during a distant seek. All other entries follow least-recent use.
      const candidates = [...decoded.keys()].filter((index) => index !== painted && index !== target);
      const oldest = candidates.find((index) => !wanted.includes(index)) ?? candidates[0];
      if (oldest === undefined) break;
      decoded.get(oldest)!.close();
      decoded.delete(oldest);
    }
  }

  function rememberBlob(index: number, blob: Blob) {
    if (!blob.size || blob.size > blobBudget) return;
    const previous = encoded.get(index);
    if (previous) encodedBytes -= previous.size;
    encoded.delete(index);
    encoded.set(index, blob);
    encodedBytes += blob.size;
    while (encodedBytes > blobBudget || encoded.size > blobCapacity) {
      const oldest = encoded.keys().next().value!;
      encodedBytes -= encoded.get(oldest)!.size;
      encoded.delete(oldest);
    }
  }

  function draw(force = false) {
    if (disposed || decoded.size === 0 || canvas.width < 1 || canvas.height < 1) return;
    let closest = decoded.has(target) ? target : -1;
    if (closest < 0) {
      for (const index of decoded.keys()) {
        // A forward scrub must not show a future frame and then hop backward
        // when the requested frame arrives. Keep progress monotonic while
        // allowing a deliberate reversal and always settling the exact target.
        const approaching = direction > 0 ? index <= target : index >= target;
        const advancing = painted < 0 || (direction > 0 ? index >= painted : index <= painted);
        if (approaching && advancing && (closest < 0 || Math.abs(index - target) < Math.abs(closest - target))) closest = index;
      }
    }
    if (closest < 0 && decoded.has(painted)) closest = painted;
    // A missing first file still has a useful fallback, without repeatedly
    // requesting it. Otherwise the poster stays until an appropriate frame.
    if (closest < 0 && failed.has(target)) {
      for (const index of decoded.keys()) {
        if (closest < 0 || Math.abs(index - target) < Math.abs(closest - target)) closest = index;
      }
    }
    if (closest < 0) return;
    if (!force && closest === painted) return;
    const bitmap = decoded.get(closest)!;
    if (bitmap.width < 1 || bitmap.height < 1) return;
    const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";
    // Cover overwrites the entire opaque canvas; no full-surface clear each frame.
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

  function current(controller: AbortController) {
    return !disposed && !controller.signal.aborted;
  }

  /** Portrait bitmaps keep the landscape pixel budget at the crop's own shape. */
  function bitmapSize(aspect: number | null) {
    if (aspect === null) return [decodeWidth, decodeHeight] as const;
    const height = Math.round(Math.sqrt(decodeWidth * decodeHeight / aspect));
    return [Math.round(decodeWidth * decodeHeight / height), height] as const;
  }

  function centreCrop({ width, height }: { width: number; height: number }, aspect: number) {
    const cropWidth = Math.min(width, height * aspect);
    const cropHeight = Math.min(height, width / aspect);
    return [Math.round((width - cropWidth) / 2), Math.round((height - cropHeight) / 2), Math.round(cropWidth), Math.round(cropHeight)] as const;
  }

  async function decode(blob: Blob): Promise<ImageBitmap> {
    const aspect = cropAspect;
    const [resizeWidth, resizeHeight] = bitmapSize(aspect);
    // Fast bilinear resizing avoids expensive CPU resampling while scrolling.
    const options: ImageBitmapOptions = { resizeWidth, resizeHeight, resizeQuality: "low" };
    if (aspect === null) return createImageBitmap(blob, options);
    if (source) {
      const [x, y, width, height] = centreCrop(source, aspect);
      return createImageBitmap(blob, x, y, width, height, options);
    }
    // Sequence frames share dimensions: learn them once from a full decode.
    const full = await createImageBitmap(blob);
    try {
      source = { width: full.width, height: full.height };
      const [x, y, width, height] = centreCrop(source, aspect);
      return await createImageBitmap(full, x, y, width, height, options);
    } finally {
      full.close();
    }
  }

  async function load(index: number, job: { controller: AbortController; phase: "fetch" | "decode" }) {
    const { controller } = job;
    let reserved = false;
    try {
      let blob = encoded.get(index);
      if (!blob) {
        const response = await fetch(frames[index], { signal: controller.signal, credentials: "same-origin" });
        if (!response.ok) throw new Error(`Hero frame returned ${response.status}.`);
        if (!current(controller)) return;
        blob = await response.blob();
      }
      if (!current(controller)) return;
      rememberBlob(index, blob);
      job.phase = "decode";
      decoding += 1;
      reserved = true;
      trim();
      const generation = shape;
      const bitmap = await decode(blob);
      decoding -= 1;
      reserved = false;
      // Advancing a few frames must not throw away completed work: on slower
      // connections these late frames are what keep the sequence moving.
      if (!current(controller) || generation !== shape) {
        bitmap.close();
        return;
      }
      touch(index, bitmap);
      trim();
      scheduleDraw();
    } catch {
      // One failed file must not start an automatic retry loop. An intentional
      // later seek back to that frame permits another attempt.
      if (current(controller)) {
        failed.add(index);
        scheduleDraw();
      }
    } finally {
      if (reserved) decoding -= 1;
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
      const job = { controller, phase: "fetch" as const };
      running.set(index, job);
      void load(index, job);
    }
  }

  const player: HeroSequence = {
    seek(index) {
      if (disposed || !Number.isFinite(index)) return;
      const next = Math.max(0, Math.min(frames.length - 1, Math.round(index)));
      if (next !== target) {
        const jump = Math.abs(next - target);
        direction = next > target ? 1 : -1;
        target = next;
        moving = true;
        failed.delete(target);
        wanted = nearby();
        // A distant jump can open one network slot, at most once per 250ms.
        // Small advances and active decodes always finish; repeated scrolling
        // can therefore never cancel all useful work before it is displayed.
        const now = performance.now();
        if (jump >= capacity * 2 && now - lastCancellation >= 250) {
          const obsolete = [...running.entries()]
            .filter(([frame, job]) => job.phase === "fetch" && !job.controller.signal.aborted && Math.abs(frame - target) > capacity)
            .sort(([first], [second]) => Math.abs(second - target) - Math.abs(first - target))[0];
          if (obsolete) {
            obsolete[1].controller.abort();
            lastCancellation = now;
          }
        }
      }
      // The scroll component already calls seek inside RAF. Paint its cached
      // result now instead of putting the image a refresh behind the copy.
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
      draw();
      pump();
    },

    resize(width, height, fitPortrait = false) {
      if (disposed || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      // Crop shape is rounded so sub-pixel layout changes keep decoded frames.
      const aspect = fitPortrait ? Math.round(Math.min(16 / 9, Math.max(.25, width / height)) * 1000) / 1000 : null;
      const reshaped = aspect !== cropAspect;
      if (reshaped) {
        cropAspect = aspect;
        shape += 1;
        for (const bitmap of decoded.values()) bitmap.close();
        decoded.clear();
        painted = -1;
      }
      const [bitmapWidth, bitmapHeight] = bitmapSize(cropAspect);
      const ratio = Math.min(1.5, window.devicePixelRatio || 1, bitmapWidth / width, Math.sqrt(bitmapWidth * bitmapHeight / width / height));
      const nextWidth = Math.max(1, Math.floor(width * ratio));
      const nextHeight = Math.max(1, Math.floor(height * ratio));
      if (canvas.width === nextWidth && canvas.height === nextHeight && !reshaped) return;
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
      draw(true);
      if (reshaped) pump();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
      for (const { controller } of running.values()) controller.abort();
      for (const bitmap of decoded.values()) bitmap.close();
      decoded.clear();
      encoded.clear();
      encodedBytes = 0;
      failed.clear();
    },
  };

  pump();
  return player;
}
