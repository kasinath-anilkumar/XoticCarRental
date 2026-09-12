/**
 * Test photography.
 *
 *   node scripts/media.mjs
 *
 * Every image slot on this site renders a dark well until a real photograph is
 * uploaded — which is correct for production and useless for judging a layout.
 * You cannot see whether a card's price still reads over a photo, whether a
 * hero's gradient has enough ink under the headline, or whether the fleet grid
 * looks like a grid, when every slot is the same empty rectangle.
 *
 * So this writes a plate for every slot: a studio-lit side profile for each
 * car, a skyline for each city, a motif for each occasion. They are obviously
 * not photographs — that is the point, nobody should ship them — but they have
 * the tonal range and the subject placement of the real thing, so the layout
 * can be judged against something.
 *
 * Deterministic: the same slug always produces the same plate, so a diff of
 * public/media is a diff of this file, never of a random seed.
 *
 * No dependencies. PNG is written by hand (a PNG is a zlib stream in four
 * chunks) and the shapes are rasterised with 3×3 supersampling, which is all
 * the antialiasing a silhouette needs.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seed = require(join(root, "backend", "seed-data.js"));

// ── the canvas ──────────────────────────────────────────────────────────────

/** Straight RGB, one byte a channel. Alpha is composited on the way in. */
class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height * 3);
  }

  blend(x, y, [r, g, b], alpha) {
    if (alpha <= 0 || x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    const a = Math.min(1, alpha);
    this.pixels[i] += (r - this.pixels[i]) * a;
    this.pixels[i + 1] += (g - this.pixels[i + 1]) * a;
    this.pixels[i + 2] += (b - this.pixels[i + 2]) * a;
  }

  /**
   * Fills wherever `inside(x, y)` says so.
   *
   * Sampled on a 3×3 grid inside each pixel: a wheel arch or a windscreen rake
   * is all diagonal, and a hard edge on a 1280px plate reads as a jaggy.
   */
  fill(inside, color, alpha = 1, bounds) {
    const x0 = Math.max(0, Math.floor(bounds?.x0 ?? 0));
    const x1 = Math.min(this.width, Math.ceil(bounds?.x1 ?? this.width));
    const y0 = Math.max(0, Math.floor(bounds?.y0 ?? 0));
    const y1 = Math.min(this.height, Math.ceil(bounds?.y1 ?? this.height));

    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        let hits = 0;
        for (let sy = 0; sy < 3; sy += 1) {
          for (let sx = 0; sx < 3; sx += 1) {
            if (inside(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3)) hits += 1;
          }
        }
        if (hits) this.blend(x, y, color, (alpha * hits) / 9);
      }
    }
  }

  /** Per-pixel colour — for gradients, glows and vignettes. */
  shade(fn) {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const paint = fn(x, y);
        if (paint) this.blend(x, y, paint.color, paint.alpha ?? 1);
      }
    }
  }

  toPng() {
    // One filter byte per scanline. Filter 1 (Sub) predicts each pixel from the
    // one to its left, which is close to free on flat plates and gradients.
    const stride = this.width * 3;
    const raw = new Uint8Array((stride + 1) * this.height);
    for (let y = 0; y < this.height; y += 1) {
      const from = y * stride;
      const to = y * (stride + 1);
      raw[to] = 1;
      for (let i = 0; i < stride; i += 1) {
        const left = i >= 3 ? this.pixels[from + i - 3] : 0;
        raw[to + 1 + i] = (this.pixels[from + i] - left) & 0xff;
      }
    }

    const ihdr = new Uint8Array(13);
    const view = new DataView(ihdr.buffer);
    view.setUint32(0, this.width);
    view.setUint32(4, this.height);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // truecolour
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", new Uint8Array(0)),
    ]);
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, crc]);
}

// ── colour ──────────────────────────────────────────────────────────────────

const mix = (a, b, t) => a.map((channel, i) => channel + (b[i] - channel) * t);

/** OKLCH would be nicer; for a placeholder, HSL is enough. */
function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// In step with the brand: app/globals.css, from scripts/palette.mjs.
const ACCENT = [255, 122, 0];
const INK = [8, 8, 8];

