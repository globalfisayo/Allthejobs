// The Pareto list, with columns you choose. Each row can show the code chip (P1 … U8), the
// category's icon, the category, the type of touch and the bar; any of them can be hidden or
// dragged into another order, and the bar carries %, minutes and/or touches.
// A user's choice stays on their device; an admin's becomes the team's default (Setup sync).
import { h, clear, icon, fmt, openModal, closeModal } from './ui.js';
import { fmtMin } from './model.js';
import { state, save, markSetup } from './store.js';
import { isAdmin } from './auth.js';
import { sortable } from './sortable.js';

export const COLS = {
  code: { label: 'Code', desc: 'The P1 … U8 chip' },
  icon: { label: 'Icon', desc: 'The category’s icon' },
  category: { label: 'Category', desc: 'The category’s name' },
  type: { label: 'Type of touch', desc: 'The type of touch (for a category: its biggest one)' },
  bar: { label: 'Bar', desc: 'The bar, with the numbers chosen below' },
};
export const VALUES = {
  pct: { label: '%', long: 'Percentage' },
  minutes: { label: 'Minutes', long: 'Time in minutes' },
  touches: { label: 'Touches', long: 'Number of touches' },
};
export const DEFAULT_COLS = Object.freeze({ order: ['code', 'icon', 'category', 'type', 'bar'], hidden: [], values: ['minutes', 'pct'] });

/** Any stored shape → a complete, valid column choice. */
export function normaliseCols(c) {
  const known = Object.keys(COLS);
  const order = Array.isArray(c?.order) ? c.order.filter(k => known.includes(k)) : [];
  for (const k of DEFAULT_COLS.order) if (!order.includes(k)) order.push(k);
  const hidden = Array.isArray(c?.hidden) ? [...new Set(c.hidden.filter(k => known.includes(k)))] : [];
  const values = Array.isArray(c?.values) ? Object.keys(VALUES).filter(k => c.values.includes(k)) : [...DEFAULT_COLS.values];
  return { order: [...new Set(order)], hidden, values };
}
/** Mine, else the team's, else the default. */
export function colsFor(id) {
  return normaliseCols(state.chartColsMine?.[id] || state.chartCols?.[id] || DEFAULT_COLS);
}
export function setCols(id, cfg) {
  const c = normaliseCols(cfg);
  if (isAdmin()) {
    state.chartCols = { ...(state.chartCols || {}), [id]: c };
    if (state.chartColsMine?.[id]) { const m = { ...state.chartColsMine }; delete m[id]; state.chartColsMine = m; }
    markSetup();
  } else {
    state.chartColsMine = { ...(state.chartColsMine || {}), [id]: c };
    save();
  }
}
export function resetCols(id) {
  if (isAdmin()) { setCols(id, DEFAULT_COLS); return; }
  const m = { ...(state.chartColsMine || {}) }; delete m[id]; state.chartColsMine = m; save();
}

const valueText = (k, i, share) => (k === 'minutes' ? `${fmtMin(i.minutes)} min` : k === 'touches' ? `${fmt.int(i.touches)} ${i.touches === 1 ? 'touch' : 'touches'}` : fmt.pct(share));

/**
 * items: [{ key, code, planned, icon, category, categoryFull, type, typeMore, minutes, touches, colour, rest }]
 * measure: 'minutes' | 'touches' — what orders the list and sets the bar's length.
 * ranked: biggest first (Pareto) or in the order given. onCfg(cfg): a column was moved or hidden here.
 */
