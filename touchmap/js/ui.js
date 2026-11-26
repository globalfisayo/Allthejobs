// Small DOM helpers. Text always goes in through textContent, never innerHTML.
import { LUCIDE, LUCIDE_TAGS } from './icons-lib.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') { for (const [p, x] of Object.entries(v)) { if (x == null) continue; if (p.startsWith('--')) el.style.setProperty(p, x); else el.style[p] = x; } }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function clear(el, ...kids) { el.replaceChildren(); append(el, kids); return el; }

const SVGNS = 'http://www.w3.org/2000/svg';
export const PATHS = {
  timer: 'M9 2h6M12 2v3M5.6 7.6l-1.4-1.4M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 10v4l2.5 2',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  run: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M8 12h8M8 16h5',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M19 19v2H6',
  play: 'M7 4.5v15l12-7.5z',
  stop: 'M6 6h12v12H6z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  next: 'M5 5l8 7-8 7M15 5v14',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  check: 'M4 12.5l5 5L20 6.5',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-5M12 8h.01',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v8h14v-8',
  upload: 'M12 21V9M7 14l5-5 5 5M4 3h16',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  close: 'M6 6l12 12M18 6L6 18',
  warn: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-7a1.5 1.5 0 0 1 3 0V12M14 6.5a1.5 1.5 0 0 1 3 0V13M17 8.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L4 15.5a1.6 1.6 0 0 1 2.6-1.9L8 15.5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a7 7 0 0 1 14 0v1',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  cloud: 'M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z',
  cloudCheck: 'M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8zM9 13l2 2 4-4',
  cloudOff: 'M7 18a5 5 0 1 1 .9-9.9M12 6.3A6 6 0 0 1 19 10a4 4 0 0 1 1.8 7.5M3 3l18 18',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  chevron: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  report: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h6',
  printer: 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  zap: 'M13 2L4 14h7l-1 8 9-12h-7z',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  pin: 'M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3 3.6M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  gauge: 'M12 14l4-4M3 15a9 9 0 1 1 18 0M12 14h.01',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  open: 'M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5',
  box: 'M4 4h16v16H4z',
  boxCheck: 'M4 4h16v16H4zM8 12l3 3 5-6',
  database: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  hash: 'M5 9h14M5 15h14M10 3L8 21M16 3l-2 18',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  factory: 'M3 21V10l6 4V10l6 4V6l6 3v12zM3 21h18M7 17h2M12 17h2M17 17h2',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9',
  line: 'M3 17h18M6 21l1.5-4M18 21l-1.5-4M7 17v-6l1-2V6h2v3l1 2v6M14 17v-6l1-2V6h2v3l1 2v6',
  building: 'M4 21V5l8-3v19M12 21V9l8 3v9M2 21h20M7 8h2M7 12h2M7 16h2M15 14h2M15 18h2',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4M12 15v2',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  group: 'M7 7h5v5H7zM12 12h5v5h-5zM3 3h2M19 3h2M3 21h2M19 21h2M3 3v2M3 19v2M21 3v2M21 19v2',
  ungroup: 'M4 4h6v6H4zM14 14h6v6h-6z',
  shapes: 'M8.5 3l4.5 8H4zM17.5 21a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM4 14h7v7H4z',
  save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
  back: 'M19 12H5M12 19l-7-7 7-7',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
};

/** Path data for an app icon or a Lucide icon. */
export const iconPath = (name) => PATHS[name] || LUCIDE[name] || '';
export const ICON_NAMES = () => [...new Set([...Object.keys(PATHS), ...Object.keys(LUCIDE)])];

/**
 * A searchable icon picker in a dialog. Resolves to the chosen name, or null.
 * `suggested` is shown first and marked.
 */
