// UI: state, render, events. Color math lives in color.js, tokens in tokens.js.

import { STEPS, contrast, contrastLevel, hexToOklch, normalizeHex } from './color.js';
import { TOKENS, buildTokens, toCSS, toJSON, toTailwind } from './tokens.js';

const DEFAULT_HEX = '#4f46e5';

const PRESETS = [
  ['Індиго', '#4F46E5'],
  ['Жовтий', '#FACC15'],
  ['Бірюза', '#0F766E'],
  ['Теракота', '#E4572E'],
];

const EXPORTS = {
  css: { label: 'CSS', build: toCSS },
  tailwind: { label: 'Tailwind', build: toTailwind },
  json: { label: 'Figma JSON', build: toJSON },
};

// Pairs checked on the live UI: [label, foreground, background, kind].
// Text needs 4.5:1, a UI part (button against the page) needs 3:1.
const PAIRS = [
  ['Текст на фоні', 'text', 'bg', 'text'],
  ['Другорядний текст', 'text-muted', 'bg', 'text'],
  ['Текст у картці', 'text', 'surface', 'text'],
  ['Підпис кнопки', 'on-accent', 'accent', 'text'],
  ['Кнопка на фоні', 'accent', 'bg', 'ui'],
  ['Помилка', 'danger', 'surface', 'text'],
  ['Успіх', 'success', 'surface', 'text'],
];

const SHARED_PATH = /^\/p\/([a-z0-9]{6})\/?$/;

// sharedHex: the palette the current /p/:id link points to, so the URL can drop it once the color changes.
const state = { tokens: null, exportTab: 'css', sharedHex: null };

const $ = (id) => document.getElementById(id);
const els = {
  input: $('hex-input'),
  field: document.querySelector('.hex-field'),
  error: $('hex-error'),
  picker: $('picker'),
};

function parseHex(value) {
  try {
    return normalizeHex(value);
  } catch {
    return null;
  }
}

const bare = (hex) => hex.slice(1).toUpperCase();
// Floor, so 4.497 never shows up as a passing 4.50.
const floorTo = (r, digits) => (Math.floor(r * 10 ** digits) / 10 ** digits).toFixed(digits);

// UI parts are judged on the large-text scale: 3:1 is AA, 4.5:1 is AAA.
function levelOf(ratio, kind) {
  if (kind === 'ui') return ratio >= 4.5 ? 'AAA' : ratio >= 3 ? 'AA' : 'Fail';
  return contrastLevel(ratio);
}

const passes = (ratio, kind) => ratio >= (kind === 'ui' ? 3 : 4.5);
const tone = (level) => (level === 'Fail' ? 'fail' : level === 'AA Large' ? 'large' : 'pass');

function miniBadge(fg, bg, kind = 'text') {
  const ratio = contrast(fg, bg);
  const level = levelOf(ratio, kind);
  return `<span class="mini-badge" data-level="${tone(level)}">${level} ${floorTo(ratio, 1)}</span>`;
}

// ---------- render ----------

