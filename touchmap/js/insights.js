// Analytics: the template's Analysis sheet as charts, each with its table behind it.
import { CAT_BY_CODE, NOTES, READING_COMPARISON } from './framework.js';
import { analyse, NOT_SET } from './analysis.js';
import { fmtMin } from './model.js';
import { state, activeRun } from './store.js';
import { h, clear, icon, fmt } from './ui.js';

const view = { catOrder: 'pareto', day: '', observer: '' };
const C = { planned: 'var(--c-planned)', unplanned: 'var(--c-unplanned)', single: 'var(--c-single)' };

let tipEl = null;
function tooltip() {
  if (!tipEl) { tipEl = h('div', { class: 'tip', role: 'tooltip', hidden: true }); document.body.append(tipEl); }
  return tipEl;
}
function showTip(target, lead, rest) {
  const t = tooltip();
  clear(t, h('strong', { text: lead }), rest.map(r => h('span', { text: r })));
  t.hidden = false;
  const r = target.getBoundingClientRect();
  const w = t.offsetWidth, hh = t.offsetHeight;
  let x = r.left + r.width / 2 - w / 2;
  x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
  let y = r.top - hh - 8;
  if (y < 8) y = r.bottom + 8;
  t.style.transform = `translate(${Math.round(x)}px, ${Math.round(y + window.scrollY)}px)`;
}
function hideTip() { if (tipEl) tipEl.hidden = true; }
window.addEventListener('scroll', hideTip, { passive: true });

function hoverable(el, lead, rest) {
  el.tabIndex = 0;
  el.addEventListener('pointerenter', () => showTip(el, lead, rest));
  el.addEventListener('pointerleave', hideTip);
  el.addEventListener('focus', () => showTip(el, lead, rest));
  el.addEventListener('blur', hideTip);
  return el;
}

/** Horizontal bars, one series: value at the tip, details on hover and in the table. */
function barList(items, { label, colour = () => C.single, sub, highlight = () => false }) {
  const max = Math.max(...items.map(i => i.minutes), 0);
  return h('div', { class: 'bars' }, items.map(i => {
    const w = max ? (i.minutes / max) * 100 : 0;
    const row = h('div', { class: 'bar-row' + (highlight(i) ? ' hi' : ''), 'aria-label': `${label(i)}: ${fmtMin(i.minutes)} minutes, ${fmt.int(i.touches)} touches, ${fmt.pct(i.pct)} of minutes` },
      h('div', { class: 'bar-label' }, label(i, true)),
      h('div', { class: 'bar-track' },
        h('div', { class: 'bar', style: { width: `max(${i.minutes > 0 ? '3px' : '0px'}, calc((100% - 112px) * ${(w / 100).toFixed(4)}))`, background: colour(i) } }),
        h('span', { class: 'bar-val' }, h('strong', { text: fmtMin(i.minutes) }), ' min', h('span', { class: 'bar-pct', text: ` · ${fmt.pct(i.pct)}` }))));
    return hoverable(row, `${fmtMin(i.minutes)} min`, [label(i), `${fmt.int(i.touches)} touches · ${fmt.dec(i.opHours, 2)} op-hours`, `${fmt.pct(i.pct, 1)} of minutes${i.cum != null ? ` · cumulative ${fmt.pct(i.cum)}` : ''}`, sub?.(i)].filter(Boolean));
  }));
}

/** One whole split into parts: a tall segmented bar, share printed inside when it fits. */
function segBar(parts, { total, ariaLabel }) {
  const sum = total ?? parts.reduce((s, p) => s + p.value, 0);
  const bar = h('div', { class: 'seg-bar', role: 'img', 'aria-label': ariaLabel },
    parts.filter(p => p.value > 0).map(p => {
      const share = sum ? p.value / sum : 0;
      const block = h('div', { class: 'seg-part' + (p.track ? ' track' : ''), style: { flexGrow: String(share), background: p.track ? '' : p.colour } },
        share >= 0.12 && p.inside !== false ? h('span', { class: 'seg-in', text: p.inside ?? fmt.pct(share) }) : null);
      return hoverable(block, p.lead ?? fmt.pct(share), [p.label, ...(p.rest || [])]);
    }));
  return bar;
}