export function pickIcon({ title = 'Choose an icon', current = '', suggested = '' } = {}) {
  return new Promise((resolve) => {
    // its own dialog, on top of whatever form asked for it, so that form stays as it was
    const dlg = h('dialog', { class: 'modal wide ip-dialog', 'aria-label': title });
    let done = false;
    const finish = (v) => { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener('close', () => finish(null));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) finish(null); });
    const q = h('input', { type: 'search', class: 'ip-search', placeholder: 'Search icons, e.g. robot, water, box', 'aria-label': 'Search icons' });
    const grid = h('div', { class: 'ip-grid', role: 'listbox', 'aria-label': 'Icons' });
    const all = ICON_NAMES();
    const paint = () => {
      const t = q.value.trim().toLowerCase();
      const hits = all.filter(n => !t || n.includes(t) || (LUCIDE_TAGS[n] || '').includes(t));
      const ordered = suggested && hits.includes(suggested) ? [suggested, ...hits.filter(n => n !== suggested)] : hits;
      clear(grid, ordered.length ? ordered.map(n => h('button', {
        type: 'button', class: 'ip-btn' + (n === current ? ' on' : '') + (n === suggested ? ' sug' : ''), role: 'option', 'aria-selected': String(n === current), title: n, 'aria-label': n,
        onclick: () => finish(n),
      }, icon(n), h('span', { class: 'ip-name', text: n === suggested ? 'Suggested' : n.replace(/-/g, ' ') }))) : h('p', { class: 'muted', text: 'No icon by that name. Try a simpler word.' }));
    };
    q.addEventListener('input', paint);
    dlg.append(h('div', { class: 'ip' },
      h('div', { class: 'wiz-top' }, h('h2', { text: title }),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => finish(null) }, icon('close'))),
      q, grid,
      h('p', { class: 'muted small', text: 'Icons from Lucide (lucide.dev), free under the ISC licence.' })));
    document.body.append(dlg);
    dlg.showModal();
    paint();
    setTimeout(() => q.focus(), 50);
  });
}

export function icon(name, cls = '') {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ico ' + cls);
  const p = document.createElementNS(SVGNS, 'path');
  p.setAttribute('d', iconPath(name));
  if (name === 'play' || name === 'stop') p.setAttribute('class', 'fill');
  svg.append(p);
  return svg;
}

/* ---------- toast ---------- */
let toastTimer = null;
export function toast(msg, { action, timeout = 4500, tone = '' } = {}) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  clear(el, h('span', { class: 'toast-msg', text: msg }),
    action ? h('button', { class: 'toast-act', type: 'button', onclick: () => { el.hidden = true; action.fn(); } }, action.label) : null);
  el.className = 'toast ' + tone;
  el.hidden = false;
  homeToast();
  toastTimer = setTimeout(() => { el.hidden = true; }, timeout);
}
// An open dialog makes the rest of the page inert, so while one is open the toast (and its
// Undo) lives inside it, pinned to its bottom; it moves back when the dialog closes.
function homeToast() {
  const el = document.getElementById('toast');
  const dlg = document.getElementById('modal');
  if (!el || !dlg) return;
  const target = dlg.open && !el.hidden ? dlg : document.body;
  if (el.parentElement !== target) target.append(el);
}
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => document.getElementById('modal')?.addEventListener('close', () => { const el = document.getElementById('toast'); if (el && el.parentElement !== document.body) document.body.append(el); }));
}

/* ---------- modal ---------- */
export function openModal(content, { onClose, label = 'Dialog', wide = false } = {}) {
  const dlg = document.getElementById('modal');
  dlg.className = 'modal' + (wide ? ' wide' : '');
  dlg.setAttribute('aria-label', label);
  const t = document.getElementById('toast');
  clear(dlg, content);
  if (t && !t.isConnected) dlg.append(t);   // a toast shown over the previous dialog content stays
  const done = () => { dlg.removeEventListener('close', done); onClose?.(); };
  dlg.addEventListener('close', done);
  dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); };
  if (!dlg.open) dlg.showModal();
  homeToast();
  dlg.scrollTop = 0;
  return () => dlg.open && dlg.close();
}

export function closeModal() {
  const dlg = document.getElementById('modal');
  if (dlg.open) dlg.close();
}

export function confirmBox({ title, body, ok = 'OK', cancel = 'Cancel', danger = false }) {
  return new Promise(resolve => {
    let answered = false;
    const finish = (v) => { answered = true; closeModal(); resolve(v); };
    openModal(h('div', { class: 'confirm' },
      h('h2', { text: title }),
      body ? h('p', { text: body }) : null,
      h('div', { class: 'row-end' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => finish(false) }, cancel),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'button', onclick: () => finish(true) }, ok))),
    { label: title, onClose: () => { if (!answered) resolve(false); } });
  });
}

