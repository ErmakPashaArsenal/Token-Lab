import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STEPS,
  contrast,
  contrastLevel,
  createNeutralScale,
  createScale,
  hexToOklch,
  normalizeHex,
  onAccent,
} from '../public/color.js';

const HEX = /^#[0-9a-f]{6}$/;
// Spec lightness targets for steps 50..950 (OKLCH L), used to find the nearest step.
const TARGET_L = STEPS.map((_, i) => 0.97 + ((0.24 - 0.97) * i) / (STEPS.length - 1));
// 8-bit rounding moves OKLCH lightness by up to ~0.003.
const L_TOLERANCE = 0.006;

const BRANDS = [
  '#3b5bfd', // blue
  '#e5484d', // red
  '#12a594', // teal
  '#ffd60a', // light yellow
  '#0a0a2a', // very dark
  '#f0f4ff', // very light
  // sRGB primaries: the scale around them must be gamut-mapped
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#00ffff',
];

const hueDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test('contrast: white on black is 21', () => {
  assert.equal(contrast('#ffffff', '#000000').toFixed(2), '21.00');
});

test('contrast: #767676 on white is 4.54', () => {
  assert.equal(contrast('#767676', '#ffffff').toFixed(2), '4.54');
});

test('contrast: order does not matter, same color is 1', () => {
  assert.equal(contrast('#000000', '#ffffff'), contrast('#ffffff', '#000000'));
  assert.equal(contrast('#3b5bfd', '#3b5bfd'), 1);
});

test('contrast level: AAA / AA / AA Large / Fail thresholds', () => {
  assert.equal(contrastLevel(21), 'AAA');
  assert.equal(contrastLevel(7), 'AAA');
  assert.equal(contrastLevel(6.99), 'AA');
  assert.equal(contrastLevel(4.5), 'AA');
  assert.equal(contrastLevel(contrast('#767676', '#ffffff')), 'AA');
  assert.equal(contrastLevel(4.49), 'AA Large');
  assert.equal(contrastLevel(3), 'AA Large');
  assert.equal(contrastLevel(2.99), 'Fail');
});

test('on-accent: white on #4F46E5, dark on yellow #FACC15', () => {
  assert.equal(onAccent('#4F46E5'), '#ffffff');
  assert.equal(onAccent('#FACC15'), '#000000');
  assert.equal(onAccent('#FACC15', '#1D1F25'), '#1d1f25');
});

test('hex input: short form, case and invalid values', () => {
  assert.equal(normalizeHex('#ABC'), '#aabbcc');
  assert.equal(normalizeHex('3B5BFD'), '#3b5bfd');
  assert.throws(() => createScale('#12345'), TypeError);
  assert.throws(() => contrast('red', '#ffffff'), TypeError);
});

for (const brand of BRANDS) {
  test(`scale ${brand}`, async (t) => {
    const scale = createScale(brand);
    const values = STEPS.map((s) => scale[s]);
    const lch = values.map(hexToOklch);
    const brandLch = hexToOklch(brand);

    await t.test('has steps 50..950, hex only', () => {
      assert.deepEqual(Object.keys(scale).map(Number), STEPS);
      for (const v of values) assert.match(v, HEX);
    });

    await t.test('brand hex is unchanged on the nearest step', () => {
      const distances = TARGET_L.map((L) => Math.abs(L - brandLch.L));
      const nearest = distances.indexOf(Math.min(...distances));
      assert.equal(values[nearest], brand);
      assert.equal(values.filter((v) => v === brand).length, 1);
    });

    await t.test('lightness goes from light to dark', () => {
      for (let i = 1; i < lch.length; i++) {
        assert.ok(lch[i].L < lch[i - 1].L, `step ${STEPS[i]} is not darker than ${STEPS[i - 1]}`);
      }
    });

    await t.test('neighbours of the brand step are evenly spaced', () => {
      const pivot = values.indexOf(brand);
      const sides = [lch.slice(0, pivot + 1), lch.slice(pivot)];
      for (const side of sides) {
        const gaps = side.slice(1).map((c, i) => side[i].L - c.L);
        for (const gap of gaps) {
          assert.ok(Math.abs(gap - gaps[0]) <= L_TOLERANCE, `uneven gaps: ${gaps.map((g) => g.toFixed(3))}`);
        }
      }
    });

    await t.test('stays in sRGB without hue shift (chroma-only gamut mapping)', () => {
      for (const [i, c] of lch.entries()) {
        if (c.C < 0.04) continue; // hue is unstable for near-grays after 8-bit rounding
        assert.ok(hueDiff(c.H, brandLch.H) <= 3, `step ${STEPS[i]} hue ${c.H.toFixed(1)} vs ${brandLch.H.toFixed(1)}`);
      }
    });
  });
}

test('neutral scale: lightly tinted with brand hue', () => {
  const brand = hexToOklch('#3b5bfd');
  const neutral = createNeutralScale('#3b5bfd');
  const lch = STEPS.map((s) => hexToOklch(neutral[s]));

  assert.deepEqual(Object.keys(neutral).map(Number), STEPS);
  for (const [i, c] of lch.entries()) {
    assert.match(neutral[STEPS[i]], HEX);
    assert.ok(Math.abs(c.L - TARGET_L[i]) <= L_TOLERANCE, `step ${STEPS[i]} L ${c.L.toFixed(3)}`);
    assert.ok(c.C > 0.004 && c.C < 0.02, `step ${STEPS[i]} chroma ${c.C.toFixed(4)}`);
  }
  // mid steps have enough chroma for a stable hue reading
  for (const c of lch.slice(3, 8)) assert.ok(hueDiff(c.H, brand.H) <= 15);
});

test('neutral scale from a gray brand is pure gray', () => {
  const neutral = createNeutralScale('#808080');
  for (const v of Object.values(neutral)) {
    assert.equal(v.slice(1, 3), v.slice(3, 5));
    assert.equal(v.slice(3, 5), v.slice(5, 7));
  }
});
