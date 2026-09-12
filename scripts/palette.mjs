// scripts/palette.mjs
//
// Generates the Xotic token ramps from the brand colours.
//
//   node scripts/palette.mjs          print the token blocks as CSS
//   node scripts/palette.mjs --report print the working (OKLCH values, contrast)
//
// ── why this exists ─────────────────────────────────────────────────────────
//
// The design system this site was built from guarantees that "the same step of
// any ramp has the same visual weight" — every ramp sits on one shared
// perceptual lightness scale. Rebranding changes hue and chroma, not that
// contract. So the ramps are regenerated at the ORIGINAL per-step OKLCH
// lightnesses in the brand hue, scaling chroma by how much more saturated the
// brand orange is than the accent it replaces. Every spacing, elevation and
// contrast relationship the layouts were verified against therefore survives.
//
// ── the two zones ───────────────────────────────────────────────────────────
//
// The site is light: a white page with an orange accent. But the logo is white
// and orange on black, and the brand's own reference mockup keeps a black nav
// and a black hero above white content. So the theme has two zones:
//
//   :root      the light page — white ground, near-black ink
//   .on-dark   a black band — the header, the heroes, the footer, the feature
//              bands, and the photo tiles whose captions sit on the image
//
// `.on-dark` re-declares the same token names, so every component inside one
// works unchanged: CSS custom properties inherit, and a card that reads
// var(--color-surface) simply resolves to the dark surface in that subtree.
//
// The ramps are REVERSED between the zones. On a dark ground a low step number
// means "lighter, more prominent"; on a light ground it has to mean "darker,
// more prominent" for the same rule to keep its meaning. Reversing preserves
// every semantic: neutral-300 is secondary text in both zones, neutral-800 is a
// subtle fill in both, accent-800 is a tint and accent-300 is emphasis in both.
//
// Re-run after retuning BRAND_ORANGE and paste the output into app/globals.css.

// ── the brand ───────────────────────────────────────────────────────────────
// Sampled from the logo: the flat fill of the mark is #d17200. That is the ink
// the logo was printed in, and on screen it read as brown — a page of it felt
// dull rather than premium. The hue is kept and the colour is taken to the top
// of its chroma: same orange, lit.
const BRAND_ORANGE = '#ff7a00';

/** Ink that sits ON a solid orange fill. White on the orange is only 2.6:1. */
const ACCENT_INK = '#0a0a0a';

// The palette this replaces, kept as the source of the ramp lightness scale.
const OLD_ACCENT = '#9184d9';
const OLD_ACCENT_RAMP = [
  '#f5f4ff', '#e7e5fe', '#d2cefd', '#b5abfc', '#968ae0',
  '#796cbf', '#5d5294', '#423a6a', '#2b2741',
];
const OLD_NEUTRAL_RAMP = [
  '#f3f5fe', '#e4e7f5', '#cfd3e5', '#b2b6ca', '#9397ab',
  '#75798c', '#595d6c', '#3f424d', '#292b31',
];
// Read at runtime for their CHROMA, which the saturated band inherits.
const OLD_SECTION = { base: '#262a60', glow: '#353b80', ghost: '#4c5397' };

const STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/**
 * Ground lightnesses (OKLCH L).
 *
 * Light: the page is white. Properly white — the same white as the cards on it.
 *
 * It used to be a hair off, so that a true-white card would read as raised
 * without a heavy shadow. That is a real technique and it cost the site its
 * brightness: every "white" on screen was a light grey, and the page read as
 * dull no matter how bright the accent got. Cards separate on their shadow and
 * hairline now, which is what those are for, and the figure/ground pairs that
 * genuinely need a second value use `well` — a recessed fill is a different
 * thing from the page it sits on, and now it says so.
 *
 * Dark: re-anchored to the logo's own near-black plate rather than the blue-grey
 * this replaced, with a slightly wider bg→surface gap, because a card needs more
 * separation to read as raised when the page behind it is that dark.
 */
const LIGHT_L = {
  surface: 1.0,     // cards — true white
  bg: 1.0,          // the page
  slot: 0.93,       // an empty image well
  well: 0.955,      // a recessed panel
  bandFrom: 0.972,
  bandTo: 0.995,
  mapGrid: 0.94,
  mapRoad: 0.895,
};

const DARK_L = {
  surface: 0.2,
  bg: 0.06,         // the plate: black, not charcoal
  slot: 0.14,
  well: 0.02,
  bandFrom: 0.08,
  bandTo: 0.17,
  mapGrid: 0.2,
  mapRoad: 0.25,
};

const SECTION_L = { base: 0.314, glow: 0.386, ghost: 0.471 };

