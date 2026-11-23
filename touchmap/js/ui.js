// Small DOM helpers. Text always goes in through textContent, never innerHTML.

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
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
const PATHS = {
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
};

export function icon(name, cls = '') {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ico ' + cls);
  const p = document.createElementNS(SVGNS, 'path');
  p.setAttribute('d', PATHS[name] || '');
  if (name === 'play' || name === 'stop') p.setAttribute('class', 'fill');
  svg.append(p);
  return svg;
}

/* ---------- toast ---------- */
let toastTimer = null;
export function toast(msg, { action, timeout = 4500, tone = '' } = {}) {
  const el = document.getElementById('toast');
  clearTimeout(toastTimer);
  clear(el, h('span', { class: 'toast-msg', text: msg }),
    action ? h('button', { class: 'toast-act', type: 'button', onclick: () => { el.hidden = true; action.fn(); } }, action.label) : null);
  el.className = 'toast ' + tone;
  el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, timeout);
}

/* ---------- modal ---------- */
export function openModal(content, { onClose, label = 'Dialog', wide = false } = {}) {
  const dlg = document.getElementById('modal');
  dlg.className = 'modal' + (wide ? ' wide' : '');
  dlg.setAttribute('aria-label', label);
  clear(dlg, content);
  const done = () => { dlg.removeEventListener('close', done); onClose?.(); };
  dlg.addEventListener('close', done);
  dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); };
  if (!dlg.open) dlg.showModal();
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
export const fmt = {
  int: (n) => (n == null || !isFinite(n) ? '–' : Math.round(n).toLocaleString('en-GB')),
  dec: (n, dp = 1) => (n == null || !isFinite(n) ? '–' : n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })),
  pct: (n, dp = 0) => (n == null || !isFinite(n) ? '–' : (n * 100).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }) + '%'),
  time: (iso) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''),
  timeSec: (iso) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''),
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