/** Deterministic per slug, so a rebuild is byte-identical. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function random(sourceSeed) {
  let state = sourceSeed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── shapes ──────────────────────────────────────────────────────────────────

const circle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

const ellipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

const ring = (cx, cy, outer, inner) => (x, y) => {
  const d = (x - cx) ** 2 + (y - cy) ** 2;
  return d <= outer * outer && d >= inner * inner;
};

function roundRect(x0, y0, w, h, r) {
  const x1 = x0 + w;
  const y1 = y0 + h;
  return (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + r), x1 - r);
    const cy = Math.min(Math.max(y, y0 + r), y1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r || (x >= x0 + r && x <= x1 - r) || (y >= y0 + r && y <= y1 - r);
  };
}

function polygon(points) {
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}

const boundsOf = (points) => ({
  x0: Math.min(...points.map((p) => p[0])) - 1,
  x1: Math.max(...points.map((p) => p[0])) + 1,
  y0: Math.min(...points.map((p) => p[1])) - 1,
  y1: Math.max(...points.map((p) => p[1])) + 1,
});

// ── the plates ──────────────────────────────────────────────────────────────

/**
 * The ground every plate stands on: a dark studio sweep with one soft light.
 * Dark because the site's own image treatment is `mix-blend-mode: lighten` over
 * a near-black plate, and a bright placeholder would flatter a layout that will
 * not look like that in production.
 */
function studio(canvas, tint) {
  const { width, height } = canvas;
  const top = mix(INK, tint, 0.22);
  const bottom = mix(INK, [0, 0, 0], 0.35);
  const lightX = width * 0.5;
  const lightY = height * 0.38;
  const reach = Math.hypot(width, height) * 0.62;

  canvas.shade((x, y) => {
    const base = mix(top, bottom, (y / height) ** 1.15);
    const d = Math.hypot(x - lightX, y - lightY) / reach;
    const lit = mix(base, mix(base, tint, 0.5), Math.max(0, 1 - d) ** 2 * 0.55);
    // A vignette, so a caption over the corner always has ink under it.
    const vignette = Math.max(
      0,
      (Math.hypot((x - width / 2) / (width / 2), (y - height / 2) / (height / 2)) - 0.65) * 0.5,
    );
    return { color: mix(lit, [0, 0, 0], Math.min(0.55, vignette)), alpha: 1 };
  });
}

/**
 * Body proportions, by the car type slugs the seed actually uses.
 *
 * Everything is a fraction of the car's own length: x measured from its centre,
 * y as height above the ground. So one description draws a 1280px hero and a
 * 640px thumbnail identically, and a van differs from a sedan by numbers rather
 * than by a second drawing.
 *
 *   belt      top of the lower body — where the doors stop and the glass starts
 *   roof      roofline
 *   cowl      where the windscreen meets the bonnet
 *   roofBack  where the roof ends and the rear screen starts
 *   boot      the back of the boot lid
 *   wheel     tyre radius
 */