/**
 * The light zone's ramp lightnesses.
 *
 * NOT a mirror of the dark scale. Reversing preserves the semantics of each
 * step, but not its legibility: the shared scale is not centred, so a black
 * ground tolerates far more of it as text than a white ground does. Mirrored,
 * steps 500 and 600 landed at L .68 and .78 — 2.7:1 and 1.9:1 on white, i.e.
 * every "muted" label on the site unreadable.
 *
 * So the light zone gets its own scale, split at the role boundary:
 *   100-600  TEXT   — every step clears 4.5:1 on white
 *   700-900  FILLS  — borders, chips, tag grounds, status pills
 * Steps keep their meaning (300 is secondary text in both zones, 800 is a
 * subtle fill in both); only the numbers behind them differ.
 */
const LIGHT_RAMP_L = [0.17, 0.26, 0.35, 0.44, 0.5, 0.55, 0.8, 0.9, 0.965];

/**
 * How warm the greys are: not at all.
 *
 * They used to carry a whisper of the accent's hue, which sounds tasteful and
 * in practice put a beige cast over every white on the site — the thing that
 * made a bright layout feel dull. The logo is perfectly neutral where it is not
 * orange (plate #090909, wordmark #ffffff), so the greys are neutral too and
 * the orange does every bit of the warming, on purpose, where it is used.
 */
const NEUTRAL_CHROMA = 0;
const GROUND_CHROMA = 0;

/** Minimum contrast an accent used as TEXT must reach against its ground. */
const TEXT_CONTRAST_TARGET = 4.5;

/**
 * Minimum contrast for the accent used as a NON-TEXT mark — an icon, a border,
 * a focus ring. WCAG 1.4.11 asks 3:1, and a bright orange on white cannot get
 * there: #ff7a00 on the page is 2.5:1.
 *
 * So the brand orange runs at full brightness where it is brilliant — on the
 * black bands, and under dark ink on a solid fill (7.6:1) — and the LIGHT
 * zone's `--color-accent` is that same hue taken down only as far as 3:1. The
 * two zones already declare their own tokens; this is one more thing the light
 * zone is allowed to be slightly different about.
 */
const MARK_CONTRAST_TARGET = 3;

// ── colour maths (sRGB ↔ OKLab ↔ OKLCH) ─────────────────────────────────────

const clamp01 = (v) => Math.min(1, Math.max(0, v));

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

function rgbToHex([r, g, b]) {
  const to = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToOklab([r, g, b]) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function rgbToOklch(rgb) {
  const [L, a, b] = rgbToOklab(rgb);
  return [L, Math.hypot(a, b), (Math.atan2(b, a) * 180) / Math.PI];
}

function oklchToRgb([L, C, h]) {
  const rad = (h * Math.PI) / 180;
  return oklabToRgb([L, C * Math.cos(rad), C * Math.sin(rad)]);
}

const inGamut = (rgb) => rgb.every((v) => v >= -0.0001 && v <= 1.0001);

/** Clamp chroma into gamut so a step never silently clips to a different hue. */
function oklchToHex([L, C, h]) {
  if (inGamut(oklchToRgb([L, C, h]))) return rgbToHex(oklchToRgb([L, C, h]));
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgb([L, mid, h]))) lo = mid;
    else hi = mid;
  }
  return rgbToHex(oklchToRgb([L, lo, h]));
}

const hexToOklch = (hex) => rgbToOklch(hexToRgb(hex));

// ── WCAG ────────────────────────────────────────────────────────────────────

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ── generate ────────────────────────────────────────────────────────────────

const [, brandChroma, brandHue] = hexToOklch(BRAND_ORANGE);
const [, oldAccentChroma] = hexToOklch(OLD_ACCENT);
const chromaScale = brandChroma / oldAccentChroma;

function rampFrom(sourceRamp, flatChroma = null) {
  return sourceRamp.map((hex) => {
    const [L, C] = hexToOklch(hex);
    return oklchToHex([L, flatChroma ?? C * chromaScale, brandHue]);
  });
}

/** Light → dark, on the inherited scale. Used as-is inside .on-dark. */
const accentForward = rampFrom(OLD_ACCENT_RAMP);
const neutralForward = rampFrom(OLD_NEUTRAL_RAMP, NEUTRAL_CHROMA);

/** Dark → light, on the light zone's own scale. Used in :root. */
function lightRamp(sourceRamp, flatChroma = null) {
  return LIGHT_RAMP_L.map((L, i) => {
    // Chroma follows the source ramp's curve, read from the step of equivalent
    // role (the source runs the other way), so the light ramp is saturated in
    // the middle and calm at both ends exactly as the dark one is.
    const [, C] = hexToOklch(sourceRamp[sourceRamp.length - 1 - i]);
    return oklchToHex([L, flatChroma ?? C * chromaScale, brandHue]);
  });
}

