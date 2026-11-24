// Analytics: the template's Analysis sheet, made interactive for review and presenting.
// Every chart filters the whole page when tapped; each chart ignores its own filter so the
// other choices stay visible (the selected one is highlighted instead).
import { CAT_BY_CODE, CATEGORIES, NOTES, READING_COMPARISON } from './framework.js';
import { analyse, NOT_SET } from './analysis.js';
import { fmtMin, totalMinutes, runCapacity, observedMinutes } from './model.js';
import { state, activeRun, runsList } from './store.js';
import { h, clear, icon, fmt, infoNote, openModal, closeModal, fmtDuration } from './ui.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const COLOUR = {
  Planned: 'var(--c-planned)', Unplanned: 'var(--c-unplanned)',
  Physical: 'var(--c-physical)', Information: 'var(--c-information)',
  none: 'var(--c-none)', single: 'var(--c-single)',
};
const LEVER = {
  'Planned|Physical': 'Automate by design',
  'Planned|Information': 'Digitalise',
  'Unplanned|Physical': 'Fix reliability, then automate',
  'Unplanned|Information': 'Fix reliability, then digitalise',
};

/* ---------- filters ---------- */
const F = { runs: [], run: '', day: '', observer: '', planned: '', category: '', zone: '', touchType: '', who: '', type: '', hour: '' };
const UI = { catOrder: 'pareto', typeSort: 'minutes', typeAll: false, filtersOpen: false };
let rootEl = null;

const hourOf = (t) => { const iso = t.start || t.createdAt; return iso ? String(new Date(iso).getHours()).padStart(2, '0') : ''; };
const typeKey = (t) => (t.category && t.type ? `${t.category}\u0000${t.type}` : '');
const DIMS = {
  run: { label: 'Run', get: t => t._run, name: v => state.runs[v]?.name || 'Run' },
  day: { label: 'Day', get: t => fmt.dayKey(t.start || t.createdAt), name: v => fmt.day(v + 'T12:00:00') },
  observer: { label: 'Observer', get: t => t.observer },
  planned: { label: 'Planned / Unplanned', get: t => t.planned },
  category: { label: 'Category', get: t => t.category, name: v => CAT_BY_CODE[v]?.name || v },
  zone: { label: 'Zone', get: t => t.zone },
  touchType: { label: 'Touch type', get: t => t.touchType },
  who: { label: 'Person', get: t => t.who },
  type: { label: 'Type of touch', get: typeKey, name: v => v.replace('\u0000', ' · ') },
  hour: { label: 'Hour', get: hourOf, name: v => `${v}:00–${v}:59` },
};
const DIM_KEYS = Object.keys(DIMS);
const activeDims = () => DIM_KEYS.filter(d => F[d]);

function scope() {
  F.runs = F.runs.filter(id => state.runs[id]);
  const runs = F.runs.length ? F.runs.map(id => state.runs[id]) : [activeRun()];
  if (F.run && !runs.some(r => r.id === F.run)) F.run = '';
  const touches = runs.flatMap(r => r.touches.map(t => ({ ...t, _run: r.id })));
  const capacity = runs.filter(r => !F.run || r.id === F.run).reduce((s, r) => s + runCapacity(r), 0);
  const label = runs.length === 1 ? runs[0].name : `${runs.length} runs`;
  return { runs, touches, capacity, label };
}

/** Open Analysis on these runs (one, several, or all), with other filters cleared. */
export function analyseRuns(ids) {
  F.runs = [...new Set(ids)].filter(id => state.runs[id]);
  for (const d of DIM_KEYS) F[d] = '';
  if (location.hash.startsWith('#analysis')) rerender(); else location.hash = '#analysis';
}

function runPicker() {
  const chosen = new Set(F.runs.length ? F.runs : [state.activeRunId]);
  const list = runsList().slice().reverse();
  const box = h('div', { class: 'confirm run-picker' });
  const paint = () => clear(box,
    h('div', { class: 'wiz-top' }, h('h2', {}, icon('history'), ' Which runs?'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close'))),
    h('div', { class: 'row-gap' },
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => { chosen.clear(); chosen.add(state.activeRunId); paint(); } }, icon('timer'), 'This run'),
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => { chosen.clear(); list.filter(r => !r.localOnly).forEach(r => chosen.add(r.id)); paint(); } }, icon('layers'), 'All runs')),
    h('ul', { class: 'pick-list' }, list.map(r => {
      const cb = h('input', { type: 'checkbox', checked: chosen.has(r.id), id: 'pk-' + r.id });
      cb.addEventListener('change', () => { if (cb.checked) chosen.add(r.id); else chosen.delete(r.id); });
      const days = [...new Set(r.touches.map(t => fmt.dayKey(t.start || t.createdAt)).filter(Boolean))].sort();
      return h('li', {}, h('label', { for: 'pk-' + r.id }, cb,
        h('span', { class: 'pk-name', text: r.name }),
        h('span', { class: 'muted small' }, icon('calendar'), days.length ? fmt.day(days[0] + 'T12:00:00') + (days.length > 1 ? ` +${days.length - 1}` : '') : '–', '  ', icon('hand'), String(r.touches.length))));
    })),
    h('div', { class: 'row-end' },
      h('button', { type: 'button', class: 'btn primary', onclick: () => { closeModal(); analyseRuns(chosen.size ? [...chosen] : [state.activeRunId]); } }, icon('check'), 'Show')));
  paint();
  openModal(box, { label: 'Which runs?' });
}