export function rankList(items, ctx, { cfg = DEFAULT_COLS, measure = 'minutes', ranked = true, top = 3, mode = 'categories', onCfg } = {}) {
  const c = normaliseCols(cfg);
  const val = (i) => (measure === 'touches' ? i.touches : i.minutes) || 0;
  const list = (ranked ? [...items].sort((a, b) => val(b) - val(a) || (b.minutes - a.minutes)) : [...items]).filter(i => val(i) > 0 || (!ranked && i.minutes > 0));
  const sum = list.reduce((s, i) => s + val(i), 0);
  const max = Math.max(0, ...list.map(val));
  const tops = new Set(ranked ? list.slice(0, top).map(i => i.key) : []);
  const cols = c.order.filter(k => !c.hidden.includes(k));
  if (!cols.length) cols.push('bar');
  // the number the list is ranked by comes first, then minutes, touches, %
  const lead = measure === 'touches' ? 'touches' : 'minutes';
  // ranked by touches but showing minutes (or the other way round): the ranked one takes its place
  const other = lead === 'touches' ? 'minutes' : 'touches';
  const sel = !c.values.includes(lead) && c.values.includes(other) ? c.values.map(k => (k === other ? lead : k)) : c.values;
  const vals = [lead, 'minutes', 'touches', 'pct'].filter((k, i, a) => sel.includes(k) && a.indexOf(k) === i);
  // reserve room after the longest bar for its numbers, in characters
  const labelOf = (i) => vals.map(k => valueText(k, i, sum ? val(i) / sum : null)).join(' · ');
  const room = Math.max(0, ...list.map(i => labelOf(i).length)) + (vals.length ? 2 : 0);
  const hasCode = list.some(i => i.code);
  const width = { code: 'max-content', icon: 'max-content', category: 'minmax(0, 0.9fr)', type: 'minmax(0, 1fr)', bar: 'minmax(6.5em, 2.4fr)' };
  const shown = cols.filter(k => k !== 'code' || hasCode);

  const head = h('div', { class: 'rk-head' }, shown.map(k => h('div', { class: 'rk-hc rk-' + k, 'data-key': k, title: 'Drag to move this column' },
    h('span', { class: 'rk-grip', 'aria-hidden': 'true' }, icon('grip-horizontal')),
    h('span', { class: 'rk-hl', text: k === 'bar' ? (vals.length ? vals.map(v => VALUES[v].label).join(' · ') : 'Bar') : k === 'type' && mode !== 'types' ? 'Biggest type' : COLS[k].label }),
    onCfg ? h('button', { type: 'button', class: 'rk-hide', 'aria-label': `Hide the ${COLS[k].label} column`, title: 'Hide', onclick: () => onCfg({ ...c, hidden: [...c.hidden, k] }) }, icon('x')) : null)));
  if (onCfg) sortable(head, { items: '.rk-hc', axis: 'x', onDrop: (keys) => onCfg({ ...c, order: [...keys, ...c.order.filter(k => !keys.includes(k))] }) });

  let run = 0;
  const rows = list.map((i, n) => {
    run += val(i);
    const share = sum ? val(i) / sum : null;
    const w = max ? val(i) / max : 0;
    const cell = (k) => {
      if (k === 'code') return h('span', { class: 'rk-c rk-code' }, i.code ? h('span', { class: 'code ' + (i.planned == null ? 'code-x' : i.planned ? 'code-p' : 'code-u'), text: i.code }) : null);
      if (k === 'icon') return h('span', { class: 'rk-c rk-icon' }, i.icon ? icon(i.icon, 'lbl-ico') : null);
      if (k === 'category') return h('span', { class: 'rk-c rk-category rk-txt', title: i.categoryFull || i.category || '', text: i.category || '' });
      if (k === 'type') return h('span', { class: 'rk-c rk-type rk-txt' + (mode === 'types' ? '' : ' muted'), title: i.type || '' },
        i.type || '', i.typeMore ? h('span', { class: 'rk-more', text: ` +${i.typeMore}` }) : null);
      return h('span', { class: 'rk-c rk-bar' },
        h('span', { class: 'rk-track' },
          h('span', { class: 'bar', style: { '--w': w.toFixed(4), '--room': `${room}ch`, background: i.colour } }),
          vals.length ? h('span', { class: 'rk-val' }, vals.map((k2, j) => [j ? h('span', { class: 'rk-dot', text: ' · ' }) : null,
            k2 === lead ? h('strong', { text: valueText(k2, i, share) }) : h('span', { text: valueText(k2, i, share) })])) : null));
    };
    const row = h('div', { class: 'rk-row' + (tops.has(i.key) ? ' hi' : '') + ctx.sel(i.key) }, shown.map(cell));
    const leadText = measure === 'touches' ? `${fmt.int(i.touches)} touches` : `${fmtMin(i.minutes)} min`;
    const name = [i.code, i.type && mode === 'types' ? i.type : i.categoryFull || i.category].filter(Boolean).join(' · ');
    return ctx.tip(row, leadText, [name, mode === 'types' ? i.categoryFull || i.category : (i.type ? `Biggest type: ${i.type}` : null),
      `${fmtMin(i.minutes)} min · ${fmt.int(i.touches)} touches · ${fmt.pct(share)} of ${measure === 'touches' ? 'touches' : 'minutes'}`,
      ranked ? `#${n + 1} · cumulative ${fmt.pct(sum ? run / sum : null)}` : null, ...(i.rest || [])].filter(Boolean),
    i.key && ctx.pick ? () => ctx.pick(i.key) : null, `${name}: ${leadText}`);
  });
    // on a narrow screen the bar takes its own line under the names
  const narrow = shown.filter(k => k !== 'bar').map(k => width[k]).join(' ') || '1fr';
  return h('div', { class: 'rk-box' }, h('div', { class: 'rk', style: { '--rk-cols': shown.map(k => width[k]).join(' '), '--rk-cols-narrow': narrow }, 'data-measure': measure }, head, rows));
}

