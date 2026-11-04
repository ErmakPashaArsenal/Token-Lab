// Semantic tokens for light and dark themes, plus CSS / Tailwind / JSON export.
// Every token points to a primitive (a scale step or white), never to a loose hex.

import { STEPS, contrast, createNeutralScale, createScale, normalizeHex, onAccent } from './color.js';

export const TOKENS = [
  'bg',
  'surface',
  'text',
  'text-muted',
  'border',
  'accent',
  'accent-hover',
  'on-accent',
  'danger',
  'success',
];

const WHITE = '#ffffff';
const DANGER_HEX = '#e5484d';
const SUCCESS_HEX = '#30a46c';
const UI_CONTRAST = 3; // WCAG 1.4.11: buttons and other UI parts against the background
const TEXT_CONTRAST = 4.5; // WCAG AA for normal text

const FIRST = STEPS[0];
const LAST = STEPS[STEPS.length - 1];
const DARKEST = `neutral-${LAST}`;
const LIGHTEST = `neutral-${FIRST}`;

export function buildTokens(hex) {
  const brandHex = normalizeHex(hex);
  const scales = {
    brand: createScale(brandHex),
    neutral: createNeutralScale(brandHex),
    danger: createScale(DANGER_HEX),
    success: createScale(SUCCESS_HEX),
  };
  const brandStep = STEPS.find((s) => scales.brand[s] === brandHex);

  const resolve = (ref) => {
    if (ref === 'white') return WHITE;
    const [scale, step] = ref.split('-');
    return scales[scale][step];
  };

  const onAccentRef = (accentRef) =>
    onAccent(resolve(accentRef), resolve(DARKEST)) === WHITE ? 'white' : DARKEST;

  // Light theme keeps the brand color as is. Dark theme moves the accent lighter
  // until the button stands out from the dark background and its label passes AA.
  // If no step manages both, the first one that stands out wins.
  const darkBg = DARKEST;
  const standsOut = (step) => contrast(scales.brand[step], resolve(darkBg)) >= UI_CONTRAST;
  const labelPasses = (step) => {
    const accent = `brand-${step}`;
    return contrast(resolve(onAccentRef(accent)), resolve(accent)) >= TEXT_CONTRAST;
  };
  const lighterSteps = STEPS.filter((s) => s <= brandStep).reverse();
  const darkStep =
    lighterSteps.find((s) => standsOut(s) && labelPasses(s)) ??
    lighterSteps.find(standsOut) ??
    FIRST;

  const lightAccent = `brand-${brandStep}`;
  const darkAccent = `brand-${darkStep}`;

  // Hover moves one step away from the label color, so the label only gains contrast.
  // At the end of the scale it has nowhere to go, so it moves the other way.
  const hoverRef = (step) => {
    const i = STEPS.indexOf(step);
    const shift = onAccentRef(`brand-${step}`) === 'white' ? 1 : -1;
    const next = STEPS[i + shift] ?? STEPS[i - shift];
    return `brand-${next}`;
  };

  const refs = {
    light: {
      bg: 'white',
      surface: LIGHTEST,
      text: DARKEST,
      'text-muted': 'neutral-700',
      border: 'neutral-100',
      accent: lightAccent,
      'accent-hover': hoverRef(brandStep),
      'on-accent': onAccentRef(lightAccent),
      danger: 'danger-700',
      success: 'success-700',
    },
    dark: {
      bg: darkBg,
      surface: 'neutral-900',
      text: LIGHTEST,
      'text-muted': 'neutral-300',
      border: 'neutral-800',
      accent: darkAccent,
      'accent-hover': hoverRef(darkStep),
      'on-accent': onAccentRef(darkAccent),
      danger: 'danger-300',
      success: 'success-300',
    },
  };

  const themes = {};
  for (const [theme, map] of Object.entries(refs)) {
    themes[theme] = Object.fromEntries(
      TOKENS.map((name) => [name, { ref: map[name], hex: resolve(map[name]) }]),
    );
  }

  // Full brand and neutral scales; for danger and success only the steps in use.
  const used = new Set(Object.values(refs).flatMap((map) => Object.values(map)));
  const primitives = [['white', WHITE]];
  for (const scale of ['brand', 'neutral', 'danger', 'success']) {
    for (const step of STEPS) {
      const ref = `${scale}-${step}`;
      if (scale === 'brand' || scale === 'neutral' || used.has(ref)) primitives.push([ref, resolve(ref)]);
    }
  }

  return { brandHex, brandStep, scales, primitives, themes };
}

// ---------- export ----------

function cssBlock(selector, lines) {
  return `${selector} {\n${lines.map((l) => (l ? `  ${l}` : '')).join('\n')}\n}`;
}

export function toCSS(t) {
  const primitives = t.primitives.map(([ref, hex]) => `--${ref}: ${hex};`);
  const semantic = (theme) => TOKENS.map((name) => `--${name}: var(--${t.themes[theme][name].ref});`);
  return [
    cssBlock(':root', ['/* Primitives */', ...primitives, '', '/* Light */', ...semantic('light')]),
    cssBlock('[data-theme="dark"]', semantic('dark')),
  ].join('\n\n') + '\n';
}

export function toTailwind(t) {
  const primitives = t.primitives.map(([ref, hex]) => `--color-${ref}: ${hex};`);
  const semantic = (theme) =>
    TOKENS.map((name) => `--color-${name}: var(--color-${t.themes[theme][name].ref});`);
  return [
    '@import "tailwindcss";',
    cssBlock('@theme', ['/* Primitives */', ...primitives, '', '/* Light */', ...semantic('light')]),
    cssBlock('@layer base', [
      '.dark,',
      '[data-theme="dark"] {',
      ...semantic('dark').map((l) => `  ${l}`),
      '}',
    ]),
  ].join('\n\n') + '\n';
}

// Design tokens (DTCG): primitives -> light / dark, semantic tokens are aliases.
export function toJSON(t) {
  const color = (value) => ({ $type: 'color', $value: value });
  const primitives = {};
  for (const [ref, hex] of t.primitives) {
    if (ref === 'white') {
      primitives.white = color(hex);
    } else {
      const [scale, step] = ref.split('-');
      (primitives[scale] ??= {})[step] = color(hex);
    }
  }
  const alias = (ref) => `{primitives.${ref.replace('-', '.')}}`;
  const theme = (name) =>
    Object.fromEntries(TOKENS.map((token) => [token, color(alias(t.themes[name][token].ref))]));
  return `${JSON.stringify({ primitives, light: theme('light'), dark: theme('dark') }, null, 2)}\n`;
}