/** One row per run when several are in view: how they compare. */
function runsCompared(sc) {
  const rows = sc.runs.map(r => {
    let planned = 0, unplanned = 0, touches = 0;
    for (const t of filtered(sc.touches.filter(x => x._run === r.id), ['run'])) {
      const m = totalMinutes(t);
      if (t.planned === 'Planned') planned += m; else if (t.planned === 'Unplanned') unplanned += m;
      touches += Number(t.count) || 0;
    }
    const cap = runCapacity(r);
    const days = [...new Set(r.touches.map(t => fmt.dayKey(t.start || t.createdAt)).filter(Boolean))].sort();
    return { r, planned, unplanned, total: planned + unplanned, touches, cap, cov: cap ? (planned + unplanned) / 60 / cap : null, days, obs: observedMinutes(r).minutes };
  });
  const max = Math.max(...rows.map(x => x.total), 0) || 1;
  return card('Runs compared', 'One row per run, with the other filters applied. Tap a run to look at it alone.',
    legendRow(),
    h('div', { class: 'cmp' }, rows.map(x => {
      const el = h('div', { class: 'cmp-row' + selState('run', x.r.id) },
        h('div', { class: 'cmp-name' }, h('strong', { text: x.r.name }),
          h('span', { class: 'muted small' }, icon('calendar'), x.days.length ? fmt.day(x.days[0] + 'T12:00:00') : '–', ' ', icon('clock'), fmtDuration(x.obs))),
        h('div', { class: 'cmp-bar' },
          h('span', { style: { width: `${(x.planned / max) * 100}%`, background: COLOUR.Planned } }),
          h('span', { style: { width: `${(x.unplanned / max) * 100}%`, background: COLOUR.Unplanned } })),
        h('div', { class: 'cmp-val' }, h('strong', { text: `${fmtMin(x.total)} min` }), h('span', { class: 'muted small', text: `${fmt.pct(x.cov)} cov · ${fmt.int(x.touches)} t` })));
      return interactive(el, { lead: `${fmtMin(x.total)} min`, rest: [x.r.name, `Planned ${fmtMin(x.planned)} · Unplanned ${fmtMin(x.unplanned)}`, `Coverage ${fmt.pct(x.cov)}`], onPick: () => toggle({ run: x.r.id }) });
    })));
}
const legendRow = () => legend([{ label: 'Planned', colour: COLOUR.Planned }, { label: 'Unplanned', colour: COLOUR.Unplanned }]);

function filtered(touches, except = []) {
  const skip = new Set(except);
  const dims = activeDims().filter(d => !skip.has(d));
  return touches.filter(t => dims.every(d => DIMS[d].get(t) === F[d]));
}

function toggle(changes) {
  const allSame = Object.entries(changes).every(([d, v]) => F[d] === v);
  for (const [d, v] of Object.entries(changes)) F[d] = allSame ? '' : v;
  rerender();
}
function rerender() {
  if (!rootEl) return;
  const y = window.scrollY;
  renderInsights(rootEl);
  window.scrollTo(0, y);
}