function render() {
  const t = state.tokens;
  const light = t.themes.light;
  const { L, C, H } = hexToOklch(t.brandHex);

  $('logo-mark').style.setProperty('--sw', t.brandHex);
  $('picker-fill').style.setProperty('--sw', t.brandHex);
  els.picker.value = t.brandHex;

  $('fact-step').textContent = `brand-${t.brandStep}`;
  $('fact-oklch').textContent = `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
  $('fact-on').textContent = `on-accent ${light['on-accent'].ref}`;

  renderPresets(t.brandHex);
  renderScale($('scale-brand'), t.scales.brand, t.brandStep);
  renderScale($('scale-neutral'), t.scales.neutral);
  renderTokens(t);
  renderPreview($('preview-light'), t.themes.light);
  renderPreview($('preview-dark'), t.themes.dark);
  renderExport();
}

function renderPresets(current) {
  $('presets').innerHTML = PRESETS.map(([name, hex]) => {
    const active = normalizeHex(hex) === current;
    return `<button class="preset" type="button" data-hex="${hex}" aria-pressed="${active}">
      <span class="preset-dot" style="--sw:${hex}"></span>${name}
    </button>`;
  }).join('');
}

function renderScale(root, scale, brandStep) {
  root.innerHTML = STEPS.map((step) => {
    const hex = scale[step];
    const tag = step === brandStep ? '<span class="swatch-tag">твій</span>' : '';
    return `<button class="swatch" type="button" data-copy="${hex.toUpperCase()}" aria-label="Копіювати ${step} ${bare(hex)}">
      <span class="swatch-color" style="--sw:${hex}">${tag}</span>
      <span class="swatch-step">${step}</span>
      <span class="swatch-hex">${bare(hex)}</span>
    </button>`;
  }).join('');
}

function tokenCell(label, { ref, hex }) {
  return `<td data-label="${label}">
    <span class="token-value">
      <span class="token-chip" style="--sw:${hex}"></span>
      <span class="token-ref">${ref}</span>
      <span class="token-hex">#${bare(hex)}</span>
    </span>
  </td>`;
}

function renderTokens(t) {
  $('tokens-body').innerHTML = TOKENS.map(
    (name) => `<tr>
      <td><span class="token-name">${name}</span></td>
      ${tokenCell('Світла', t.themes.light[name])}
      ${tokenCell('Темна', t.themes.dark[name])}
    </tr>`,
  ).join('');
}

function renderPreview(root, theme) {
  const c = (name) => theme[name].hex;
  const id = root.id;

  const rows = PAIRS.map(([label, fg, bg, kind]) => {
    const ratio = contrast(c(fg), c(bg));
    const level = levelOf(ratio, kind);
    return `<li class="pair">
      <span class="pair-sample" style="--t-fg:${c(fg)};--t-bg:${c(bg)}" aria-hidden="true">Aa</span>
      <span class="pair-label">${label} <span>· ${fg} / ${bg}</span></span>
      <span class="pair-ratio">${floorTo(ratio, 2)}:1</span>
      <span class="mini-badge" data-level="${tone(level)}">${level}</span>
    </li>`;
  });
  const passed = PAIRS.filter(([, fg, bg, kind]) => passes(contrast(c(fg), c(bg)), kind)).length;

  root.innerHTML = `
    <div class="preview-head">
      <span class="preview-title">${root.dataset.themeName}</span>
      <span class="preview-score">${passed}/${PAIRS.length} пройдено</span>
    </div>
    <div class="pv-canvas">
      <article class="pv-card">
        <div class="pv-row pv-top">
          <span class="pv-eyebrow">Підписка</span>
          <span class="pv-row"><span class="pv-status">Активна</span>${miniBadge(c('success'), c('surface'))}</span>
        </div>
        <div class="pv-row">
          <h3 class="pv-title">Pro для дизайнерів</h3>
          <span class="pv-title-badge">${miniBadge(c('text'), c('surface'))}</span>
        </div>
        <p class="pv-text">Безлімітні палітри, експорт у Figma і спільний доступ для команди.</p>
        <label class="pv-label" for="${id}-mail">Email</label>
        <input class="pv-input" id="${id}-mail" value="dmytro.uxhero" aria-invalid="true" aria-describedby="${id}-mail-error">
        <p class="pv-row pv-error" id="${id}-mail-error">Бракує @ в адресі ${miniBadge(c('danger'), c('surface'))}</p>
        <div class="pv-row pv-buttons">
          <button class="pv-button" type="button">Оформити</button>
          <button class="pv-button is-hover" type="button" tabindex="-1">Наведення</button>
          <button class="pv-button is-ghost" type="button">Пізніше</button>
          ${miniBadge(c('on-accent'), c('accent'))}
        </div>
      </article>
      <p class="pv-row pv-meta">Оновлено 2 хв тому ${miniBadge(c('text-muted'), c('bg'))}</p>
    </div>
    <ul class="pairs">${rows.join('')}</ul>`;

  const canvas = root.querySelector('.pv-canvas');
  for (const name of TOKENS) canvas.style.setProperty(`--t-${name}`, theme[name].hex);
}

function renderExport() {
  $('export-tabs').innerHTML = Object.entries(EXPORTS)
    .map(
      ([key, { label }]) =>
        `<button class="export-tab" type="button" role="tab" id="tab-${key}" data-tab="${key}"
          aria-selected="${key === state.exportTab}" aria-controls="export-panel"
          tabindex="${key === state.exportTab ? 0 : -1}">${label}</button>`,
    )
    .join('');
  $('export-panel').setAttribute('aria-labelledby', `tab-${state.exportTab}`);
  $('export-code').textContent = EXPORTS[state.exportTab].build(state.tokens);
}

// ---------- actions ----------

function setHex(hex) {
  state.tokens = buildTokens(hex);
  showError(false);
  render();
  if (state.sharedHex && state.tokens.brandHex !== state.sharedHex) {
    state.sharedHex = null;
    history.replaceState(null, '', '/');
  }
}

function showError(visible) {
  els.error.hidden = !visible;
  els.input.setAttribute('aria-invalid', String(visible));
  els.field.classList.toggle('is-invalid', visible);
}

function commitInput() {
  const hex = parseHex(els.input.value);
  if (!hex) {
    showError(true);
    return;
  }
  els.input.value = bare(hex);
  setHex(hex);
}

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 1600);
}

function copyWithTextarea(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  return ok;
}

// Some embedded browsers leave clipboard.writeText pending forever, so it gets a deadline.
async function copy(text, message = 'Скопійовано') {
  let ok;
  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => setTimeout(reject, 1000)),
    ]);
    ok = true;
  } catch {
    ok = copyWithTextarea(text);
  }
  toast(ok ? message : 'Не вдалося скопіювати');
}

// ---------- events ----------

els.input.addEventListener('input', () => {
  // Apply full 6-digit values while typing; shorter ones wait for Enter or blur.
  const value = els.input.value.trim();
  showError(false);
  if (/^#?[0-9a-f]{6}$/i.test(value)) setHex(parseHex(value));
});

els.input.addEventListener('change', commitInput);
els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') commitInput();
});

els.picker.addEventListener('input', () => {
  els.input.value = bare(els.picker.value);
  setHex(els.picker.value);
});

$('presets').addEventListener('click', (e) => {
  const button = e.target.closest('.preset');
  if (!button) return;
  els.input.value = bare(button.dataset.hex);
  setHex(button.dataset.hex);
});

document.addEventListener('click', (e) => {
  const swatch = e.target.closest('[data-copy]');
  if (swatch) copy(swatch.dataset.copy);
});

$('export-copy').addEventListener('click', () => copy($('export-code').textContent));

$('export-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (!tab) return;
  state.exportTab = tab.dataset.tab;
  renderExport();
  $(`tab-${state.exportTab}`).focus();
});

$('export-tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const keys = Object.keys(EXPORTS);
  const shift = e.key === 'ArrowRight' ? 1 : -1;
  state.exportTab = keys[(keys.indexOf(state.exportTab) + shift + keys.length) % keys.length];
  renderExport();
  $(`tab-${state.exportTab}`).focus();
});

async function share() {
  const button = $('share');
  button.disabled = true;
  button.textContent = 'Зберігаю…';
  try {
    const res = await fetch('/api/palettes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hex: state.tokens.brandHex }),
    });
    if (!res.ok) throw new Error(res.status);
    const { id, url } = await res.json();
    state.sharedHex = state.tokens.brandHex;
    history.replaceState(null, '', `/p/${id}`);
    await copy(url, 'Посилання скопійовано');
  } catch {
    toast('Не вдалося зберегти палітру');
  } finally {
    button.disabled = false;
    button.textContent = 'Поділитися';
  }
}

$('share').addEventListener('click', share);

// ---------- start ----------

async function loadShared(id) {
  try {
    const res = await fetch(`/api/palettes/${id}`);
    if (!res.ok) throw new Error(res.status);
    const { hex } = await res.json();
    els.input.value = bare(hex);
    setHex(hex);
    state.sharedHex = state.tokens.brandHex;
  } catch {
    history.replaceState(null, '', '/');
    toast('Палітру за посиланням не знайдено');
  }
}

els.input.value = bare(DEFAULT_HEX);
setHex(DEFAULT_HEX);

const sharedId = location.pathname.match(SHARED_PATH)?.[1];
if (sharedId) loadShared(sharedId);
