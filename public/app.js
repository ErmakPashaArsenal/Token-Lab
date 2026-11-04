// UI: state, render, events. Color math lives in color.js, tokens in tokens.js.

import { STEPS, contrast, contrastLevel, normalizeHex } from './color.js';
import { TOKENS, buildTokens, toCSS, toJSON, toTailwind } from './tokens.js';

const DEFAULT_HEX = '#4f46e5';

const PRESETS = [
  ['Індиго', '#4F46E5'],
  ['Жовтий', '#FACC15'],
  ['Червоний', '#E5484D'],
  ['Бірюза', '#12A594'],
  ['Синій', '#3B5BFD'],
  ['Помаранч', '#F97316'],
  ['Графіт', '#334155'],
];

const EXPORTS = {
  css: { label: 'CSS', file: 'tokens.css', build: toCSS },
  tailwind: { label: 'Tailwind', file: 'app.css · Tailwind v4', build: toTailwind },
  json: { label: 'JSON', file: 'tokens.json', build: toJSON },
};

const state = { tokens: null, exportTab: 'css' };

const $ = (id) => document.getElementById(id);
const els = {
  input: $('hex-input'),
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

const upper = (hex) => hex.toUpperCase();
// Floor, so 4.497 never shows up as a passing 4.50.
const ratioText = (r) => `${(Math.floor(r * 100) / 100).toFixed(2)}:1`;
const levelSlug = (level) => level.toLowerCase().replace(' ', '-');

// ---------- render ----------

function render() {
  const t = state.tokens;
  const light = t.themes.light;

  $('pill-dot').style.setProperty('--sw', t.brandHex);
  $('pill-hex').textContent = upper(t.brandHex);
  $('picker-fill').style.setProperty('--sw', t.brandHex);
  els.picker.value = t.brandHex;
  $('meta-step').textContent = t.brandStep;

  const onRatio = contrast(light['on-accent'].hex, light.accent.hex);
  $('meta-on').textContent = light['on-accent'].ref === 'white' ? 'білий' : 'темний';
  $('meta-ratio').textContent = `${ratioText(onRatio)} ${contrastLevel(onRatio)}`;

  renderHero(t);
  renderPresets(t.brandHex);
  renderScale($('scale-brand'), t.scales.brand, t.brandStep);
  renderScale($('scale-neutral'), t.scales.neutral);
  renderTokens(t);
  renderPreview($('preview-light'), t.themes.light);
  renderPreview($('preview-dark'), t.themes.dark);
  renderExport();
}

function renderHero(t) {
  const { accent, 'on-accent': on } = t.themes.light;
  const hero = $('hero');
  hero.style.setProperty('--t-accent', accent.hex);
  hero.style.setProperty('--t-on-accent', on.hex);
  const ratio = contrast(on.hex, accent.hex);
  $('hero-title').textContent = upper(t.brandHex);
  $('hero-sub').textContent = `Крок ${t.brandStep} · текст ${on.ref === 'white' ? 'білий' : 'темний'} · ${ratioText(ratio)} ${contrastLevel(ratio)}`;
  $('hero-coins').innerHTML = [300, 500, 700, 900]
    .map((step) => `<span class="coin" style="--sw:${t.scales.brand[step]}"></span>`)
    .join('');
}

function renderPresets(current) {
  $('presets').innerHTML = PRESETS.map(([name, hex]) => {
    const active = normalizeHex(hex) === current;
    return `<button class="preset" type="button" data-hex="${hex}" aria-pressed="${active}">
      <span class="swatch-dot" style="--sw:${hex}"></span><span>${name}</span>
    </button>`;
  }).join('');
}

function renderScale(root, scale, brandStep) {
  root.innerHTML = STEPS.map((step) => {
    const hex = scale[step];
    const tag = step === brandStep ? '<span class="swatch-tag">бренд</span>' : '';
    return `<button class="swatch" type="button" data-copy="${upper(hex)}" aria-label="Копіювати ${step} ${upper(hex)}">
      <span class="swatch-color" style="--sw:${hex}">${tag}</span>
      <span class="swatch-meta"><span class="swatch-step">${step}</span><span class="swatch-hex">${upper(hex)}</span></span>
    </button>`;
  }).join('');
}

function tokenCell(label, { ref, hex }) {
  return `<td data-label="${label}">
    <div class="token-value">
      <span class="token-chip" style="--sw:${hex}"></span>
      <span class="token-text"><span class="token-hex">${upper(hex)}</span><span class="token-ref">${ref}</span></span>
    </div>
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

function badge(label, fg, bg) {
  const ratio = contrast(fg, bg);
  const level = contrastLevel(ratio);
  return `<li class="badge" data-level="${levelSlug(level)}">
    <span>${label}</span><span class="badge-ratio">${ratioText(ratio)}</span><span class="badge-level">${level}</span>
  </li>`;
}

function renderPreview(root, theme) {
  const c = (name) => theme[name].hex;
  const id = root.id;
  root.innerHTML = `
    <div class="preview-head">${root.dataset.themeName}</div>
    <div class="pv-canvas">
      <div class="pv-item">
        <article class="pv-card">
          <h3 class="pv-card-title">Картка</h3>
          <p class="pv-card-text">Основний текст на surface.</p>
          <p class="pv-card-meta"><span>Оновлено 2 хв тому</span><span class="pv-success">Збережено</span></p>
        </article>
        <ul class="badges">
          ${badge('Текст', c('text'), c('surface'))}
          ${badge('Другорядний', c('text-muted'), c('surface'))}
          ${badge('Успіх', c('success'), c('surface'))}
        </ul>
      </div>
      <div class="pv-item">
        <div class="pv-fields">
          <div>
            <label class="pv-label" for="${id}-name">Назва</label>
            <input class="pv-input" id="${id}-name" value="Token Lab">
          </div>
          <div>
            <label class="pv-label" for="${id}-mail">Email</label>
            <input class="pv-input is-invalid" id="${id}-mail" placeholder="name@studio.ua">
            <p class="pv-error">Перевір адресу</p>
          </div>
        </div>
        <ul class="badges">
          ${badge('Значення', c('text'), c('bg'))}
          ${badge('Плейсхолдер', c('text-muted'), c('bg'))}
          ${badge('Помилка', c('danger'), c('bg'))}
        </ul>
      </div>
      <div class="pv-item">
        <div class="pv-buttons">
          <button class="pv-button" type="button">Зберегти</button>
          <button class="pv-button is-hover" type="button" tabindex="-1">Hover</button>
        </div>
        <ul class="badges">
          ${badge('Напис', c('on-accent'), c('accent'))}
          ${badge('Hover', c('on-accent'), c('accent-hover'))}
          ${badge('Кнопка на фоні', c('accent'), c('bg'))}
        </ul>
      </div>
    </div>`;
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
  const current = EXPORTS[state.exportTab];
  $('export-panel').setAttribute('aria-labelledby', `tab-${state.exportTab}`);
  $('export-name').textContent = current.file;
  $('export-code').textContent = current.build(state.tokens);
}

// ---------- actions ----------

function setHex(hex) {
  state.tokens = buildTokens(hex);
  showError(false);
  render();
}

function showError(visible) {
  els.error.hidden = !visible;
  els.input.setAttribute('aria-invalid', String(visible));
}

function commitInput() {
  const hex = parseHex(els.input.value);
  if (!hex) {
    showError(true);
    return;
  }
  els.input.value = upper(hex);
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
async function copy(text) {
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
  toast(ok ? 'Скопійовано' : 'Не вдалося скопіювати');
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
  els.input.value = upper(els.picker.value);
  setHex(els.picker.value);
});

$('presets').addEventListener('click', (e) => {
  const button = e.target.closest('.preset');
  if (!button) return;
  els.input.value = upper(button.dataset.hex);
  setHex(button.dataset.hex);
});

document.addEventListener('click', (e) => {
  const swatch = e.target.closest('[data-copy]');
  if (swatch) copy(swatch.dataset.copy);
});

$('hero-copy').addEventListener('click', () => copy(upper(state.tokens.brandHex)));
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

document.querySelector('.tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
});

$('sidebar-toggle').addEventListener('click', (e) => {
  const collapsed = document.body.classList.toggle('sidebar-collapsed');
  e.currentTarget.setAttribute('aria-expanded', String(!collapsed));
  e.currentTarget.setAttribute('aria-label', collapsed ? 'Показати панель' : 'Сховати панель');
});

// ---------- start ----------

els.input.value = upper(DEFAULT_HEX);
setHex(DEFAULT_HEX);
