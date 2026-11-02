// Color scales and WCAG contrast. Every public function takes and returns hex.
// Internally colors are built in OKLCH (perceptual lightness), then mapped
// into sRGB by lowering chroma only, so lightness and hue stay intact.

export const STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

const L_LIGHTEST = 0.97; // step 100
const L_DARKEST = 0.24; // step 1000
const CHROMA_FALLOFF = 0.5; // share of brand chroma lost by the scale ends
const NEUTRAL_CHROMA = 0.012; // brand tint in the neutral scale

const DEFAULT_L = STEPS.map(
  (_, i) => L_LIGHTEST + ((L_DARKEST - L_LIGHTEST) * i) / (STEPS.length - 1),
);

// ---------- hex <-> sRGB ----------

export function normalizeHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) throw new TypeError(`Invalid hex color: ${hex}`);
  let h = m[1].toLowerCase();
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return `#${h}`;
}

function hexToRgb(hex) {
  const h = normalizeHex(hex);
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function rgbToHex(rgb) {
  return (
    '#' +
    rgb
      .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

// ---------- linear sRGB <-> OKLab (Björn Ottosson) ----------

function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function hexToOklch(hex) {
  const [L, a, b] = linearToOklab(hexToRgb(hex).map(toLinear));
  const C = Math.hypot(a, b);
  const H = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { L, C, H };
}

function oklchToLinear({ L, C, H }) {
  const rad = (H * Math.PI) / 180;
  return oklabToLinear([L, C * Math.cos(rad), C * Math.sin(rad)]);
}

const EPS = 1e-6;
const inGamut = (rgb) => rgb.every((v) => v >= -EPS && v <= 1 + EPS);

// Keeps L and H, lowers C (binary search) until the color fits in sRGB.
function oklchToHex(lch) {
  const L = Math.min(1, Math.max(0, lch.L));
  let lo = 0;
  let hi = Math.max(0, lch.C);
  if (!inGamut(oklchToLinear({ L, C: hi, H: lch.H }))) {
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ L, C: mid, H: lch.H }))) lo = mid;
      else hi = mid;
    }
    hi = lo;
  }
  return rgbToHex(oklchToLinear({ L, C: hi, H: lch.H }).map(fromLinear));
}

// ---------- scales ----------

function nearestStepIndex(L) {
  let best = 0;
  DEFAULT_L.forEach((target, i) => {
    if (Math.abs(target - L) < Math.abs(DEFAULT_L[best] - L)) best = i;
  });
  return best;
}

const toScale = (values) => Object.fromEntries(STEPS.map((step, i) => [step, values[i]]));

// Brand scale 100-1000. The brand hex sits unchanged on the step closest to its
// lightness; steps on each side are evenly spaced in lightness toward the ends.
export function createScale(hex) {
  const brandHex = normalizeHex(hex);
  const brand = hexToOklch(brandHex);
  const pivot = nearestStepIndex(brand.L);
  const last = STEPS.length - 1;

  return toScale(
    STEPS.map((_, i) => {
      if (i === pivot) return brandHex;
      // t: 0 at the brand step, 1 at the scale end on that side
      const t = i < pivot ? (pivot - i) / pivot : (i - pivot) / (last - pivot);
      const end = i < pivot ? L_LIGHTEST : L_DARKEST;
      return oklchToHex({
        L: brand.L + (end - brand.L) * t,
        C: brand.C * (1 - CHROMA_FALLOFF * t),
        H: brand.H,
      });
    }),
  );
}

// Neutral scale 100-1000 with a light tint of the brand hue.
export function createNeutralScale(hex) {
  const brand = hexToOklch(hex);
  const C = Math.min(brand.C, NEUTRAL_CHROMA);
  return toScale(DEFAULT_L.map((L) => oklchToHex({ L, C, H: brand.H })));
}

// ---------- WCAG 2.x contrast ----------

export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Contrast ratio from 1 to 21. Argument order does not matter.
export function contrast(hexA, hexB) {
  const [hi, lo] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

// WCAG level for normal text, with AA Large (3:1) for large text and UI parts.
export function contrastLevel(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

// Text color on top of an accent: white or dark, whichever contrasts more.
export function onAccent(accentHex, darkHex = '#000000') {
  const white = '#ffffff';
  const dark = normalizeHex(darkHex);
  return contrast(white, accentHex) >= contrast(dark, accentHex) ? white : dark;
}