const SHAPES = {
  "luxury-sedan": { belt: 0.175, roof: 0.30, cowl: 0.05, roofBack: -0.25, boot: -0.44, wheel: 0.082 },
  sedan: { belt: 0.18, roof: 0.30, cowl: 0.05, roofBack: -0.24, boot: -0.43, wheel: 0.082 },
  muv: { belt: 0.215, roof: 0.38, cowl: 0.14, roofBack: -0.38, boot: -0.47, wheel: 0.088 },
  suv: { belt: 0.235, roof: 0.40, cowl: 0.10, roofBack: -0.34, boot: -0.46, wheel: 0.098 },
  "luxury-suv": { belt: 0.24, roof: 0.40, cowl: 0.09, roofBack: -0.33, boot: -0.46, wheel: 0.1 },
  "premium-muv": { belt: 0.22, roof: 0.39, cowl: 0.15, roofBack: -0.40, boot: -0.48, wheel: 0.09 },
  "premium-van": { belt: 0.235, roof: 0.48, cowl: 0.24, roofBack: -0.45, boot: -0.49, wheel: 0.085 },
  "van-tempo": { belt: 0.245, roof: 0.52, cowl: 0.28, roofBack: -0.47, boot: -0.49, wheel: 0.083 },
  "ultra-luxury": { belt: 0.17, roof: 0.29, cowl: 0.02, roofBack: -0.27, boot: -0.46, wheel: 0.08 },
  // Low and long: the roof sits barely above the belt, and the boot is short.
  // The belt has to clear twice the wheel radius, or the tyres stand taller
  // than the body and the car reads as a go-kart.
  convertible: { belt: 0.185, roof: 0.25, cowl: 0.02, roofBack: -0.16, boot: -0.38, wheel: 0.078 },
  sports: { belt: 0.19, roof: 0.275, cowl: 0.01, roofBack: -0.20, boot: -0.40, wheel: 0.082 },
  // Upright glass and a tall roof, the way fifties cars sat.
  vintage: { belt: 0.215, roof: 0.355, cowl: 0.12, roofBack: -0.20, boot: -0.42, wheel: 0.092 },
  // Same roofline as a luxury sedan, stretched past the axles.
  // …and the rear axle moves back with it, or the wheel sits under the middle
  // of the cabin with half a car hanging off the back.
  limousine: {
    belt: 0.17, roof: 0.30, cowl: 0.17, roofBack: -0.36, boot: -0.50, wheel: 0.072,
    axles: [0.35, -0.40],
  },
};

/**
 * A car, side on: one closed profile with the wheel arches cut out of it.
 *
 * Cutting the arches is what makes it read as a car rather than a box on
 * wheels — and the cut has to be centred on the hub, not on the ground, or the
 * tyre stands proud of the arch and the whole thing looks like a toy.
 *
 * `zoom` frames it: 1 puts the whole car in the plate, higher crops in.
 */
