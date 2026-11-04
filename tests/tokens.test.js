import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, contrast } from '../public/color.js';
import { TOKENS, buildTokens, toCSS, toJSON, toTailwind } from '../public/tokens.js';

const HEX = /^#[0-9a-f]{6}$/;
const BRANDS = ['#4F46E5', '#FACC15', '#e5484d', '#12a594', '#0a0a2a', '#f0f4ff', '#808080'];

test('every token exists in both themes and points to a primitive', () => {
  for (const brand of BRANDS) {
    const t = buildTokens(brand);
    const primitives = new Map(t.primitives);
    for (const theme of ['light', 'dark']) {
      assert.deepEqual(Object.keys(t.themes[theme]), TOKENS);
      for (const name of TOKENS) {
        const { ref, hex } = t.themes[theme][name];
        assert.match(hex, HEX);
        assert.equal(primitives.get(ref), hex, `${brand} ${theme} ${name} -> ${ref}`);
      }
    }
  }
});

test('light accent is the brand color itself', () => {
  for (const brand of BRANDS) {
    assert.equal(buildTokens(brand).themes.light.accent.hex, brand.toLowerCase());
  }
});

test('on-accent: white on #4F46E5, dark on yellow #FACC15', () => {
  assert.equal(buildTokens('#4F46E5').themes.light['on-accent'].ref, 'white');
  const yellow = buildTokens('#FACC15');
  assert.equal(yellow.themes.light['on-accent'].ref, 'neutral-950');
  assert.notEqual(yellow.themes.light['on-accent'].hex, '#ffffff');
});

test('on-accent is the higher-contrast option', () => {
  for (const brand of BRANDS) {
    const t = buildTokens(brand);
    for (const theme of ['light', 'dark']) {
      const { accent, 'on-accent': on } = t.themes[theme];
      const other = on.ref === 'white' ? t.scales.neutral[950] : '#ffffff';
      assert.ok(contrast(on.hex, accent.hex) >= contrast(other, accent.hex));
    }
  }
});

test('readable text in both themes', () => {
  for (const brand of BRANDS) {
    const t = buildTokens(brand);
    for (const theme of ['light', 'dark']) {
      const T = t.themes[theme];
      assert.ok(contrast(T.text.hex, T.bg.hex) >= 7, `${brand} ${theme} text`);
      assert.ok(contrast(T.text.hex, T.surface.hex) >= 7, `${brand} ${theme} text on surface`);
      assert.ok(contrast(T['text-muted'].hex, T.surface.hex) >= 4.5, `${brand} ${theme} muted`);
      assert.ok(contrast(T.danger.hex, T.bg.hex) >= 4.5, `${brand} ${theme} danger`);
      assert.ok(contrast(T.success.hex, T.bg.hex) >= 4.5, `${brand} ${theme} success`);
    }
  }
});

test('dark accent stands out from the dark background, even for a very dark brand', () => {
  for (const brand of BRANDS) {
    const { accent, bg } = buildTokens(brand).themes.dark;
    assert.ok(contrast(accent.hex, bg.hex) >= 3, `${brand}: ${accent.ref}`);
  }
});

test('dark theme button label passes AA, on hover too, #4F46E5 included', () => {
  for (const brand of BRANDS) {
    const { accent, 'accent-hover': hover, 'on-accent': on } = buildTokens(brand).themes.dark;
    assert.ok(contrast(on.hex, accent.hex) >= 4.5, `${brand}: ${on.ref} on ${accent.ref}`);
    assert.ok(contrast(on.hex, hover.hex) >= 4.5, `${brand}: ${on.ref} on hover ${hover.ref}`);
  }
});

test('hover never lowers label contrast, except at the end of the scale', () => {
  for (const brand of BRANDS) {
    const t = buildTokens(brand);
    for (const theme of ['light', 'dark']) {
      const { accent, 'accent-hover': hover, 'on-accent': on } = t.themes[theme];
      const atEdge = ['brand-50', 'brand-950'].includes(accent.ref);
      if (!atEdge) assert.ok(contrast(on.hex, hover.hex) >= contrast(on.hex, accent.hex), `${brand} ${theme}`);
    }
  }
});

test('accent-hover is a neighbour step of accent', () => {
  for (const brand of BRANDS) {
    const t = buildTokens(brand);
    for (const theme of ['light', 'dark']) {
      const index = (ref) => STEPS.indexOf(Number(ref.split('-')[1]));
      const { accent, 'accent-hover': hover } = t.themes[theme];
      assert.equal(Math.abs(index(accent.ref) - index(hover.ref)), 1);
    }
  }
});

test('CSS export: defines every variable it uses', () => {
  const t = buildTokens('#4F46E5');
  const css = toCSS(t);
  const defined = new Set([...css.matchAll(/--([\w-]+):/g)].map((m) => m[1]));
  const used = [...css.matchAll(/var\(--([\w-]+)\)/g)].map((m) => m[1]);
  for (const name of used) assert.ok(defined.has(name), `--${name} is not defined`);
  for (const name of TOKENS) assert.match(css, new RegExp(`--${name}: var`));
  assert.match(css, /\[data-theme="dark"\] \{/);
  assert.match(css, new RegExp(`--brand-${t.brandStep}: #4f46e5;`));
});

test('Tailwind export: v4 @theme with color namespace', () => {
  const t = buildTokens('#FACC15');
  const tw = toTailwind(t);
  assert.match(tw, /^@import "tailwindcss";/);
  assert.match(tw, /@theme \{/);
  assert.match(tw, new RegExp(`--color-brand-${t.brandStep}: #facc15;`));
  assert.match(tw, /--color-on-accent: var\(--color-neutral-950\);/);
});

test('JSON export: primitives -> light / dark aliases that resolve', () => {
  const t = buildTokens('#4F46E5');
  const json = JSON.parse(toJSON(t));
  assert.deepEqual(Object.keys(json), ['primitives', 'light', 'dark']);
  for (const theme of ['light', 'dark']) {
    for (const name of TOKENS) {
      const alias = json[theme][name].$value;
      const path = alias.slice(1, -1).split('.').slice(1);
      const target = path.reduce((node, key) => node[key], json.primitives);
      assert.equal(target.$value, t.themes[theme][name].hex);
    }
  }
});