/** The column panel: tick to show, drag (or the arrows) to reorder, and what the bar shows. */
export function openColumnsPanel(id, { mode = 'categories', onChange } = {}) {
  const box = h('div', { class: 'confirm cols-panel' });
  const apply = (cfg, focusKey) => { setCols(id, cfg); onChange?.(); paint(focusKey); };
  function paint(focusKey) {
    const c = colsFor(id);
    const list = h('ul', { class: 'cp-list', 'aria-label': 'Columns, in order' }, c.order.map((k, idx) => {
      const on = !c.hidden.includes(k);
      const cb = h('input', { type: 'checkbox', checked: on, id: `cp-${k}` });
      cb.addEventListener('change', () => apply({ ...c, hidden: cb.checked ? c.hidden.filter(x => x !== k) : [...c.hidden, k] }, k));
      const move = (d) => { const o = [...c.order]; const j = idx + d; if (j < 0 || j >= o.length) return; [o[idx], o[j]] = [o[j], o[idx]]; apply({ ...c, order: o }, k); };
      return h('li', { class: 'cp-item' + (on ? '' : ' off'), 'data-key': k },
        h('button', { type: 'button', class: 'cp-grip', 'aria-label': `Move ${COLS[k].label}: drag, or use the arrow keys` }, icon('grip-vertical')),
        h('label', { class: 'cp-lbl', for: `cp-${k}` }, cb, h('span', {}, h('strong', { text: COLS[k].label }), h('span', { class: 'muted small', text: mode !== 'types' && k === 'type' ? 'The biggest type of touch in each category' : COLS[k].desc }))),
        h('span', { class: 'cp-moves' },
          h('button', { type: 'button', class: 'icon-btn small', 'aria-label': `Move ${COLS[k].label} up`, disabled: idx === 0, onclick: () => move(-1) }, icon('arrow-up')),
          h('button', { type: 'button', class: 'icon-btn small', 'aria-label': `Move ${COLS[k].label} down`, disabled: idx === c.order.length - 1, onclick: () => move(1) }, icon('arrow-down'))));
    }));
    sortable(list, { items: '.cp-item', handle: '.cp-grip', axis: 'y', onDrop: (keys, moved) => apply({ ...c, order: keys }, moved) });
    clear(box,
      h('div', { class: 'wiz-top' }, h('h2', {}, icon('columns-3'), ' Columns'),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close'))),
      h('p', { class: 'muted small', text: isAdmin() ? 'You are an admin: these columns become the team’s default.' : 'Saved on this device. An admin sets the team’s default.' }),
      list,
      h('h3', { class: 'cp-h' }, 'The bar shows'),
      h('div', { class: 'chips cp-values', role: 'group', 'aria-label': 'The bar shows' }, Object.entries(VALUES).map(([k, v]) => {
        const on = c.values.includes(k);
        return h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': String(on), 'data-value': k,
          onclick: () => apply({ ...c, values: on ? c.values.filter(x => x !== k) : [...c.values, k] }) }, on ? icon('check') : null, v.long);
      })),
      h('p', { class: 'muted small', text: 'Pick one, two or all three. The number the list is ranked by comes first, in bold; ranked by touches, touches take the place of minutes (and the other way round).' }),
      h('div', { class: 'row-end' },
        h('button', { type: 'button', class: 'btn ghost', onclick: () => { resetCols(id); onChange?.(); paint(); } }, icon('rotate-ccw'), isAdmin() ? 'Default columns' : 'Use the team’s columns'),
        h('button', { type: 'button', class: 'btn primary', onclick: () => closeModal() }, icon('check'), 'Done')));
    if (focusKey) box.querySelector(`.cp-item[data-key="${focusKey}"] .cp-grip`)?.focus();
  }
  paint();
  openModal(box, { label: 'Columns' });
}

/** The small button on a chart card that opens the panel. */
export function columnsButton(id, opts) {
  return h('button', { type: 'button', class: 'kind-btn cols-btn', title: 'Columns: show, hide and reorder', 'aria-label': 'Columns: show, hide and reorder', onclick: () => openColumnsPanel(id, opts) }, icon('columns-3'));
}