function drawCar(canvas, { type, tint, zoom = 1, offsetX = 0, flip = false }) {
  const { width, height } = canvas;
  const s = SHAPES[type] ?? SHAPES.sedan;
  const unit = width * 0.84 * zoom;
  const centre = width * (0.5 + offsetX);
  const ground = height * 0.82;

  const dir = flip ? -1 : 1;
  const px = (fx) => centre + fx * dir * unit;
  const py = (fy) => ground - fy * unit;

  const wheelR = unit * s.wheel;
  const hub = s.wheel; // hub height above the ground, in units
  const sill = s.wheel * 0.8;
  const axles = s.axles ?? [0.3, -0.3];

  const body = mix(mix(INK, [255, 255, 255], 0.26), tint, 0.3);
  const shoulder = mix(body, [255, 255, 255], 0.45);
  const glass = mix(INK, [130, 175, 215], 0.24);

  // Contact shadow first: it is what puts the car on the floor rather than in
  // front of it.
  canvas.fill(ellipse(centre, ground + unit * 0.006, unit * 0.46, unit * 0.024), [0, 0, 0], 0.55, {
    x0: centre - unit * 0.55, x1: centre + unit * 0.55, y0: ground - unit * 0.05, y1: ground + unit * 0.06,
  });

  // Once around the car: nose, bonnet, windscreen, roof, rear screen, boot,
  // tail, then back along the sill.
  const outline = [
    [px(0.5), py(s.belt - 0.062)],
    [px(0.475), py(s.belt - 0.022)],
    [px(0.42), py(s.belt - 0.006)],
    [px(s.cowl + 0.02), py(s.belt + 0.008)],
    [px(s.cowl - 0.085), py(s.roof)],
    [px(s.roofBack + 0.02), py(s.roof)],
    [px(s.roofBack - 0.07), py(s.belt + 0.008)],
    [px(s.boot), py(s.belt - 0.006)],
    [px(-0.475), py(s.belt - 0.022)],
    [px(-0.5), py(s.belt - 0.062)],
    [px(-0.5), py(sill + 0.035)],
    [px(-0.44), py(sill)],
    [px(0.44), py(sill)],
    [px(0.5), py(sill + 0.03)],
  ];

  const inBody = polygon(outline);
  const archCut = axles.map((fx) => circle(px(fx), py(hub), wheelR * 1.16));
  canvas.fill((x, y) => inBody(x, y) && !archCut.some((cut) => cut(x, y)), body, 1, boundsOf(outline));

  // Greenhouse, inset from the pillars so the roofline stays as sheet metal.
  const windows = [
    [px(s.cowl - 0.005), py(s.belt + 0.028)],
    [px(s.cowl - 0.075), py(s.roof - 0.022)],
    [px(s.roofBack + 0.005), py(s.roof - 0.022)],
    [px(s.roofBack - 0.05), py(s.belt + 0.028)],
  ];
  canvas.fill(polygon(windows), glass, 1, boundsOf(windows));

  // The B-pillar, so the glass reads as two windows rather than one long pane.
  const pillarX = px((s.cowl + s.roofBack) / 2 - 0.02);
  const pillar = [
    [pillarX - unit * 0.007, py(s.roof - 0.022)],
    [pillarX + unit * 0.007, py(s.roof - 0.022)],
    [pillarX + unit * 0.011, py(s.belt + 0.028)],
    [pillarX - unit * 0.011, py(s.belt + 0.028)],
  ];
  canvas.fill(polygon(pillar), body, 0.95, boundsOf(pillar));

  // A single lit crease along the doors does most of the work of making a flat
  // shape read as a panel.
  const crease = [
    [px(0.42), py(s.belt - 0.045)],
    [px(-0.42), py(s.belt - 0.055)],
    [px(-0.42), py(s.belt - 0.072)],
    [px(0.42), py(s.belt - 0.062)],
  ];
  canvas.fill(polygon(crease), shoulder, 0.3, boundsOf(crease));

  // The shut lines. Two of them, and the car has doors.
  for (const fx of [s.cowl - 0.03, (s.cowl + s.roofBack) / 2 - 0.02]) {
    const x = px(fx);
    canvas.fill(
      polygon([
        [x - unit * 0.003, py(s.belt + 0.005)],
        [x + unit * 0.003, py(s.belt + 0.005)],
        [x + unit * 0.003, py(sill + 0.02)],
        [x - unit * 0.003, py(sill + 0.02)],
      ]),
      INK,
      0.35,
      { x0: x - unit * 0.02, x1: x + unit * 0.02, y0: py(s.belt + 0.02), y1: py(sill) },
    );
  }

  // Wheels, sitting on the ground inside their arches.
  for (const fx of axles) {
    const cx = px(fx);
    const cy = py(hub);
    const bounds = { x0: cx - wheelR * 1.25, x1: cx + wheelR * 1.25, y0: cy - wheelR * 1.25, y1: cy + wheelR * 1.25 };
    canvas.fill(circle(cx, cy, wheelR), mix(INK, [255, 255, 255], 0.05), 1, bounds);
    canvas.fill(circle(cx, cy, wheelR * 0.58), mix(INK, [255, 255, 255], 0.2), 1, bounds);
    canvas.fill(ring(cx, cy, wheelR * 0.56, wheelR * 0.46), mix(ACCENT, [255, 255, 255], 0.18), 0.85, bounds);
    canvas.fill(circle(cx, cy, wheelR * 0.14), mix(INK, [255, 255, 255], 0.32), 1, bounds);
  }

  // Head and tail lamps — small, but they tell you which way it is facing.
  const lamp = (fx, fy, color, w, h) => {
    const cx = px(fx);
    const cy = py(fy);
    canvas.fill(ellipse(cx, cy, unit * w, unit * h), color, 0.95, {
      x0: cx - unit * (w + 0.01), x1: cx + unit * (w + 0.01), y0: cy - unit * (h + 0.01), y1: cy + unit * (h + 0.01),
    });
  };
  lamp(0.455, s.belt - 0.035, mix([255, 245, 225], ACCENT, 0.3), 0.03, 0.013);
  lamp(-0.455, s.belt - 0.032, mix([215, 55, 40], INK, 0.1), 0.024, 0.012);
}