/* ---------- tooltip ---------- */
let tipEl = null;
function showTip(target, lead, rest) {
  if (!tipEl) { tipEl = h('div', { class: 'tip', role: 'tooltip', hidden: true }); document.body.append(tipEl); }
  clear(tipEl, h('strong', { text: lead }), rest.filter(Boolean).map(r => h('span', { text: r })));
  tipEl.hidden = false;
  const r = target.getBoundingClientRect();
  const w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
  const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  let y = r.top - hh - 8;
  if (y < 8) y = r.bottom + 8;
  tipEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y + window.scrollY)}px)`;
}
function hideTip() { if (tipEl) tipEl.hidden = true; }
window.addEventListener('scroll', hideTip, { passive: true });

/** Hover/focus shows details; click, Enter or Space applies the filter. */
function interactive(el, { lead, rest = [], onPick, label }) {
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  if (label) el.setAttribute('aria-label', label);
  el.addEventListener('pointerenter', () => showTip(el, lead, rest));
  el.addEventListener('pointerleave', hideTip);
  el.addEventListener('focus', () => showTip(el, lead, rest));
  el.addEventListener('blur', hideTip);
  if (onPick) {
    el.addEventListener('click', () => { hideTip(); onPick(); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hideTip(); onPick(); } });
  }
  return el;
}

/* ---------- pieces ---------- */
const svg = (tag, attrs = {}) => { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };

function selState(dim, key) {
  if (!F[dim]) return '';
  return F[dim] === key ? ' sel' : ' dimmed';
}

function legend(items, { dim } = {}) {
  return h('ul', { class: 'legend' }, items.map(i => {
    const li = h('li', { class: dim ? 'pickable' + selState(dim, i.key) : '' },
      h('span', { class: 'swatch' + (i.track ? ' track' : ''), style: { background: i.track ? '' : i.colour } }),
      h('span', { text: i.label }));
    if (dim && i.key) interactive(li, { lead: i.label, onPick: () => toggle({ [dim]: i.key }) });
    return li;
  }));
}

/** Donut for an at-a-glance share (≤ 6 parts). The legend and labels carry the numbers. */
function donut({ parts, dim, centre, caption, ariaLabel }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const S = 220, cx = 110, cy = 110, R = 104, r = 66;
  const el = svg('svg', { viewBox: `0 0 ${S} ${S}`, class: 'donut', role: 'group', 'aria-label': ariaLabel });
  const pt = (rad, deg) => { const a = (deg - 90) * Math.PI / 180; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; };
  const arc = (a0, a1) => {
    const large = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0);
    return `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${large} 0 ${x3} ${y3}Z`;
  };
  let a = 0;
  for (const p of parts.filter(p => p.value > 0)) {
    const share = total ? p.value / total : 0;
    const a1 = a + share * 360;
    const d = share > 0.9999 ? `${arc(0, 180)}${arc(180, 359.999)}` : arc(a, a1);
    const g = svg('g', { class: 'arc' + (dim && p.key ? selState(dim, p.key) : '') });
    g.append(svg('path', { d, fill: p.colour }));
    if (share >= 0.08 && p.inside !== false) {
      const [tx, ty] = pt((R + r) / 2, a + share * 180);
      const t = svg('text', { x: tx, y: ty, class: 'arc-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      t.textContent = p.inside ?? fmt.pct(share);
      g.append(t);
    }
    interactive(g, {
      lead: `${fmtMin(p.value)} min · ${fmt.pct(share)}`, rest: [p.label, ...(p.rest || [])],
      label: `${p.label}: ${fmtMin(p.value)} minutes, ${fmt.pct(share)}`,
      onPick: dim && p.key ? () => toggle({ [dim]: p.key }) : null,
    });
    el.append(g);
    a = a1;
  }
  if (!total) el.append(svg('circle', { cx, cy, r: (R + r) / 2, fill: 'none', stroke: 'var(--track)', 'stroke-width': R - r }));
  const c1 = svg('text', { x: cx, y: cy - 6, class: 'donut-centre', 'text-anchor': 'middle' }); c1.textContent = centre;
  const c2 = svg('text', { x: cx, y: cy + 20, class: 'donut-caption', 'text-anchor': 'middle' }); c2.textContent = caption;
  el.append(c1, c2);
  return el;
}

function splitParts(blk, order) {
  const items = blk.items.filter(i => i.minutes > 0);
  return [...order.filter(k => items.some(i => i.key === k)).map(k => items.find(i => i.key === k)), ...items.filter(i => !order.includes(i.key))]
    .map(i => ({ key: i.key === NOT_SET ? '' : i.key, label: i.key === NOT_SET ? 'Not set' : i.key, value: i.minutes, colour: COLOUR[i.key] || COLOUR.none, rest: [`${fmt.int(i.touches)} touches · ${fmt.dec(i.opHours, 1)} op-hours`] }));
}

function donutCard(title, note, d, items, dim) {
  return h('section', { class: 'card donut-card' },
    h('h2', { class: 'card-h', text: title }),
    h('div', { class: 'donut-wrap' }, d),
    legend(items.map(i => ({ key: i.key, label: `${i.label} · ${fmtMin(i.value)} min`, colour: i.colour })), { dim }),
    note ? infoNote(note) : null);
}

function barList(items, { label, colour = () => COLOUR.single, dim, keyOf = i => i.key, highlight = () => false }) {
  const max = Math.max(...items.map(i => i.minutes), 0);
  return h('div', { class: 'bars' }, items.map(i => {
    const w = max ? i.minutes / max : 0;
    const key = keyOf(i);
    const row = h('div', { class: 'bar-row' + (highlight(i) ? ' hi' : '') + (dim && key ? selState(dim, key) : '') },
      h('div', { class: 'bar-label' }, label(i, true)),
      h('div', { class: 'bar-track' },
        h('div', { class: 'bar', style: { width: `max(${i.minutes > 0 ? '3px' : '0px'}, calc((100% - 112px) * ${w.toFixed(4)}))`, background: colour(i) } }),
        h('span', { class: 'bar-val' }, h('strong', { text: fmtMin(i.minutes) }), ' min', h('span', { class: 'bar-pct', text: ` · ${fmt.pct(i.pct)}` }))));
    return interactive(row, {
      lead: `${fmtMin(i.minutes)} min`, label: `${label(i)}: ${fmtMin(i.minutes)} minutes`,
      rest: [label(i), `${fmt.int(i.touches)} touches · ${fmt.dec(i.opHours, 2)} op-hours`, `${fmt.pct(i.pct, 1)} of minutes${i.cum != null ? ` · cumulative ${fmt.pct(i.cum)}` : ''}`],
      onPick: dim && key && key !== NOT_SET ? () => toggle({ [dim]: key }) : null,
    });
  }));
}

function table(label, blk, nameOf = i => i.key, { cum = false } = {}) {
  const head = [label, 'Touches', 'Minutes', 'Op-hours', '% of minutes', ...(cum ? ['Cumulative'] : [])];
  return h('details', { class: 'tbl-wrap' },
    h('summary', { text: 'Table' }),
    h('div', { class: 'tbl-scroll' },
      h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, head.map((x, i) => h('th', { scope: 'col', class: i ? 'num' : '', text: x })))),
        h('tbody', {}, blk.items.map(i => h('tr', {},
          h('th', { scope: 'row', text: nameOf(i) }),
          h('td', { class: 'num', text: fmt.int(i.touches) }),
          h('td', { class: 'num', text: fmt.dec(i.minutes, 2) }),
          h('td', { class: 'num', text: fmt.dec(i.opHours, 2) }),
          h('td', { class: 'num', text: fmt.pct(i.pct, 1) }),
          cum ? h('td', { class: 'num', text: fmt.pct(i.cum, 1) }) : null))),
        h('tfoot', {}, h('tr', {},
          h('th', { scope: 'row', text: 'Total' }),
          h('td', { class: 'num', text: fmt.int(blk.total.touches) }),
          h('td', { class: 'num', text: fmt.dec(blk.total.minutes, 2) }),
          h('td', { class: 'num', text: fmt.dec(blk.total.opHours, 2) }),
          h('td', { class: 'num', text: blk.total.minutes ? '100%' : '–' }),
          cum ? h('td') : null)))));
}

const CARD_ICON = { 'Which lever applies': 'layers', 'When in the shift': 'clock', 'By category': 'tag', 'By zone / equipment': 'pin', 'By person observed': 'users', 'Where × why: zone by category': 'grid', 'Types of touch': 'hand', 'Runs compared': 'history' };
function card(title, note, ...body) {
  return h('section', { class: 'card' }, h('h2', { class: 'card-h' }, CARD_ICON[title] ? icon(CARD_ICON[title]) : null, title), body, note ? infoNote(note) : null);
}

function tile(label, value, sub, ico) {
  return h('div', { class: 'tile' }, h('div', { class: 'tile-label' }, ico ? icon(ico) : null, label), h('div', { class: 'tile-val', text: value }), sub ? h('div', { class: 'tile-sub', text: sub }) : null);
}

function segBar(parts, { total, ariaLabel }) {
  const sum = total ?? parts.reduce((s, p) => s + p.value, 0);
  return h('div', { class: 'seg-bar', role: 'img', 'aria-label': ariaLabel },
    parts.filter(p => p.value > 0).map(p => {
      const share = sum ? p.value / sum : 0;
      const block = h('div', { class: 'seg-part' + (p.track ? ' track' : ''), style: { flexGrow: String(share), background: p.track ? '' : p.colour } },
        share >= 0.12 && p.inside !== false ? h('span', { class: 'seg-in', text: p.inside ?? fmt.pct(share) }) : null);
      block.addEventListener('pointerenter', () => showTip(block, p.lead ?? fmt.pct(share), [p.label]));
      block.addEventListener('pointerleave', hideTip);
      return block;
    }));
}

/** Sequential single-hue ramp (white → brand red → deep red) for magnitude. */
function ramp(t) {
  const stops = [[0, [255, 243, 243]], [0.35, [255, 168, 171]], [0.72, [244, 0, 9]], [1, [130, 0, 6]]];
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [p0, c0] = stops[i - 1], [p1, c1] = stops[i];
      const k = (t - p0) / (p1 - p0);
      return `rgb(${c0.map((c, j) => Math.round(c + (c1[j] - c) * k)).join(',')})`;
    }
  }
  return 'rgb(130,0,6)';
}
const inkOn = (t) => (t > 0.55 ? '#fff' : 'var(--ink)');

const catLabel = (i, rich) => {
  const c = CAT_BY_CODE[i.key];
  if (!c) return rich ? h('span', { class: 'bl' }, h('span', { class: 'code code-x', text: '?' }), h('span', { text: 'Not categorised' })) : 'Not categorised';
  return rich ? h('span', { class: 'bl' }, h('span', { class: 'code ' + (c.planned ? 'code-p' : 'code-u'), text: c.code }), h('span', { text: c.short })) : c.name;
};
const catColour = (i) => (CAT_BY_CODE[i.key] ? (CAT_BY_CODE[i.key].planned ? COLOUR.Planned : COLOUR.Unplanned) : COLOUR.none);

/* ---------- the four levers ---------- */
function leverMatrix(touches) {
  const cell = {};
  let total = 0;
  for (const t of touches) {
    if (!t.planned || !t.touchType) continue;
    const k = `${t.planned}|${t.touchType}`;
    cell[k] ??= { minutes: 0, touches: 0 };
    const m = totalMinutes(t);
    cell[k].minutes += m; cell[k].touches += Number(t.count) || 0; total += m;
  }
  const max = Math.max(...Object.values(cell).map(c => c.minutes), 0);
  const grid = h('div', { class: 'lever-grid' },
    h('div'),
    ['Physical', 'Information'].map(tt => h('div', { class: 'lever-col' }, h('span', { class: 'swatch', style: { background: COLOUR[tt] } }), tt)),
    ['Planned', 'Unplanned'].map(p => [
      h('div', { class: 'lever-row' }, h('span', { class: 'swatch', style: { background: COLOUR[p] } }), p),
      ['Physical', 'Information'].map(tt => {
        const k = `${p}|${tt}`;
        const c = cell[k] || { minutes: 0, touches: 0 };
        const share = max ? c.minutes / max : 0;
        const sel = F.planned || F.touchType ? ((F.planned === p || !F.planned) && (F.touchType === tt || !F.touchType) ? ' sel' : ' dimmed') : '';
        const el = h('div', { class: 'lever-cell' + sel, style: { background: ramp(share * 0.9), color: inkOn(share * 0.9) } },
          h('strong', { class: 'lever-min', text: `${fmtMin(c.minutes)} min` }),
          h('span', { class: 'lever-pct', text: `${fmt.pct(total ? c.minutes / total : null)} · ${fmt.int(c.touches)} touches` }),
          h('span', { class: 'lever-name', text: LEVER[k] }));
        return interactive(el, {
          lead: `${fmtMin(c.minutes)} min`, rest: [`${p} · ${tt}`, LEVER[k], `${fmt.int(c.touches)} touches · ${fmt.dec(c.minutes / 60, 2)} op-hours`],
          label: `${p} ${tt}: ${fmtMin(c.minutes)} minutes. ${LEVER[k]}.`,
          onPick: () => toggle({ planned: p, touchType: tt }),
        });
      }),
    ]));
  return card('Which lever applies', 'Planned touches are attacked by design and automation, unplanned by reliability; Physical touches by automation, Information touches by digitalisation. Tap a quadrant to filter.', grid);
}

/* ---------- when in the shift ---------- */
function timeline(touches) {
  const buckets = new Map();
  for (const t of touches) {
    const hr = hourOf(t);
    if (!hr) continue;
    const b = buckets.get(hr) || { Planned: 0, Unplanned: 0, none: 0, touches: 0 };
    const m = totalMinutes(t);
    if (t.planned === 'Planned' || t.planned === 'Unplanned') b[t.planned] += m; else b.none += m;
    b.touches += Number(t.count) || 0;
    buckets.set(hr, b);
  }
  if (!buckets.size) return card('When in the shift', null, h('p', { class: 'empty', text: 'No timed touches yet.' }));
  const keys = [...buckets.keys()].map(Number);
  const lo = Math.min(...keys), hi = Math.max(...keys);
  const hours = [];
  for (let x = lo; x <= hi; x++) hours.push(String(x).padStart(2, '0'));
  const totals = hours.map(k => { const b = buckets.get(k); return b ? b.Planned + b.Unplanned + b.none : 0; });
  const max = Math.max(...totals, 0);
  const niceMax = max <= 0 ? 1 : (() => { const p = 10 ** Math.floor(Math.log10(max)); return Math.ceil(max / p) * p; })();
  const peak = totals.indexOf(max);
  const cols = hours.map((k, idx) => {
    const b = buckets.get(k) || { Planned: 0, Unplanned: 0, none: 0, touches: 0 };
    const tot = totals[idx];
    const seg = (v, colour) => (v > 0 ? h('div', { class: 'tl-seg', style: { height: `${(v / niceMax) * 100}%`, background: colour } }) : null);
    const col = h('div', { class: 'tl-col' + selState('hour', k) },
      h('div', { class: 'tl-stack' },
        idx === peak && tot > 0 ? h('span', { class: 'tl-val', style: { bottom: `calc(${(tot / niceMax) * 100}% + 4px)` }, text: fmtMin(tot) }) : null,
        seg(b.Planned, COLOUR.Planned), seg(b.Unplanned, COLOUR.Unplanned), seg(b.none, COLOUR.none)),
      h('span', { class: 'tl-x', text: k }));
    return interactive(col, {
      lead: `${fmtMin(tot)} min`, rest: [`${k}:00–${k}:59`, `Planned ${fmtMin(b.Planned)} · Unplanned ${fmtMin(b.Unplanned)}`, `${fmt.int(b.touches)} touches`],
      label: `${k}:00: ${fmtMin(tot)} minutes`, onPick: tot > 0 ? () => toggle({ hour: k }) : null,
    });
  });
  const ticks = [niceMax, niceMax / 2, 0];
  return card('When in the shift', 'Mapped minutes by the hour each touch started, stacked by planned and unplanned. Tap an hour to filter.',
    legend([{ key: 'Planned', label: 'Planned', colour: COLOUR.Planned }, { key: 'Unplanned', label: 'Unplanned', colour: COLOUR.Unplanned }]),
    h('div', { class: 'tl' },
      h('div', { class: 'tl-y' }, ticks.map(t => h('span', { text: fmtMin(t) }))),
      h('div', { class: 'tl-plot' },
        h('div', { class: 'tl-grid' }, ticks.map(() => h('span'))),
        h('div', { class: 'tl-cols' }, cols))));
}

/* ---------- where × why ---------- */
function heatmap(touches) {
  const zoneMin = new Map(), cells = new Map(), catSeen = new Set();
  for (const t of touches) {
    if (!t.zone || !t.category) continue;
    const m = totalMinutes(t);
    zoneMin.set(t.zone, (zoneMin.get(t.zone) || 0) + m);
    const k = `${t.zone}\u0000${t.category}`;
    const c = cells.get(k) || { minutes: 0, touches: 0 };
    c.minutes += m; c.touches += Number(t.count) || 0;
    cells.set(k, c); catSeen.add(t.category);
  }
  if (!cells.size) return null;
  const zones = [...zoneMin.entries()].sort((a, b) => b[1] - a[1]).map(([z]) => z);
  const cats = CATEGORIES.filter(c => catSeen.has(c.code));
  const max = Math.max(...[...cells.values()].map(c => c.minutes));
  const grid = h('div', { class: 'hm', style: { gridTemplateColumns: `minmax(120px, max-content) repeat(${cats.length}, minmax(44px, 1fr))` } },
    h('div', { class: 'hm-corner' }),
    cats.map(c => h('div', { class: 'hm-col' + selState('category', c.code) }, h('span', { class: 'code ' + (c.planned ? 'code-p' : 'code-u'), text: c.code }))),
    zones.map(z => [
      h('div', { class: 'hm-row' + selState('zone', z), text: z }),
      cats.map(c => {
        const v = cells.get(`${z}\u0000${c.code}`);
        if (!v) return h('div', { class: 'hm-cell empty' });
        const t = v.minutes / max;
        const sel = F.zone || F.category ? ((F.zone === z || !F.zone) && (F.category === c.code || !F.category) ? ' sel' : ' dimmed') : '';
        const el = h('div', { class: 'hm-cell' + sel, style: { background: ramp(t), color: inkOn(t) } }, t >= 0.25 ? fmtMin(v.minutes) : '');
        return interactive(el, {
          lead: `${fmtMin(v.minutes)} min`, rest: [z, c.name, `${fmt.int(v.touches)} touches`],
          label: `${z}, ${c.code}: ${fmtMin(v.minutes)} minutes`, onPick: () => toggle({ zone: z, category: c.code }),
        });
      }),
    ]));
  return card('Where × why: zone by category', 'Darker = more minutes; the biggest cells carry their number. Tap a cell to filter by both.',
    h('div', { class: 'hm-scroll' }, grid),
    h('div', { class: 'ramp-legend' }, h('span', { text: 'Fewer minutes' }), h('span', { class: 'ramp-bar' }), h('span', { text: 'More' })));
}

/* ---------- types of touch, sortable ---------- */
function typesTable(touches) {
  const map = new Map();
  let total = 0;
  for (const t of touches) {
    const k = typeKey(t);
    if (!k) continue;
    const r = map.get(k) || { key: k, code: t.category, type: t.type, touches: 0, minutes: 0 };
    const m = totalMinutes(t);
    r.touches += Number(t.count) || 0; r.minutes += m; total += m;
    map.set(k, r);
  }
  const rows = [...map.values()].map(r => ({ ...r, avg: r.touches ? r.minutes / r.touches : 0, pct: total ? r.minutes / total : 0 }));
  const sorters = { minutes: (a, b) => b.minutes - a.minutes, touches: (a, b) => b.touches - a.touches, avg: (a, b) => b.avg - a.avg };
  rows.sort(sorters[UI.typeSort]);
  const shown = UI.typeAll ? rows : rows.slice(0, 12);
  const maxMin = Math.max(...rows.map(r => r.minutes), 0);
  const th = (key, text) => h('th', { scope: 'col', class: 'num', 'aria-sort': UI.typeSort === key ? 'descending' : 'none' },
    h('button', { type: 'button', class: 'sort' + (UI.typeSort === key ? ' on' : ''), onclick: () => { UI.typeSort = key; rerender(); } }, text, UI.typeSort === key ? ' ↓' : ''));
  return card('Types of touch', 'Sort by total minutes for the biggest prizes, by touches for the most frequent (automation candidates), or by minutes per touch for the longest single jobs. Tap a row to filter.',
    rows.length ? h('div', { class: 'tbl-scroll' },
      h('table', { class: 'tbl types-tbl' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Type of touch' }), th('touches', 'Touches'), th('avg', 'Min / touch'), th('minutes', 'Total min'), h('th', { scope: 'col', class: 'num', text: '%' }))),
        h('tbody', {}, shown.map(r => {
          const c = CAT_BY_CODE[r.code];
          const tr = h('tr', { class: 'pick-row' + selState('type', r.key) },
            h('th', { scope: 'row' }, h('span', { class: 'bl' }, h('span', { class: 'code ' + (c?.planned ? 'code-p' : 'code-u'), text: r.code }), h('span', { text: r.type }))),
            h('td', { class: 'num', text: fmt.int(r.touches) }),
            h('td', { class: 'num', text: fmt.dec(r.avg, 2) }),
            h('td', { class: 'num databar' }, h('span', { class: 'db', style: { width: `${maxMin ? (r.minutes / maxMin) * 100 : 0}%`, background: c?.planned ? COLOUR.Planned : COLOUR.Unplanned } }), h('span', { class: 'db-val', text: fmt.dec(r.minutes, 1) })),
            h('td', { class: 'num', text: fmt.pct(r.pct, 1) }));
          return interactive(tr, { lead: `${fmtMin(r.minutes)} min`, rest: [`${r.code} · ${r.type}`, `${fmt.int(r.touches)} touches · ${fmt.dec(r.avg, 2)} min each`], onPick: () => toggle({ type: r.key }) });
        })))) : h('p', { class: 'empty', text: 'No categorised touches yet.' }),
    rows.length > 12 ? h('button', { type: 'button', class: 'link-btn', onclick: () => { UI.typeAll = !UI.typeAll; rerender(); } }, UI.typeAll ? 'Show the top 12' : `Show all ${rows.length}`) : null);
}

/* ---------- filter bar ---------- */
function filterBar(sc) {
  const values = (dim) => [...new Set(sc.touches.map(t => DIMS[dim].get(t)).filter(Boolean))].sort();
  const select = (dim, opts, allLabel) => {
    const s = h('select', { 'aria-label': DIMS[dim]?.label || 'Run', class: F[dim] ? 'on' : '' },
      h('option', { value: '', text: allLabel }),
      opts.map(([v, t]) => h('option', { value: v, selected: F[dim] === v, text: t })));
    s.addEventListener('change', () => { F[dim] = s.value; rerender(); });
    return h('label', { class: 'filter' }, h('span', { text: DIMS[dim]?.label || 'Run' }), s);
  };
  const multi = F.runs.length > 1 || (F.runs.length === 1 && F.runs[0] !== state.activeRunId);
  const runBtn = h('button', { type: 'button', class: 'run-btn' + (multi ? ' on' : ''), onclick: runPicker },
    icon('history'), h('span', { text: sc.runs.length > 1 ? `${sc.runs.length} runs` : sc.runs[0].name }), icon('chevron'));

  const cats = values('category').sort((a, b) => CATEGORIES.findIndex(c => c.code === a) - CATEGORIES.findIndex(c => c.code === b));
  const show = (dim, list) => (list.length > 1 || F[dim]);
  const chips = ['run', 'type', 'hour'].filter(d => F[d]).map(d => h('button', { type: 'button', class: 'chip small on', onclick: () => { F[d] = ''; rerender(); } }, `${DIMS[d].label}: ${DIMS[d].name(F[d])}`, ' ✕'));
  const any = activeDims().length;
  const wide = window.matchMedia('(min-width: 760px)').matches;
  const box = h('details', { class: 'an-filters', open: wide || UI.filtersOpen || false },
    h('summary', { class: 'btn ghost small' }, icon('list'), any ? `Filters · ${any} on` : 'Filters'),
    h('div', { class: 'an-filter-row' },
      h('label', { class: 'filter' }, h('span', { text: 'Runs' }), runBtn),
      show('day', values('day')) ? select('day', values('day').map(v => [v, DIMS.day.name(v)]), 'All days') : null,
      show('observer', values('observer')) ? select('observer', values('observer').map(v => [v, v]), 'All observers') : null,
      select('planned', ['Planned', 'Unplanned'].map(v => [v, v]), 'Planned + unplanned'),
      show('category', cats) ? select('category', cats.map(v => [v, CAT_BY_CODE[v]?.name || v]), 'All categories') : null,
      show('zone', values('zone')) ? select('zone', values('zone').map(v => [v, v]), 'All zones') : null,
      select('touchType', ['Physical', 'Information'].map(v => [v, v]), 'Physical + information'),
      show('who', values('who')) ? select('who', values('who').map(v => [v, v]), 'Everyone') : null,
      chips,
      any ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => { for (const d of DIM_KEYS) F[d] = ''; rerender(); } }, icon('close'), 'Clear filters') : null));
  box.addEventListener('toggle', () => { if (!wide) UI.filtersOpen = box.open; });
  return box;
}

/* ---------- present mode ---------- */
function setPresent(on) {
  document.body.classList.toggle('present', on);
  try {
    if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  } catch { /* fullscreen not available: present mode still hides the chrome */ }
  rerender();
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('present')) setPresent(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('present')) setPresent(false); });
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#analysis')) document.body.classList.remove('present'); });

/* ---------- page ---------- */
export function renderInsights(root) {
  rootEl = root;
  const sc = scope();
  const all = filtered(sc.touches);
  const info = { operators: sc.capacity, shiftHours: 1, breakHours: 0, shifts: 1 };
  const a = analyse(all, info, state.lists);
  const hd = a.headline;
  const presenting = document.body.classList.contains('present');
  const filterNote = activeDims().map(d => (DIMS[d].name ? DIMS[d].name(F[d]) : F[d])).join(' · ');

  const head = h('div', { class: 'view-head' },
    h('div', {},
      h('h1', { class: 'view-title' }, icon('chart', 'title-ico'), 'Analysis'),
      h('p', { class: 'view-sub', text: `${sc.label}${filterNote ? ` · filtered: ${filterNote}` : ''}` })),
    h('button', { type: 'button', class: 'btn ' + (presenting ? 'primary' : 'ghost'), onclick: () => setPresent(!presenting) }, icon(presenting ? 'close' : 'chart'), presenting ? 'Exit presentation' : 'Present'));

  if (!sc.touches.length) {
    clear(root, h('section', { class: 'insights' }, head,
      h('div', { class: 'empty-state' }, icon('chart', 'big'),
        h('p', { text: 'The analysis fills itself as you log touches. Want to see it working first? Load the demo run from Setup → This device.' }),
        h('a', { class: 'btn ghost', href: '#setup' }, icon('gear'), 'Open Setup'))));
    return;
  }
  if (!all.length) {
    clear(root, h('section', { class: 'insights' }, head, filterBar(sc),
      h('div', { class: 'empty-state' }, icon('chart', 'big'), h('p', { text: 'No touches match these filters.' }),
        h('button', { type: 'button', class: 'btn primary', onclick: () => { for (const d of DIM_KEYS) F[d] = ''; rerender(); } }, 'Clear filters'))));
    return;
  }

  // Each chart ignores its own dimension, so the alternatives stay visible.
  const pBlk = analyse(filtered(sc.touches, ['planned']), info).byPlanned;
  const ttBlk = analyse(filtered(sc.touches, ['touchType']), info).byTouchType;
  const catA = analyse(filtered(sc.touches, ['category']), info, state.lists);
  const zoneA = analyse(filtered(sc.touches, ['zone']), info, state.lists);
  const whoA = analyse(filtered(sc.touches, ['who']), info, state.lists);

  // Coverage bar
  const over = hd.opHours > hd.capacity;
  const coverParts = [
    { label: 'Planned', value: hd.plannedHours, colour: COLOUR.Planned, lead: `${fmt.dec(hd.plannedHours)} op-hours`, inside: fmt.dec(hd.plannedHours) + ' h' },
    { label: 'Unplanned', value: hd.unplannedHours, colour: COLOUR.Unplanned, lead: `${fmt.dec(hd.unplannedHours)} op-hours`, inside: fmt.dec(hd.unplannedHours) + ' h' },
  ];
  const unsplit = hd.opHours - hd.plannedHours - hd.unplannedHours;
  if (unsplit > 0.0001) coverParts.push({ label: 'Not set', value: unsplit, colour: COLOUR.none, lead: `${fmt.dec(unsplit)} op-hours` });
  if (!over) coverParts.push({ label: 'Unexplained gap', value: hd.gap, track: true, lead: `${fmt.dec(hd.gap)} op-hours`, inside: false });

  // Donuts
  const pParts = splitParts(pBlk, ['Planned', 'Unplanned']);
  const pTotal = pParts.reduce((s, p) => s + p.value, 0);
  const plannedShare = pTotal ? (pParts.find(p => p.key === 'Planned')?.value || 0) / pTotal : null;
  const ttParts = splitParts(ttBlk, ['Physical', 'Information']);
  const ttTotal = ttParts.reduce((s, p) => s + p.value, 0);
  const physShare = ttTotal ? (ttParts.find(p => p.key === 'Physical')?.value || 0) / ttTotal : null;
  const ranked = catA.catPareto.filter(i => i.minutes > 0);
  const top5 = ranked.slice(0, 5);
  const restMin = ranked.slice(5).reduce((s, i) => s + i.minutes, 0);
  const catParts = [
    ...top5.map(i => ({ key: i.key, label: CAT_BY_CODE[i.key]?.name || i.key, value: i.minutes, colour: catColour(i), inside: i.key, rest: [`${fmt.int(i.touches)} touches`] })),
    ...(restMin > 0 ? [{ key: '', label: `Other ${ranked.length - 5} categories`, value: restMin, colour: COLOUR.none, inside: 'Other' }] : []),
  ];
  const catTotal = catParts.reduce((s, p) => s + p.value, 0);

  const catItems = UI.catOrder === 'pareto' ? catA.catPareto : catA.byCategory.items;
  const top3Codes = new Set(catA.top3.map(i => i.key));
  const zoneItems = [...zoneA.byZone.items].filter(i => i.rows > 0).sort((x, y) => y.minutes - x.minutes);
  const people = whoA.byPerson.items.filter(i => i.rows).sort((x, y) => y.minutes - x.minutes);

  clear(root, h('section', { class: 'insights' },
    head,
    filterBar(sc),
    a.incomplete ? h('a', { class: 'banner warn', href: '#log' }, icon('warn'), `${a.incomplete} ${a.incomplete === 1 ? 'touch is' : 'touches are'} not fully categorised and ${a.incomplete === 1 ? 'shows' : 'show'} as “not set”.`) : null,

    h('section', { class: 'card hero-card' },
      h('div', { class: 'hero' },
        h('div', {},
          h('div', { class: 'tile-label', text: 'Coverage vs reference frame' }),
          h('div', { class: 'hero-val', text: fmt.pct(hd.coverage) }),
          h('div', { class: 'tile-sub', text: `${fmt.dec(hd.opHours)} of ${fmt.dec(hd.capacity)} operator-hours mapped` })),
        h('div', { class: 'hero-bar' },
          segBar(coverParts, { total: Math.max(hd.capacity, hd.opHours), ariaLabel: `Planned ${fmt.dec(hd.plannedHours)} h, unplanned ${fmt.dec(hd.unplannedHours)} h, of ${fmt.dec(hd.capacity)} h reference capacity` }),
          h('div', { class: 'axis-ends' }, h('span', { text: '0' }), h('span', { text: `${fmt.dec(hd.capacity)} op-hours reference capacity` })),
          legend(coverParts.map(p => ({ label: `${p.label} · ${fmt.dec(p.value)} h`, colour: p.colour, track: p.track }))),
          over ? h('p', { class: 'warn-line' }, icon('warn'), 'Mapped hours exceed the reference capacity. Check the run’s reference frame in Runs: operators, shift length and shifts covered.') : null)),
      h('div', { class: 'tiles' },
        tile('Touches', fmt.int(hd.touchesLogged), `${a.rows} rows`, 'hand'),
        tile('Mapped minutes', fmt.int(hd.minutes), null, 'timer'),
        tile('Mapped op-hours', fmt.dec(hd.opHours), null, 'users'),
        tile('Reference', fmt.dec(hd.capacity), 'operator-hours', 'target'),
        tile('Gap', fmt.dec(hd.gap), 'operator-hours', 'gauge')),
      presenting ? null : infoNote(READING_COMPARISON, 'Reading the gap')),

    sc.runs.length > 1 ? runsCompared(sc) : null,

    h('div', { class: 'grid-3' },
      donutCard('Planned vs unplanned', NOTES.planned,
        donut({ parts: pParts, dim: 'planned', centre: fmt.pct(plannedShare), caption: 'planned', ariaLabel: 'Share of minutes, planned vs unplanned' }), pParts, 'planned'),
      donutCard('Physical vs information', 'Physical → automation; Information → digitalisation.',
        donut({ parts: ttParts, dim: 'touchType', centre: fmt.pct(physShare), caption: 'physical', ariaLabel: 'Share of minutes by touch type' }), ttParts, 'touchType'),
      donutCard('Where the minutes go', 'The five biggest categories; the rest folded into Other.',
        donut({ parts: catParts, dim: 'category', centre: fmt.int(catTotal), caption: 'minutes', ariaLabel: 'Share of minutes by category' }), catParts, 'category')),

    h('div', { class: 'grid-2' },
      leverMatrix(filtered(sc.touches, ['planned', 'touchType'])),
      timeline(filtered(sc.touches, ['hour']))),

    card('By category', null,
      h('div', { class: 'card-tools' },
        legend([{ label: 'Planned (P)', colour: COLOUR.Planned }, { label: 'Unplanned (U)', colour: COLOUR.Unplanned }]),
        h('div', { class: 'seg small', role: 'group', 'aria-label': 'Order' },
          [['pareto', 'Pareto'], ['framework', 'P1 → U7']].map(([k, t]) => h('button', {
            type: 'button', class: 'seg-btn' + (UI.catOrder === k ? ' on' : ''), 'aria-pressed': String(UI.catOrder === k),
            onclick: () => { UI.catOrder = k; rerender(); },
          }, t)))),
      catA.top3.length ? h('p', { class: 'callout' },
        h('strong', { text: `Top ${catA.top3.length} = ${fmt.pct(catA.top3Share)} of mapped minutes. ` }),
        catA.top3.map(i => CAT_BY_CODE[i.key]?.name).filter(Boolean).join(' · '),
        h('span', { class: 'muted', text: '. ' + NOTES.category })) : null,
      barList(catItems, { label: catLabel, colour: catColour, dim: 'category', highlight: i => UI.catOrder === 'pareto' && top3Codes.has(i.key) }),
      table('Category', { items: catItems, total: catA.byCategory.total }, i => catLabel(i), { cum: UI.catOrder === 'pareto' })),

    h('div', { class: 'grid-2' },
      card('By zone / equipment', NOTES.zone,
        zoneItems.length ? barList(zoneItems, { label: i => i.key, dim: 'zone' }) : h('p', { class: 'empty', text: 'No zones yet.' }),
        table('Zone / equipment', zoneA.byZone)),
      people.length ? card('By person observed', 'Optional field: only rows where the person was recorded.',
        barList(people, { label: i => i.key, dim: 'who' }), table('Person', { items: people, total: whoA.byPerson.total })) : null),

    heatmap(filtered(sc.touches, ['zone', 'category'])),
    typesTable(filtered(sc.touches, ['type'])),

    h('p', { class: 'foot-note' }, 'By elimination route is filled in the workshop and will appear here once routes are assigned. Every export already carries the route column, set to “To be decided”.')));

  requestAnimationFrame(() => {
    for (const s of root.querySelectorAll('.seg-in')) if (s.offsetWidth + 14 > s.parentElement.clientWidth) s.remove();
  });
}