const accentReversed = lightRamp(OLD_ACCENT_RAMP);
const neutralReversed = lightRamp(OLD_NEUTRAL_RAMP, NEUTRAL_CHROMA);

const ground = (L, chroma) => oklchToHex([L, chroma, brandHue]);

function groundsFor(scale) {
  return {
    bg: ground(scale.bg, GROUND_CHROMA),
    surface: ground(scale.surface, GROUND_CHROMA),
    slot: ground(scale.slot, GROUND_CHROMA),
    well: ground(scale.well, GROUND_CHROMA),
    bandFrom: ground(scale.bandFrom, GROUND_CHROMA),
    bandTo: ground(scale.bandTo, GROUND_CHROMA * 1.6),
    mapGrid: ground(scale.mapGrid, GROUND_CHROMA),
    mapRoad: ground(scale.mapRoad, GROUND_CHROMA * 2),
  };
}

const light = groundsFor(LIGHT_L);
const dark = groundsFor(DARK_L);

const section = {
  base: ground(SECTION_L.base, hexToOklch(OLD_SECTION.base)[1] * chromaScale),
  glow: ground(SECTION_L.glow, hexToOklch(OLD_SECTION.glow)[1] * chromaScale),
  ghost: ground(SECTION_L.ghost, hexToOklch(OLD_SECTION.ghost)[1] * chromaScale),
};

// Ink. The light zone's text is the darkest neutral step; the dark zone's is the
// lightest. Both come off the ramp rather than being pure black or pure white.
const lightText = neutralReversed[0];
const darkText = neutralForward[0];

/**
 * The accent as TEXT.
 *
 * The brand orange is a mark, not a typeface: at 2.5:1 on white it cannot carry
 * a 14px button label whatever the zone does with it. This walks the ramp to
 * the last step that still clears 4.5:1 against the zone's page ground, so
 * links, prices and button labels stay legible without the colour drifting to
 * something nobody would call orange.
 */
function accentText(ramp, bg) {
  // Walk from the end nearest the ground and take the LAST step that still
  // clears the target — the most saturated orange that is still legible. Taking
  // the first passing step instead returns the darkest brown on the ramp, which
  // passes easily and looks nothing like the brand.
  const passing = ramp.filter((step) => contrast(step, bg) >= TEXT_CONTRAST_TARGET);
  return passing.length ? passing[passing.length - 1] : ramp[0];
}

const lightAccentText = accentText(accentReversed, light.bg);
const darkAccentText = accentText(accentForward, dark.bg);

/**
 * The brand orange, darkened in place until it clears `MARK_CONTRAST_TARGET`
 * against the light page — hue and chroma held, lightness walked down in
 * hundredths, which is the smallest change that buys the legibility.
 */
function markAccent(hex, bg) {
  const [L, C, h] = rgbToOklch(hexToRgb(hex));
  for (let step = 0; step <= 40; step += 1) {
    // oklchToHex clamps chroma into gamut, so the hue never slips as it darkens.
    const candidate = oklchToHex([L - step * 0.01, C, h]);
    if (contrast(candidate, bg) >= MARK_CONTRAST_TARGET) return candidate;
  }
  return hex;
}

const lightAccent = markAccent(BRAND_ORANGE, light.bg);

// ── output ──────────────────────────────────────────────────────────────────

const pad = (s, n) => String(s).padEnd(n);
const channels = (hex) => hexToRgb(hex).map((v) => Math.round(v * 255)).join(' ');

function verdict(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'FAIL';
}