function carPlate({ width, height, type, slug, shot }) {
  const canvas = new Canvas(width, height);
  const rng = random(hash(slug));
  const tint = hsl(200 + rng() * 60, 0.4, 0.28);
  studio(canvas, tint);

  if (shot === "interior") {
    // A steering wheel and the top of a dash: the shot every rental listing
    // has, and the only one that is not a silhouette of the outside.
    const cx = width * 0.5;
    const cy = height * 0.62;
    const r = Math.min(width, height) * 0.34;
    const dash = roundRect(0, cy - r * 1.9, width, r * 1.5, r * 0.2);
    canvas.fill(dash, mix(INK, tint, 0.35), 1, { x0: 0, x1: width, y0: cy - r * 2, y1: cy - r * 0.3 });
    for (const fx of [-0.62, 0.62]) {
      const vx = cx + width * fx * 0.5;
      canvas.fill(ring(vx, cy - r * 1.15, r * 0.2, r * 0.11), mix(INK, [255, 255, 255], 0.18), 1, {
        x0: vx - r * 0.3, x1: vx + r * 0.3, y0: cy - r * 1.5, y1: cy - r * 0.8,
      });
    }
    canvas.fill(ring(cx, cy, r, r * 0.78), mix(INK, [255, 255, 255], 0.2), 1);
    canvas.fill(roundRect(cx - r * 0.82, cy - r * 0.09, r * 1.64, r * 0.18, r * 0.09), mix(INK, [255, 255, 255], 0.2), 1);
    canvas.fill(circle(cx, cy, r * 0.26), mix(ACCENT, INK, 0.35), 1);
    canvas.fill(roundRect(cx - r * 0.1, cy + r * 0.2, r * 0.2, r * 0.55, r * 0.08), mix(INK, [255, 255, 255], 0.2), 1);
  } else if (shot === "detail") {
    // A wheel, close. The shot a fleet photographer takes to show the alloys.
    const cx = width * 0.52;
    const cy = height * 0.56;
    const r = Math.min(width, height) * 0.42;
    canvas.fill(circle(cx, cy, r), mix(INK, [255, 255, 255], 0.07), 1);
    canvas.fill(ring(cx, cy, r * 0.72, r * 0.66), mix(ACCENT, [255, 255, 255], 0.3), 0.8);
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2 + 0.3;
      const spoke = [
        [cx + Math.cos(angle) * r * 0.2, cy + Math.sin(angle) * r * 0.2],
        [cx + Math.cos(angle + 0.16) * r * 0.66, cy + Math.sin(angle + 0.16) * r * 0.66],
        [cx + Math.cos(angle - 0.16) * r * 0.66, cy + Math.sin(angle - 0.16) * r * 0.66],
      ];
      canvas.fill(polygon(spoke), mix(INK, [255, 255, 255], 0.34), 1, boundsOf(spoke));
    }
    canvas.fill(circle(cx, cy, r * 0.2), mix(INK, [255, 255, 255], 0.42), 1);
    canvas.fill(circle(cx, cy, r * 0.07), mix(ACCENT, [255, 255, 255], 0.4), 1);
  } else {
    drawCar(canvas, {
      type,
      tint,
      zoom: shot === "rear" ? 1.55 : 1,
      offsetX: shot === "rear" ? 0.3 : 0,
      flip: shot === "rear",
    });
  }

  return canvas;
}