/* ---------- files ---------- */
export function canShareFiles() {
  try {
    return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.txt', { type: 'text/plain' })] }));
  } catch { return false; }
}

export async function deliverFile(data, filename, type, { share = false } = {}) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  if (share && canShareFiles()) {
    try {
      await navigator.share({ files: [new File([blob], filename, { type })], title: filename });
      return true;
    } catch (e) {
      if (e?.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  return true;
}

export function pickFile(accept) {
  return new Promise(resolve => {
    const input = h('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', () => { resolve(input.files?.[0] || null); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

/* ---------- formatting ---------- */
function clock12(d, sec = false) {
  const p = (n) => String(n).padStart(2, '0');
  const hr = d.getHours();
  return `${hr % 12 || 12}:${p(d.getMinutes())}${sec ? ':' + p(d.getSeconds()) : ''} ${hr < 12 ? 'am' : 'pm'}`;
}
export const fmt = {
  int: (n) => (n == null || !isFinite(n) ? '–' : Math.round(n).toLocaleString('en-GB')),
  dec: (n, dp = 1) => (n == null || !isFinite(n) ? '–' : n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })),
  pct: (n, dp = 0) => (n == null || !isFinite(n) ? '–' : (n * 100).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }) + '%'),
  // on screen, a 12-hour clock: 4:00 pm (exports keep 16:00 for the data)
  time: (iso) => (iso ? clock12(new Date(iso)) : ''),
  timeSec: (iso) => (iso ? clock12(new Date(iso), true) : ''),
  /** An hour of the day ('16') → '4 pm'; as a range → '4:00–4:59 pm'. */
  hour: (hh) => { const n = Number(hh); return `${n % 12 || 12} ${n < 12 ? 'am' : 'pm'}`; },
  hourRange: (hh) => { const n = Number(hh); return `${n % 12 || 12}:00–${n % 12 || 12}:59 ${n < 12 ? 'am' : 'pm'}`; },
  day: (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''),
  dayKey: (iso) => {
    if (!iso) return '';
    const d = new Date(iso); const p = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },
  ago: (iso) => {
    if (!iso) return 'never';
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const hrs = Math.round(m / 60);
    if (hrs < 36) return `${hrs} h ago`;
    return `${Math.round(hrs / 24)} days ago`;
  },
};

export function stamp(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function slug(s) {
  return String(s || 'touch-map').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'touch-map';
}


/* ---------- collapsible group (remembers open/closed per id) ---------- */
const GKEY = 'touchmap:groups';
function groupState() { try { return JSON.parse(localStorage.getItem(GKEY) || '{}'); } catch { return {}; } }
export function group(id, title, iconName, { open = false, badge = null, extra = null, cls = '' } = {}, ...body) {
  const saved = groupState()[id];
  const d = h('details', { class: 'grp ' + cls, 'data-grp': id, open: saved ?? open },
    h('summary', { class: 'grp-h' },
      h('span', { class: 'grp-ico' }, icon(iconName)),
      h('span', { class: 'grp-title', text: title }),
      badge != null && badge !== '' ? h('span', { class: 'grp-badge', text: String(badge) }) : null,
      h('span', { class: 'grow' }),
      extra,
      icon('chevron', 'grp-chev')),
    h('div', { class: 'grp-body' }, body));
  d.addEventListener('toggle', () => {
    try { const st = groupState(); st[id] = d.open; localStorage.setItem(GKEY, JSON.stringify(st)); } catch { /* fine */ }
  });
  return d;
}

/** A small ⓘ toggle instead of a paragraph of explanation. */
export function infoNote(text, label = 'What this means') {
  return h('details', { class: 'info-note' },
    h('summary', { 'aria-label': label }, icon('info'), h('span', { text: label })),
    h('p', { text }));
}

export function fmtDuration(min) {
  if (min == null || !isFinite(min)) return '–';
  const m = Math.round(min);
  const hh = Math.floor(m / 60), mm = m % 60;
  return hh ? `${hh} h ${String(mm).padStart(2, '0')} min` : `${mm} min`;
}