if (process.argv.includes('--report')) {
  console.log('BRAND');
  console.log(
    `  orange ${BRAND_ORANGE}  OKLCH L=${hexToOklch(BRAND_ORANGE)[0].toFixed(3)} C=${brandChroma.toFixed(4)} h=${brandHue.toFixed(1)}  chroma ×${chromaScale.toFixed(2)} vs old accent`,
  );
  console.log('');
  console.log('RAMPS            :root (light, reversed)      .on-dark (forward)');
  STEPS.forEach((step, i) => {
    console.log(
      `  ${pad(step, 5)} accent ${accentReversed[i]}  neutral ${neutralReversed[i]}    accent ${accentForward[i]}  neutral ${neutralForward[i]}`,
    );
  });
  console.log('');
  console.log('GROUNDS          light      dark');
  for (const key of Object.keys(light)) {
    console.log(`  ${pad(key, 14)} ${light[key]}    ${dark[key]}`);
  }
  console.log(`  ${pad('text', 14)} ${lightText}    ${darkText}`);
  console.log(`  ${pad('accent-text', 14)} ${lightAccentText}    ${darkAccentText}`);
  console.log('');

  const checks = [
    ['LIGHT ZONE', null, null],
    ['body text on page', lightText, light.bg],
    ['body text on card', lightText, light.surface],
    ['accent-text on page', lightAccentText, light.bg],
    ['accent-text on card', lightAccentText, light.surface],
    ['brand accent on page (icons, borders)', lightAccent, light.bg],
    ['brand orange at full, on a solid fill', ACCENT_INK, BRAND_ORANGE],
    ['accent-300 (emphasis) on card', accentReversed[2], light.surface],
    ['neutral-300 (secondary) on page', neutralReversed[2], light.bg],
    ['neutral-400 (tertiary) on card', neutralReversed[3], light.surface],
    ['neutral-500 (muted) on page', neutralReversed[4], light.bg],
    ['neutral-600 (faintest) on page', neutralReversed[5], light.bg],
    ['accent-100 on accent-800 (tag)', accentReversed[0], accentReversed[7]],
    ['neutral-100 on neutral-800 (chip)', neutralReversed[0], neutralReversed[7]],
    ['ink on solid orange button', ACCENT_INK, BRAND_ORANGE],
    ['hairline neutral-800 on page', neutralReversed[7], light.bg],
    ['DARK ZONE', null, null],
    ['body text on band', darkText, dark.bg],
    ['body text on dark card', darkText, dark.surface],
    ['accent-text on band', darkAccentText, dark.bg],
    ['brand accent on band', BRAND_ORANGE, dark.bg],
    ['accent-300 (emphasis) on band', accentForward[2], dark.bg],
    ['neutral-300 (secondary) on band', neutralForward[2], dark.bg],
    ['neutral-500 (muted) on band', neutralForward[4], dark.bg],
    ['neutral-600 (faintest) on band', neutralForward[5], dark.bg],
    ['text on saturated section band', darkText, section.base],
  ];

  console.log('CONTRAST');
  for (const [label, fg, bg] of checks) {
    if (!fg) {
      console.log(`  ── ${label} ──`);
      continue;
    }
    const ratio = contrast(fg, bg);
    console.log(`  ${pad(label, 42)} ${fg} on ${bg}  ${pad(ratio.toFixed(2) + ':1', 8)} ${verdict(ratio)}`);
  }
} else {
  const emit = (name, value) => console.log(`  --color-${name}: ${value};`);

  console.log('/* ── :root — the light page ─────────────────────────────── */');
  emit('bg', light.bg);
  emit('bg-rgb', channels(light.bg));
  emit('surface', light.surface);
  emit('text', lightText);
  emit('accent', lightAccent);
  emit('accent-solid', BRAND_ORANGE);
  emit('accent-text', lightAccentText);
  emit('accent-ink', ACCENT_INK);
  console.log('');
  STEPS.forEach((s, i) => emit(`accent-${s}`, accentReversed[i]));
  console.log('');
  STEPS.forEach((s, i) => emit(`neutral-${s}`, neutralReversed[i]));
  console.log('');
  emit('slot', light.slot);
  emit('well', light.well);
  emit('band-from', light.bandFrom);
  emit('band-to', light.bandTo);
  emit('map-grid', light.mapGrid);
  emit('map-road', light.mapRoad);

  console.log('');
  console.log('/* ── .on-dark — the black bands ─────────────────────────── */');
  emit('bg', dark.bg);
  emit('bg-rgb', channels(dark.bg));
  emit('surface', dark.surface);
  emit('text', darkText);
  // The dark zone used to inherit the light zone's accent, which is the brand
  // orange held back for legibility on white. On black it has nothing to be
  // held back from: 8:1, and it is the colour the logo is actually printed in.
  emit('accent', BRAND_ORANGE);
  emit('accent-solid', BRAND_ORANGE);
  emit('accent-text', darkAccentText);
  console.log('');
  STEPS.forEach((s, i) => emit(`accent-${s}`, accentForward[i]));
  console.log('');
  STEPS.forEach((s, i) => emit(`neutral-${s}`, neutralForward[i]));
  console.log('');
  emit('slot', dark.slot);
  emit('well', dark.well);
  emit('band-from', dark.bandFrom);
  emit('band-to', dark.bandTo);
  emit('map-grid', dark.mapGrid);
  emit('map-road', dark.mapRoad);
  emit('section', section.base);
  emit('section-glow', section.glow);
  emit('section-ghost', section.ghost);
}