/** A skyline for a city page's hero band. */
function cityPlate({ width, height, slug }) {
  const canvas = new Canvas(width, height);
  const rng = random(hash(slug));
  const dusk = hsl(20 + rng() * 40, 0.55, 0.32);
  studio(canvas, dusk);

  // The sun sits off-centre so a headline in the left third never crosses it.
  const sunX = width * (0.62 + rng() * 0.2);
  const sunY = height * 0.42;
  const sunR = height * 0.16;
  canvas.shade((x, y) => {
    const d = Math.hypot(x - sunX, y - sunY) / (sunR * 3.4);
    return d < 1 ? { color: mix(ACCENT, [255, 240, 210], 0.35), alpha: (1 - d) ** 2 * 0.55 } : null;
  });
  canvas.fill(circle(sunX, sunY, sunR), mix(ACCENT, [255, 245, 220], 0.5), 0.9, {
    x0: sunX - sunR * 1.2, x1: sunX + sunR * 1.2, y0: sunY - sunR * 1.2, y1: sunY + sunR * 1.2,
  });

  // Two ranks of buildings — the back one hazier, which is the whole trick for
  // making a flat silhouette read as depth.
  for (const [rank, alpha, base] of [[0.62, 0.55, 0.74], [1, 1, 0.86]]) {
    let x = -width * 0.05;
    while (x < width * 1.05) {
      const w = width * (0.03 + rng() * 0.06);
      const h = height * (0.12 + rng() * 0.42) * rank;
      const top = height * base - h;
      canvas.fill(roundRect(x, top, w, h + height, w * 0.06), mix(INK, dusk, 0.18 * rank), alpha, {
        x0: x - 1, x1: x + w + 1, y0: top - 1, y1: height,
      });
      // A few lit windows, because an unlit block reads as a wall.
      const rows = Math.floor(h / (height * 0.09));
      for (let r = 0; r < rows; r += 1) {
        if (rng() > 0.45) continue;
        const wx = x + w * 0.28;
        const wy = top + height * 0.05 + r * height * 0.09;
        canvas.fill(roundRect(wx, wy, w * 0.44, height * 0.028, 1), mix(ACCENT, [255, 230, 190], 0.5), 0.5 * alpha, {
          x0: wx - 1, x1: wx + w, y0: wy - 1, y1: wy + height * 0.05,
        });
      }
      x += w * (1.12 + rng() * 0.5);
    }
  }

  // The road the cars are actually on.
  canvas.fill(roundRect(-10, height * 0.86, width + 20, height, 0), mix(INK, [0, 0, 0], 0.4), 1, {
    x0: 0, x1: width, y0: height * 0.84, y1: height,
  });
  for (let x = width * 0.04; x < width; x += width * 0.09) {
    canvas.fill(roundRect(x, height * 0.94, width * 0.045, height * 0.012, 2), [255, 255, 255], 0.22, {
      x0: x - 1, x1: x + width * 0.06, y0: height * 0.93, y1: height * 0.96,
    });
  }
  return canvas;
}

/** A motif for an occasion page's hero band. */
function occasionPlate({ width, height, slug }) {
  const canvas = new Canvas(width, height);
  const hue = { wedding: 330, celebrity: 275, tour: 150, casual: 30 }[slug] ?? 30;
  const tint = hsl(hue, 0.45, 0.32);
  studio(canvas, tint);

  const cx = width * 0.68;
  const cy = height * 0.5;
  const r = height * 0.26;
  const ink = mix(ACCENT, [255, 245, 230], 0.45);

  if (slug === "wedding") {
    canvas.fill(ring(cx - r * 0.4, cy, r, r * 0.86), ink, 0.85);
    canvas.fill(ring(cx + r * 0.4, cy + r * 0.12, r, r * 0.86), mix(ink, [255, 255, 255], 0.3), 0.85);
  } else if (slug === "celebrity") {
    for (const [scale, alpha] of [[1, 0.9], [0.55, 0.5]]) {
      const points = [];
      for (let i = 0; i < 10; i += 1) {
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const radius = r * scale * (i % 2 === 0 ? 1 : 0.42);
        points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
      }
      canvas.fill(polygon(points), ink, alpha, boundsOf(points));
    }
  } else if (slug === "tour") {
    for (const [dx, scale, alpha] of [[-0.55, 1.15, 0.7], [0.35, 0.9, 1]]) {
      const peak = [
        [cx + r * dx, cy - r * scale],
        [cx + r * dx + r * 1.5 * scale, cy + r * 0.9],
        [cx + r * dx - r * 1.5 * scale, cy + r * 0.9],
      ];
      canvas.fill(polygon(peak), mix(ink, INK, 0.35), alpha, boundsOf(peak));
    }
    const road = [
      [cx - r * 0.3, cy + r * 0.9],
      [cx + r * 0.3, cy + r * 0.9],
      [cx + r * 1.5, cy + r * 1.9],
      [cx - r * 1.5, cy + r * 1.9],
    ];
    canvas.fill(polygon(road), mix(INK, [255, 255, 255], 0.12), 1, boundsOf(road));
  } else {
    drawCar(canvas, { type: "sedan", tint, zoom: 0.62, offsetX: 0.16 });
  }

  return canvas;
}

