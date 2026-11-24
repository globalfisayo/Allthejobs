// Analytics: the template's Analysis sheet, made interactive for review and presenting.
// Every chart filters the whole page when tapped; each chart ignores its own filter so the
// other choices stay visible (the selected one is highlighted instead).
import { CAT_BY_CODE, CATEGORIES, NOTES } from './framework.js';
import { analyse, NOT_SET } from './analysis.js';
import { fmtMin, totalMinutes, runCapacity, observedMinutes } from './model.js';
import { state, activeRun, runsList } from './store.js';
import { h, clear, icon, fmt, infoNote, openModal, closeModal, fmtDuration } from './ui.js';
import { hbars, columns, catColumns, pareto as paretoChart, donut as donutChart, lines as linesChart, table as itemsTable, kindSwitch } from './charts.js';
import { annotationLayer } from './annotate.js';
import { processMapCard } from './linemap.js';
import { zoneColour } from './colors.js';
import { zoneIcon, personIcon, categoryIcon, plannedIcon, touchTypeIcon } from './iconmap.js';
import { markSetup, save } from './store.js';
import { isAdmin } from './auth.js';

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
const UI = { catOrder: 'pareto', typeSort: 'minutes', typeAll: false, filtersOpen: false, catLevel: 'categories', advanced: false };
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
  rows.sort((a, b) => String(a.days[0] || a.r.createdAt).localeCompare(String(b.days[0] || b.r.createdAt)));
  const max = Math.max(...rows.map(x => x.total), 0) || 1;
  const ctx = ctxFor('run');
  return chartCard('runs', 'Runs compared', 'history', {
    kinds: ['bars', 'columns', 'line', 'table'], def: 'bars',
    note: 'One entry per run, oldest first, with the other filters applied. Tap a run to look at it alone.',
    before: (kind) => (kind === 'table' ? null : legendRow()),
    render: (kind) => {
      if (kind === 'columns') return columns(rows.map(x => ({ key: x.r.id, label: x.r.name, short: x.r.name, rest: [`Coverage ${fmt.pct(x.cov)}`, `${fmt.int(x.touches)} touches`],
        segs: [{ value: x.planned, colour: COLOUR.Planned, label: 'Planned' }, { value: x.unplanned, colour: COLOUR.Unplanned, label: 'Unplanned' }] })), ctx, { xRotate: rows.length > 5 });
      if (kind === 'line') return linesChart(rows.map(x => ({ key: x.r.id, label: x.r.name, short: x.days[0] ? fmt.day(x.days[0] + 'T12:00:00') : x.r.name })), [
        { label: 'Planned', colour: COLOUR.Planned, values: rows.map(x => x.planned) },
        { label: 'Unplanned', colour: COLOUR.Unplanned, values: rows.map(x => x.unplanned) }], ctx);
      if (kind === 'table') return itemsTable(rows.map(x => ({ key: x.r.id, label: x.r.name, value: x.total, touches: x.touches })), { label: 'Run' });
      return h('div', { class: 'cmp' }, rows.map(x => {
      const el = h('div', { class: 'cmp-row' + selState('run', x.r.id) },
        h('div', { class: 'cmp-name' }, h('strong', { text: x.r.name }),
          h('span', { class: 'muted small' }, icon('calendar'), x.days.length ? fmt.day(x.days[0] + 'T12:00:00') : '–', ' ', icon('clock'), fmtDuration(x.obs))),
        h('div', { class: 'cmp-bar' },
          h('span', { style: { width: `${(x.planned / max) * 100}%`, background: COLOUR.Planned } }),
          h('span', { style: { width: `${(x.unplanned / max) * 100}%`, background: COLOUR.Unplanned } })),
        h('div', { class: 'cmp-val' }, h('strong', { text: `${fmtMin(x.total)} min` }), h('span', { class: 'muted small', text: `${fmt.pct(x.cov)} cov · ${fmt.int(x.touches)} t` })));
      return interactive(el, { lead: `${fmtMin(x.total)} min`, rest: [x.r.name, `Planned ${fmtMin(x.planned)} · Unplanned ${fmtMin(x.unplanned)}`, `Coverage ${fmt.pct(x.cov)}`], onPick: () => toggle({ run: x.r.id }) });
      }));
    },
  });
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
export function interactive(el, { lead, rest = [], onPick, label }) {
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

function splitParts(blk, order) {
  const items = blk.items.filter(i => i.minutes > 0);
  return [...order.filter(k => items.some(i => i.key === k)).map(k => items.find(i => i.key === k)), ...items.filter(i => !order.includes(i.key))]
    .map(i => ({ key: i.key === NOT_SET ? '' : i.key, label: i.key === NOT_SET ? 'Not set' : i.key, value: i.minutes, colour: COLOUR[i.key] || COLOUR.none, rest: [`${fmt.int(i.touches)} touches · ${fmt.dec(i.opHours, 1)} op-hours`] }));
}

const CARD_ICON = { 'Which lever applies': 'layers', 'When in the shift': 'clock', 'By category': 'tag', 'By zone / equipment': 'pin', 'By person observed': 'users', 'Where × why: zone by category': 'grid', 'Types of touch': 'hand', 'Runs compared': 'history' };
function card(title, note, ...body) {
  return h('section', { class: 'card' }, h('h2', { class: 'card-h' }, CARD_ICON[title] ? icon(CARD_ICON[title]) : null, title), body, note ? infoNote(note) : null);
}

function tile(label, value, sub, ico) {
  return h('div', { class: 'tile' }, h('div', { class: 'tile-label' }, ico ? icon(ico) : null, label), h('div', { class: 'tile-val', text: value }), sub ? h('div', { class: 'tile-sub', text: sub }) : null);
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
  return rich ? h('span', { class: 'bl' }, h('span', { class: 'code ' + (c.planned ? 'code-p' : 'code-u'), text: c.code }), icon(categoryIcon(c.code), 'lbl-ico'), h('span', { text: c.short })) : c.name;
};
const withIcon = (ico, text) => h('span', { class: 'bl' }, icon(ico, 'lbl-ico'), h('span', { text }));
const catColour = (i) => (CAT_BY_CODE[i.key] ? (CAT_BY_CODE[i.key].planned ? COLOUR.Planned : COLOUR.Unplanned) : COLOUR.none);


/* ---------- chart cards: switchable type, notes on top ---------- */
const ctxFor = (dim) => ({
  sel: (key) => (dim && key ? selState(dim, key) : ''),
  pick: dim ? (key) => toggle({ [dim]: key }) : null,
  tip: (el, lead, rest = [], onPick = null, label = null) => interactive(el, { lead, rest, onPick, label }),
});
function chartKind(id, kinds, def) {
  const mine = state.chartKindsMine?.[id];
  if (kinds.includes(mine)) return mine;
  const k = state.chartKinds?.[id];
  return kinds.includes(k) ? k : def;
}
/** An admin sets the team's chart types; anyone else's choice stays on their device. */
function setKind(id, k) {
  if (isAdmin()) { state.chartKinds = { ...(state.chartKinds || {}), [id]: k }; markSetup(); }
  else { state.chartKindsMine = { ...(state.chartKindsMine || {}), [id]: k }; save(); }
  rerender();
}
/** A card whose chart type can be switched and which can carry notes. */
function chartCard(id, title, ico, o) {
  const kinds = o.kinds || [];
  const kind = kinds.length ? chartKind(id, kinds, o.def || kinds[0]) : null;
  const body = h('div', { class: 'chart-body' }, o.render(kind));
  const cardEl = h('section', { class: 'card chart-card', 'data-chart': id });
  const ann = annotationLayer(cardEl, body, id);
  const before = o.before ? o.before(kind) : null;
  const after = o.after ? o.after(kind) : null;
  // native append() neither flattens lists nor skips empty slots: build the list here
  cardEl.append(...[
    h('div', { class: 'chart-head' },
      h('h2', { class: 'card-h' }, icon(ico), title),
      h('div', { class: 'chart-tools' }, kinds.length > 1 ? kindSwitch(kinds, kind, k => setKind(id, k)) : null, ann.button)),
    before ? h('div', { class: 'chart-before' }, before) : null,
    body,
    after ? h('div', { class: 'chart-after' }, after) : null,
    o.note ? infoNote(o.note) : null,
  ].filter(Boolean));
  return cardEl;
}
/** One renderer per kind for a list of items. */
function itemsChart(kind, items, dim, opts = {}) {
  const ctx = ctxFor(dim);
  if (!items.length || !items.some(i => i.value > 0)) return h('p', { class: 'empty', text: 'Nothing logged here yet.' });
  if (kind === 'donut') return donutChart(items, ctx, opts.donut || {});
  if (kind === 'columns') return catColumns(items, ctx);
  if (kind === 'pareto') return paretoChart(items, ctx, { label: opts.label || 'Item' });
  if (kind === 'table') return itemsTable(items, { label: opts.label || 'Item', cum: opts.cum });
  return hbars(items, ctx, { highlight: opts.highlight || (() => false) });
}
const toItems = (list, { label = i => i.key, short, rich, colour = () => COLOUR.single } = {}) => list.map(i => ({
  key: i.key === NOT_SET ? '' : i.key, label: i.key === NOT_SET ? 'Not set' : label(i), short: short ? short(i) : undefined, rich: rich ? rich(i) : undefined,
  value: i.minutes, touches: i.touches, pct: i.pct, colour: colour(i),
  rest: [`${fmt.int(i.touches)} touches · ${fmt.dec(i.opHours, 2)} op-hours`, i.cum != null ? `cumulative ${fmt.pct(i.cum)}` : null].filter(Boolean),
}));

/* ---------- when in the shift ---------- */
function shiftCard(touches) {
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
  const keys = [...buckets.keys()].map(Number);
  const hours = [];
  if (keys.length) for (let x = Math.min(...keys); x <= Math.max(...keys); x++) hours.push(String(x).padStart(2, '0'));
  const rows = hours.map(k => ({ k, ...(buckets.get(k) || { Planned: 0, Unplanned: 0, none: 0, touches: 0 }) }));
  return chartCard('shift', 'When in the shift', 'clock', {
    kinds: ['columns', 'line', 'table'], def: 'columns',
    note: 'Mapped minutes by the hour each touch started. Tap an hour to filter.',
    before: (kind) => (kind === 'table' ? null : legendRow()),
    render: (kind) => {
      if (!rows.length) return h('p', { class: 'empty', text: 'No timed touches yet.' });
      const ctx = ctxFor('hour');
      const cols = rows.map(r => ({ key: r.k, label: `${r.k}:00–${r.k}:59`, short: r.k, rest: [`${fmt.int(r.touches)} touches`],
        segs: [{ value: r.Planned, colour: COLOUR.Planned, label: 'Planned' }, { value: r.Unplanned, colour: COLOUR.Unplanned, label: 'Unplanned' }, { value: r.none, colour: COLOUR.none, label: 'Not set' }] }));
      if (kind === 'line') return linesChart(rows.map(r => ({ key: r.k, label: `${r.k}:00`, short: r.k })), [
        { label: 'Planned', colour: COLOUR.Planned, values: rows.map(r => r.Planned) },
        { label: 'Unplanned', colour: COLOUR.Unplanned, values: rows.map(r => r.Unplanned) }], ctx);
      if (kind === 'table') return itemsTable(rows.map(r => ({ key: r.k, label: `${r.k}:00–${r.k}:59`, value: r.Planned + r.Unplanned + r.none, touches: r.touches })), { label: 'Hour' });
      return columns(cols, ctx);
    },
  });
}

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
  return chartCard('lever', 'Which lever applies', 'layers', { note: 'Planned touches are attacked by design and automation, unplanned by reliability; Physical touches by automation, Information touches by digitalisation. Tap a quadrant to filter.', render: () => grid });
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
  return chartCard('heatmap', 'Where × why: zone by category', 'grid', { note: 'Darker = more minutes; the biggest cells carry their number. Tap a cell to filter by both.', render: () => h('div', {},
    h('div', { class: 'hm-scroll' }, grid),
    h('div', { class: 'ramp-legend' }, h('span', { text: 'Fewer minutes' }), h('span', { class: 'ramp-bar' }), h('span', { text: 'More' }))) });
}