function legend(items) {
  return h('ul', { class: 'legend' }, items.map(i => h('li', {}, h('span', { class: 'swatch' + (i.track ? ' track' : ''), style: { background: i.track ? '' : i.colour } }), h('span', { text: i.label }))));
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

function card(title, note, ...body) {
  return h('section', { class: 'card' },
    h('h2', { class: 'card-h', text: title }),
    body,
    note ? h('p', { class: 'card-note', text: note }) : null);
}

function tile(label, value, sub) {
  return h('div', { class: 'tile' }, h('div', { class: 'tile-label', text: label }), h('div', { class: 'tile-val', text: value }), sub ? h('div', { class: 'tile-sub', text: sub }) : null);
}

const catLabel = (i, rich) => {
  const c = CAT_BY_CODE[i.key];
  if (!c) return rich ? h('span', { class: 'bl' }, h('span', { class: 'code code-x', text: '?' }), h('span', { text: 'Not categorised' })) : 'Not categorised';
  return rich ? h('span', { class: 'bl' }, h('span', { class: 'code ' + (c.planned ? 'code-p' : 'code-u'), text: c.code }), h('span', { text: c.short })) : c.name;
};
const catColour = (i) => (CAT_BY_CODE[i.key]?.planned === false ? C.unplanned : CAT_BY_CODE[i.key] ? C.planned : 'var(--c-none)');

export function renderInsights(root) {
  const run = activeRun();
  const days = [...new Set(run.touches.map(t => fmt.dayKey(t.start || t.createdAt)).filter(Boolean))].sort();
  const observers = [...new Set(run.touches.map(t => t.observer).filter(Boolean))].sort();
  if (view.day && !days.includes(view.day)) view.day = '';
  if (view.observer && !observers.includes(view.observer)) view.observer = '';
  const touches = run.touches.filter(t =>
    (!view.day || fmt.dayKey(t.start || t.createdAt) === view.day) && (!view.observer || t.observer === view.observer));
  const a = analyse(touches, run.info, state.lists);
  const hd = a.headline;

  const select = (label, value, options, onPick) => h('label', { class: 'filter' },
    h('span', { text: label }),
    h('select', { onchange: (e) => { onPick(e.target.value); renderInsights(root); } },
      options.map(([v, t]) => h('option', { value: v, selected: v === value, text: t }))));

  const filterRow = (days.length > 1 || observers.length > 1) ? h('div', { class: 'filter-row' },
    days.length > 1 ? select('Day', view.day, [['', 'All days'], ...days.map(d => [d, fmt.day(d + 'T12:00:00')])], v => { view.day = v; }) : null,
    observers.length > 1 ? select('Observer', view.observer, [['', 'All observers'], ...observers.map(o => [o, o])], v => { view.observer = v; }) : null) : null;

  if (!touches.length) {
    clear(root, h('section', { class: 'insights' },
      h('div', { class: 'view-head' }, h('div', {}, h('h1', { class: 'view-title', text: 'Analysis' }), h('p', { class: 'view-sub', text: run.name }))),
      filterRow,
      h('div', { class: 'empty-state' }, icon('chart', 'big'),
        h('p', { text: 'The analysis fills itself as you log touches. Want to see it working first? Load the demo run from the Run tab.' }),
        h('a', { class: 'btn ghost', href: '#run' }, icon('run'), 'Open Run'))));
    return;
  }

  // Coverage: one bar the length of the reference capacity.
  const over = hd.opHours > hd.capacity;
  const scale = Math.max(hd.capacity, hd.opHours);
  const coverParts = [
    { label: 'Planned', value: hd.plannedHours, colour: C.planned, lead: `${fmt.dec(hd.plannedHours)} op-hours`, inside: fmt.dec(hd.plannedHours) + ' h' },
    { label: 'Unplanned', value: hd.unplannedHours, colour: C.unplanned, lead: `${fmt.dec(hd.unplannedHours)} op-hours`, inside: fmt.dec(hd.unplannedHours) + ' h' },
  ];
  const unsplit = hd.opHours - hd.plannedHours - hd.unplannedHours;
  if (unsplit > 0.0001) coverParts.push({ label: 'Planned / unplanned not set', value: unsplit, colour: 'var(--c-none)', lead: `${fmt.dec(unsplit)} op-hours` });
  if (!over) coverParts.push({ label: 'Unexplained gap', value: hd.gap, track: true, lead: `${fmt.dec(hd.gap)} op-hours`, inside: false });

  const plannedItems = a.byPlanned.items.filter(i => i.key !== NOT_SET);
  const catItems = view.catOrder === 'pareto' ? a.catPareto : a.byCategory.items;
  const top3Codes = new Set(a.top3.map(i => i.key));
  const zoneItems = [...a.byZone.items].filter(i => i.rows > 0).sort((x, y) => y.minutes - x.minutes);

  clear(root, h('section', { class: 'insights' },
    h('div', { class: 'view-head' }, h('div', {},
      h('h1', { class: 'view-title', text: 'Analysis' }),
      h('p', { class: 'view-sub', text: `${run.name} · updates itself as the log fills` + (view.day || view.observer ? ' · filtered' : '') }))),
    filterRow,
    a.incomplete ? h('a', { class: 'banner warn', href: '#log' }, icon('warn'), `${a.incomplete} ${a.incomplete === 1 ? 'touch is' : 'touches are'} not fully categorised and ${a.incomplete === 1 ? 'shows' : 'show'} as “not set” below.`) : null,

    h('section', { class: 'card hero-card' },
      h('div', { class: 'hero' },
        h('div', {},
          h('div', { class: 'tile-label', text: 'Coverage vs reference frame' }),
          h('div', { class: 'hero-val', text: fmt.pct(hd.coverage) }),
          h('div', { class: 'tile-sub', text: `${fmt.dec(hd.opHours)} of ${fmt.dec(hd.capacity)} operator-hours mapped` })),
        h('div', { class: 'hero-bar' },
          segBar(coverParts, { total: scale, ariaLabel: `Planned ${fmt.dec(hd.plannedHours)} h, unplanned ${fmt.dec(hd.unplannedHours)} h, of ${fmt.dec(hd.capacity)} h reference capacity` }),
          h('div', { class: 'axis-ends' }, h('span', { text: '0' }), h('span', { text: `${fmt.dec(hd.capacity)} op-hours reference capacity` })),
          legend(coverParts.map(p => ({ label: `${p.label} · ${fmt.dec(p.value)} h`, colour: p.colour, track: p.track }))),
          over ? h('p', { class: 'warn-line' }, icon('warn'), 'Mapped hours exceed the reference capacity. Check the Run tab: operators, shift length and shifts covered.') : null)),
      h('div', { class: 'tiles' },
        tile('Touches logged', fmt.int(hd.touchesLogged), `${a.rows} rows`),
        tile('Mapped minutes', fmt.int(hd.minutes)),
        tile('Mapped op-hours', fmt.dec(hd.opHours)),
        tile('Reference capacity', fmt.dec(hd.capacity), 'operator-hours'),
        tile('Unexplained gap', fmt.dec(hd.gap), 'operator-hours')),
      h('p', { class: 'card-note', text: READING_COMPARISON })),

    h('div', { class: 'grid-2' },
      card('Planned vs unplanned', NOTES.planned,
        segBar(plannedItems.map(i => ({ label: i.key, value: i.minutes, colour: i.key === 'Planned' ? C.planned : C.unplanned, lead: `${fmtMin(i.minutes)} min`, rest: [`${fmt.int(i.touches)} touches · ${fmt.dec(i.opHours, 2)} op-hours`] })),
          { ariaLabel: plannedItems.map(i => `${i.key} ${fmt.pct(i.pct)}`).join(', ') }),
        legend(plannedItems.map(i => ({ label: `${i.key} · ${fmtMin(i.minutes)} min · ${fmt.int(i.touches)} touches`, colour: i.key === 'Planned' ? C.planned : C.unplanned }))),
        table('Split', a.byPlanned)),
      card('By touch type: which lever applies', NOTES.touchType,
        barList(a.byTouchType.items, { label: i => i.key }),
        table('Touch type', a.byTouchType))),

    card('By category', null,
      h('div', { class: 'card-tools' },
        legend([{ label: 'Planned (P)', colour: C.planned }, { label: 'Unplanned (U)', colour: C.unplanned }]),
        h('div', { class: 'seg small', role: 'group', 'aria-label': 'Order' },
          [['pareto', 'Pareto'], ['framework', 'P1 → U7']].map(([k, t]) => h('button', {
            type: 'button', class: 'seg-btn' + (view.catOrder === k ? ' on' : ''), 'aria-pressed': String(view.catOrder === k),
            onclick: () => { view.catOrder = k; renderInsights(root); },
          }, t)))),
      a.top3.length ? h('p', { class: 'callout' },
        h('strong', { text: `Top ${a.top3.length} = ${fmt.pct(a.top3Share)} of mapped minutes. ` }),
        a.top3.map(i => CAT_BY_CODE[i.key]?.name).filter(Boolean).join(' · '),
        h('span', { class: 'muted', text: '. ' + NOTES.category })) : null,
      barList(catItems, { label: catLabel, colour: catColour, highlight: i => view.catOrder === 'pareto' && top3Codes.has(i.key) }),
      table('Category', { items: catItems, total: a.byCategory.total }, i => catLabel(i), { cum: view.catOrder === 'pareto' })),

    h('div', { class: 'grid-2' },
      card('By zone / equipment', NOTES.zone,
        zoneItems.length ? barList(zoneItems, { label: i => i.key }) : h('p', { class: 'empty', text: 'No zones yet.' }),
        table('Zone / equipment', a.byZone)),
      card('Top types of touch', NOTES.types,
        legend([{ label: 'Planned', colour: C.planned }, { label: 'Unplanned', colour: C.unplanned }]),
        barList(a.topTypes, {
          label: (i, rich) => rich ? h('span', { class: 'bl' }, h('span', { class: 'code ' + (i.planned ? 'code-p' : 'code-u'), text: i.code }), h('span', { text: i.type })) : `${i.code} · ${i.type}`,
          colour: i => (i.planned ? C.planned : C.unplanned),
        }),
        table('Type of touch', { items: a.topTypes, total: { touches: a.topTypes.reduce((s, i) => s + i.touches, 0), minutes: a.topTypes.reduce((s, i) => s + i.minutes, 0), opHours: a.topTypes.reduce((s, i) => s + i.opHours, 0) } }, i => `${i.code} · ${i.type}`))),

    a.byPerson.items.some(i => i.rows) ? card('By person observed', 'Optional field: only rows where the person was recorded.',
      barList(a.byPerson.items.filter(i => i.rows).sort((x, y) => y.minutes - x.minutes), { label: i => i.key }),
      table('Person', a.byPerson)) : null,

    h('p', { class: 'foot-note' }, 'By elimination route is filled in the workshop and will appear here once routes are assigned. Every export already carries the route column, set to “To be decided”.')));

  // A label that does not fit inside its segment is dropped (legend, tooltip and table keep it).
  requestAnimationFrame(() => {
    for (const s of root.querySelectorAll('.seg-in')) {
      if (s.offsetWidth + 14 > s.parentElement.clientWidth) s.remove();
    }
  });
}