/**
 * A gallery frame (§21).
 *
 * Eight categories, three frames each. They are stand-ins for photographs Xotic
 * will supply, so the job here is to hold the right shape and the right weight
 * on the page — a grid of grey boxes tells you nothing about whether the layout
 * survives a portrait frame next to a landscape one.
 */
function galleryPlate({ width, height, category, index }) {
  const canvas = new Canvas(width, height);
  const rng = random(hash(`${category}-${index}`));
  const hue = {
    weddings: 330,
    "bride-groom": 345,
    photoshoots: 275,
    corporate: 210,
    "vip-transfers": 260,
    "luxury-cars": 200,
    chauffeur: 30,
    tours: 150,
  }[category] ?? 30;

  // Lighter and closer than the fleet plates: a gallery frame is looked at on
  // its own, not read past, and at 0.72 zoom on a near-black body the car
  // disappeared into the backdrop.
  const tint = hsl(hue + rng() * 24 - 12, 0.34, 0.44);
  studio(canvas, tint);

  const bodies = [
    "luxury-sedan",
    "luxury-suv",
    "premium-van",
    "ultra-luxury",
    "convertible",
    "vintage",
    "limousine",
    "premium-muv",
    "sports",
  ];
  drawCar(canvas, {
    type: bodies[(Math.floor(rng() * bodies.length) + index) % bodies.length],
    tint,
    zoom: 1 + rng() * 0.22,
    offsetX: rng() * 0.14 - 0.07,
    flip: index === 3,
  });

  return canvas;
}

// ── writing them out ────────────────────────────────────────────────────────

function write(path, canvas) {
  const file = join(root, "public", "media", path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, canvas.toPng());
  return file;
}

const HERO = { width: 1280, height: 800 };
const THUMB = { width: 640, height: 480 };
const BAND = { width: 1600, height: 640 };

let count = 0;
let bytes = 0;

for (const car of seed.cars) {
  for (const shot of ["hero", "interior", "rear", "detail"]) {
    const size = shot === "hero" ? HERO : THUMB;
    const canvas = carPlate({ ...size, type: car.type, slug: `${car.slug}-${shot}`, shot });
    const file = write(`cars/${car.slug}-${shot}.png`, canvas);
    bytes += canvas.toPng().length;
    count += 1;
    process.stdout.write(`  ${file.replace(root, ".")}\n`);
  }
}

for (const city of seed.cities) {
  const canvas = cityPlate({ ...BAND, slug: city.slug });
  write(`cities/${city.slug}.png`, canvas);
  bytes += canvas.toPng().length;
  count += 1;
}

for (const occasion of seed.occasions) {
  const canvas = occasionPlate({ ...BAND, slug: occasion.slug });
  write(`occasions/${occasion.slug}.png`, canvas);
  bytes += canvas.toPng().length;
  count += 1;
}

const GALLERY = [
  "weddings",
  "bride-groom",
  "photoshoots",
  "corporate",
  "vip-transfers",
  "luxury-cars",
  "chauffeur",
  "tours",
];

for (const category of GALLERY) {
  for (let index = 1; index <= 3; index += 1) {
    // The middle frame of each category is portrait, so the grid is tested
    // against the mix it will actually be given.
    const size = index === 2 ? { width: 720, height: 900 } : { width: 960, height: 720 };
    const canvas = galleryPlate({ ...size, category, index });
    write(`gallery/${category}-${index}.png`, canvas);
    bytes += canvas.toPng().length;
    count += 1;
  }
}

console.log(`\n${count} plates, ${(bytes / 1024 / 1024).toFixed(1)} MB, in public/media.`);