/* ---------- types of touch, sortable ---------- */

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
      any ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => { for (const d of DIM_KEYS) F[d] = ''; rerender(); } }, icon('close'), 'Clear filters') : null,
      advancedBtn('adv-desk')));
  box.addEventListener('toggle', () => { if (!wide) UI.filtersOpen = box.open; });
  return box;
}

/** Advanced charts: the lever matrix, the shift, zones, people and where × why, on demand. */
function advancedBtn(cls) {
  return h('button', { type: 'button', class: 'btn small adv-btn ' + cls + (UI.advanced ? ' primary' : ' ghost'), 'aria-pressed': String(UI.advanced),
    onclick: () => { UI.advanced = !UI.advanced; rerender(); if (UI.advanced) requestAnimationFrame(() => rootEl?.querySelector('.advanced')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); } },
  icon('chart-no-axes-combined'), UI.advanced ? 'Hide advanced charts' : 'Advanced charts');
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
    h('div', { class: 'an-head-acts' },
      h('button', { type: 'button', class: 'btn ' + (presenting ? 'primary' : 'ghost'), onclick: () => setPresent(!presenting) }, icon(presenting ? 'close' : 'presentation'), presenting ? 'Exit presentation' : 'Present'),
      advancedBtn('adv-mob')));

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

  // Donuts
  const pParts = splitParts(pBlk, ['Planned', 'Unplanned']);
  const pTotal = pParts.reduce((s, p) => s + p.value, 0);
  const plannedShare = pTotal ? (pParts.find(p => p.key === 'Planned')?.value || 0) / pTotal : null;
  const ttParts = splitParts(ttBlk, ['Physical', 'Information']);
  const ttTotal = ttParts.reduce((s, p) => s + p.value, 0);
  const physShare = ttTotal ? (ttParts.find(p => p.key === 'Physical')?.value || 0) / ttTotal : null;
  const catItems = UI.catOrder === 'pareto' ? catA.catPareto : catA.byCategory.items;
  const top3Codes = new Set(catA.top3.map(i => i.key));
  const zoneItems = [...zoneA.byZone.items].filter(i => i.rows > 0).sort((x, y) => y.minutes - x.minutes);
  const people = whoA.byPerson.items.filter(i => i.rows).sort((x, y) => y.minutes - x.minutes);

  // By category, or opened up into every type of touch (biggest first)
  const typeA = analyse(filtered(sc.touches, ['category', 'type']), info, state.lists);
  const typeRows = [...typeA.byType.items].sort((x, y) => y.minutes - x.minutes);
  const typeItems = typeRows.map(r => {
    const c = CAT_BY_CODE[r.code];
    return { key: r.key, label: `${r.code} · ${r.type}`, short: r.code, rich: h('span', { class: 'bl' }, h('span', { class: 'code ' + (c?.planned ? 'code-p' : 'code-u'), text: r.code }), icon(categoryIcon(r.code), 'lbl-ico'), h('span', { text: r.type })),
      value: r.minutes, touches: r.touches, pct: r.pct, colour: c?.planned ? COLOUR.Planned : COLOUR.Unplanned, rest: [`${fmt.int(r.touches)} touches · ${CAT_BY_CODE[r.code]?.name || r.code}`] };
  });
  const expanded = UI.catLevel === 'types';

  clear(root, h('section', { class: 'insights' },
    head,
    filterBar(sc),
    a.incomplete ? h('a', { class: 'banner warn', href: '#log' }, icon('warn'), `${a.incomplete} ${a.incomplete === 1 ? 'touch is' : 'touches are'} not fully categorised and ${a.incomplete === 1 ? 'shows' : 'show'} as “not set”.`) : null,

    h('div', { class: 'tiles an-tiles' },
      tile('Touches', fmt.int(hd.touchesLogged), `${a.rows} rows`, 'hand'),
      tile('Mapped minutes', fmt.int(hd.minutes), null, 'timer'),
      tile('Mapped op-hours', fmt.dec(hd.opHours), null, 'users')),

    processMapCard({ touches: filtered(sc.touches, ['zone']), planned: F.planned, onPlanned: (v) => { F.planned = v; rerender(); }, onFilterZone: (z) => { F.zone = z; rerender(); } }),

    h('div', { class: 'grid-2' },
      chartCard('planned', 'Planned vs unplanned', 'layers', {
        kinds: ['donut', 'bars', 'columns', 'table'], def: 'donut', note: NOTES.planned,
        render: (kind) => itemsChart(kind, toItems(pBlk.items.filter(i => i.minutes > 0), { colour: i => COLOUR[i.key] || COLOUR.none, rich: i => withIcon(plannedIcon(i.key), i.key === NOT_SET ? 'Not set' : i.key) }), 'planned',
          { label: 'Split', donut: { centre: fmt.pct(plannedShare), caption: 'planned', ariaLabel: 'Share of minutes, planned vs unplanned' } }),
      }),
      chartCard('touchType', 'Physical vs information', 'hand', {
        kinds: ['donut', 'bars', 'columns', 'table'], def: 'donut', note: 'Physical → automation; Information → digitalisation.',
        render: (kind) => itemsChart(kind, toItems(ttBlk.items.filter(i => i.minutes > 0), { colour: i => COLOUR[i.key] || COLOUR.none, rich: i => withIcon(touchTypeIcon(i.key), i.key === NOT_SET ? 'Not set' : i.key) }), 'touchType',
          { label: 'Touch type', donut: { centre: fmt.pct(physShare), caption: 'physical', ariaLabel: 'Share of minutes by touch type' } }),
      })),

    chartCard('category', 'By category', 'tag', {
      kinds: ['pareto', 'bars', 'columns', 'donut', 'table'], def: 'pareto', note: expanded ? 'Every type of touch, biggest first. Tap one to filter the page.' : NOTES.category,
      before: (kind) => [
        h('div', { class: 'card-tools' },
          // tapping Planned or Unplanned filters the page to it
          legend([{ key: 'Planned', label: 'Planned (P)', colour: COLOUR.Planned }, { key: 'Unplanned', label: 'Unplanned (U)', colour: COLOUR.Unplanned }], { dim: 'planned' }),
          h('div', { class: 'row-gap' },
            h('div', { class: 'seg small', role: 'group', 'aria-label': 'Detail' },
              [['categories', 'Categories', 'chevrons-down-up'], ['types', 'All types', 'chevrons-up-down']].map(([k, t, ico]) => h('button', {
                type: 'button', class: 'seg-btn' + (UI.catLevel === k ? ' on' : ''), 'aria-pressed': String(UI.catLevel === k), title: k === 'types' ? 'Expand: every type of touch, like P1 Parts change' : 'Collapse to the categories',
                onclick: () => { UI.catLevel = k; rerender(); },
              }, icon(ico), t))),
            !expanded && (kind === 'bars' || kind === 'columns' || kind === 'table') ? h('div', { class: 'seg small', role: 'group', 'aria-label': 'Order' },
              [['pareto', 'Biggest first'], ['framework', 'P1 → U7']].map(([k, t]) => h('button', {
                type: 'button', class: 'seg-btn' + (UI.catOrder === k ? ' on' : ''), 'aria-pressed': String(UI.catOrder === k),
                onclick: () => { UI.catOrder = k; rerender(); },
              }, t))) : null)),
        !expanded && catA.top3.length ? h('p', { class: 'callout' },
          h('strong', { text: `Top ${catA.top3.length} = ${fmt.pct(catA.top3Share)} of mapped minutes. ` }),
          catA.top3.map(i => CAT_BY_CODE[i.key]?.name).filter(Boolean).join(' · ')) : null],
      render: (kind) => (expanded
        ? itemsChart(kind, kind === 'table' ? typeItems : typeItems.slice(0, kind === 'donut' ? 12 : 25), 'type', { label: 'Type of touch', cum: true })
        : itemsChart(kind, toItems(catItems, { label: i => CAT_BY_CODE[i.key]?.name || 'Not categorised', short: i => i.key, rich: i => catLabel(i, true), colour: catColour }), 'category',
          { label: 'Category', cum: UI.catOrder === 'pareto', highlight: i => UI.catOrder === 'pareto' && top3Codes.has(i.key) })),
    }),

    UI.advanced ? h('section', { class: 'advanced', 'aria-label': 'Advanced charts' },
      h('div', { class: 'adv-head' }, h('h2', {}, icon('chart-no-axes-combined'), 'Advanced charts'),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => { UI.advanced = false; rerender(); } }, icon('close'), 'Hide')),
      sc.runs.length > 1 ? runsCompared(sc) : null,
      h('div', { class: 'grid-2' },
        leverMatrix(filtered(sc.touches, ['planned', 'touchType'])),
        shiftCard(filtered(sc.touches, ['hour']))),
      h('div', { class: 'grid-2' },
        chartCard('zone', 'By zone / equipment', 'pin', {
          kinds: ['bars', 'columns', 'pareto', 'donut', 'table'], def: 'bars', note: NOTES.zone,
          render: (kind) => itemsChart(kind, toItems(zoneItems, { colour: i => zoneColour(i.key) || COLOUR.single, rich: i => withIcon(zoneIcon(i.key), i.key === NOT_SET ? 'Not set' : i.key) }), 'zone', { label: 'Zone / equipment' }),
        }),
        people.length ? chartCard('person', 'By person observed', 'users', {
          kinds: ['bars', 'columns', 'donut', 'table'], def: 'bars', note: 'Optional field: only rows where the person was recorded.',
          render: (kind) => itemsChart(kind, toItems(people, { rich: i => withIcon(personIcon(i.key), i.key === NOT_SET ? 'Not set' : i.key) }), 'who', { label: 'Person' }),
        }) : null),
      heatmap(filtered(sc.touches, ['zone', 'category']))) : null,

    h('p', { class: 'foot-note' }, 'By elimination route is filled in the workshop and will appear here once routes are assigned. Every export already carries the route column, set to “To be decided”.')));

  requestAnimationFrame(() => {
    for (const s of root.querySelectorAll('.seg-in')) if (s.offsetWidth + 14 > s.parentElement.clientWidth) s.remove();
  });
}
