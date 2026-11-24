// Chart renderers for the Analysis tab. Each takes plain items and returns a DOM node, so a
// card can switch between bars, columns, donut, Pareto, line and table without new data work.
// Columns and lines are HTML with an SVG line overlay: text never scales with the chart.
import { fmtMin } from './model.js';
import { h, clear, icon, fmt } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v); return el; };

/** Kinds a card can offer, with the icon drawn on its switch. */
export const KINDS = {
  bars: { label: 'Bars', path: 'M4 6h12M4 12h16M4 18h8' },
  columns: { label: 'Columns (histogram)', path: 'M6 20V10M12 20V4M18 20v-7M3 20h18' },
  donut: { label: 'Donut', path: 'M12 3a9 9 0 1 0 9 9h-5a4 4 0 1 1-4-4z' },
  pareto: { label: 'Pareto: columns + cumulative % line', path: 'M5 20V9M10 20v-7M15 20v-4M3 20h18M4 10l6-3 5-2 6-1' },
  line: { label: 'Line', path: 'M3 17l6-6 4 4 8-8' },
  combo: { label: 'Columns + cumulative % line', path: 'M6 20v-6M12 20V9M18 20v-9M3 20h18M3 13l6-4 6-3 6-2' },
  table: { label: 'Table', path: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14' },
};

export function kindIcon(kind) {
  const el = svgEl('svg', { viewBox: '0 0 24 24', class: 'ico', 'aria-hidden': 'true' });
  el.append(svgEl('path', { d: KINDS[kind]?.path || '' }));
  return el;
}

const niceMax = (max) => { if (max <= 0) return 1; const p = 10 ** Math.floor(Math.log10(max)); const m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };

/**
 * Shared item shape: { key, label (string), rich (node, optional), value (minutes), touches, pct, colour, rest: [] }
 * ctx: { sel(key) → '' | ' sel' | ' dimmed', pick(key) | null, tip(el, lead, rest) }
 */

/* ---------- horizontal bars ---------- */
export function hbars(items, ctx, { highlight = () => false } = {}) {
  const max = Math.max(...items.map(i => i.value), 0);
  return h('div', { class: 'bars' }, items.map(i => {
    const w = max ? i.value / max : 0;
    const row = h('div', { class: 'bar-row' + (highlight(i) ? ' hi' : '') + ctx.sel(i.key) },
      h('div', { class: 'bar-label' }, i.rich || i.label),
      h('div', { class: 'bar-track' },
        h('div', { class: 'bar', style: { width: `max(${i.value > 0 ? '3px' : '0px'}, calc((100% - 112px) * ${w.toFixed(4)}))`, background: i.colour } }),
        h('span', { class: 'bar-val' }, h('strong', { text: fmtMin(i.value) }), ' min', i.pct != null ? h('span', { class: 'bar-pct', text: ` · ${fmt.pct(i.pct)}` }) : null)));
    return ctx.tip(row, `${fmtMin(i.value)} min`, [i.label, ...(i.rest || [])], i.key && ctx.pick ? () => ctx.pick(i.key) : null, `${i.label}: ${fmtMin(i.value)} minutes`);
  }));
}

/* ---------- columns, stacked columns, with an optional % line ---------- */
/**
 * cols: [{ key, label, segs: [{ value, colour, label }], rest }]
 * line: { values: [0..1 per column], label } plotted on its own 0–100% axis, with an 80% mark.
 */
export function columns(cols, ctx, { line = null, unit = 'min', mark80 = false, xRotate = false } = {}) {
  const totals = cols.map(c => c.segs.reduce((s, g) => s + g.value, 0));
  const top = niceMax(Math.max(...totals, 0));
  const peak = totals.indexOf(Math.max(...totals));
  const plot = h('div', { class: 'cc-plot' + (line ? ' has-line' : '') });
  const grid = h('div', { class: 'cc-grid' }, [1, 0.5, 0].map(() => h('span')));
  const colsEl = h('div', { class: 'cc-cols' }, cols.map((c, idx) => {
    const tot = totals[idx];
    const col = h('div', { class: 'cc-col' + ctx.sel(c.key) },
      h('div', { class: 'cc-stack' },
        idx === peak && tot > 0 ? h('span', { class: 'cc-val', style: { bottom: `calc(${(tot / top) * 100}% + 4px)` }, text: fmtMin(tot) }) : null,
        c.segs.filter(g => g.value > 0).map(g => h('div', { class: 'cc-seg', style: { height: `${(g.value / top) * 100}%`, background: g.colour } }))),
      h('span', { class: 'cc-x' + (xRotate ? ' rot' : ''), title: c.label, text: c.short || c.label }));
    const rest = [c.label, ...c.segs.filter(g => g.value > 0 && g.label).map(g => `${g.label} ${fmtMin(g.value)} ${unit}`), ...(c.rest || []), ...(line ? [`${line.label}: ${fmt.pct(line.values[idx])}`] : [])];
    return ctx.tip(col, `${fmtMin(tot)} ${unit}`, rest, c.key && ctx.pick && tot > 0 ? () => ctx.pick(c.key) : null, `${c.label}: ${fmtMin(tot)} ${unit}`);
  }));
  plot.append(grid, colsEl);
  if (line && cols.length) {
    const n = cols.length;
    const xs = cols.map((_, i) => ((i + 0.5) / n) * 100);
    const svg = svgEl('svg', { class: 'cc-line', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    if (mark80) svg.append(svgEl('line', { x1: 0, x2: 100, y1: 20, y2: 20, class: 'cc-ref', 'vector-effect': 'non-scaling-stroke' }));
    svg.append(svgEl('polyline', { points: line.values.map((v, i) => `${xs[i]},${100 - (v ?? 0) * 100}`).join(' '), class: 'cc-poly', 'vector-effect': 'non-scaling-stroke' }));
    plot.append(svg);
    const last = line.values[line.values.length - 1];
    plot.append(h('div', { class: 'cc-dots' },
      line.values.map((v, i) => h('span', { class: 'cc-dot', style: { left: `${xs[i]}%`, bottom: `${(v ?? 0) * 100}%` } })),
      h('span', { class: 'cc-end', style: { bottom: `calc(${(last ?? 0) * 100}% + 8px)` }, text: fmt.pct(last) }),
      mark80 ? h('span', { class: 'cc-ref-l', text: '80%' }) : null));
  }
  return h('div', { class: 'cc' + (line ? ' with-line' : '') },
    h('div', { class: 'cc-y' }, [top, top / 2, 0].map(t => h('span', { text: fmtMin(t) }))),
    plot,
    line ? h('div', { class: 'cc-y right' }, ['100%', '50%', '0%'].map(t => h('span', { text: t }))) : null,
    line ? h('div', { class: 'cc-axis-note' }, h('span', { class: 'cc-key-col' }), `${unit === 'min' ? 'Minutes' : unit} (left)`, h('span', { class: 'cc-key-line' }), `${line.label} (right)`) : null);
}

/** Categories as columns, largest first, with the running share as a line. */
export function pareto(items, ctx) {
  const sorted = [...items].filter(i => i.value > 0).sort((a, b) => b.value - a.value);
  const sum = sorted.reduce((s, i) => s + i.value, 0);
  let run = 0;
  const cum = sorted.map(i => { run += i.value; return sum ? run / sum : 0; });
  return columns(sorted.map(i => ({ key: i.key, label: i.label, short: i.short || i.label, segs: [{ value: i.value, colour: i.colour }], rest: i.rest })), ctx,
    { line: { values: cum, label: 'Cumulative %' }, mark80: true, xRotate: sorted.length > 6 });
}

/** Categories as plain columns, in the order given. */
export function catColumns(items, ctx) {
  return columns(items.map(i => ({ key: i.key, label: i.label, short: i.short || i.label, segs: [{ value: i.value, colour: i.colour }], rest: i.rest })), ctx,
    { xRotate: items.length > 6 });
}

/* ---------- donut ---------- */
export function donut(items, ctx, { centre, caption, ariaLabel, maxParts = 6 } = {}) {
  let parts = items.filter(i => i.value > 0);
  if (parts.length > maxParts) {
    const top = [...parts].sort((a, b) => b.value - a.value).slice(0, maxParts - 1);
    const rest = parts.filter(p => !top.includes(p));
    parts = [...top, { key: '', label: `Other ${rest.length}`, short: 'Other', value: rest.reduce((s, p) => s + p.value, 0), colour: 'var(--c-none)' }];
  }
  const total = parts.reduce((s, p) => s + p.value, 0);
  const S = 220, cx = 110, cy = 110, R = 104, r = 66;
  const el = svgEl('svg', { viewBox: `0 0 ${S} ${S}`, class: 'donut', role: 'group', 'aria-label': ariaLabel || 'Share of minutes' });
  const pt = (rad, deg) => { const a = (deg - 90) * Math.PI / 180; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; };
  const arc = (a0, a1) => {
    const large = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0);
    return `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${large} 0 ${x3} ${y3}Z`;
  };
  let a = 0;
  for (const p of parts) {
    const share = total ? p.value / total : 0;
    const a1 = a + share * 360;
    const g = svgEl('g', { class: 'arc' + (p.key ? ctx.sel(p.key) : '') });
    const path = svgEl('path', { d: share > 0.9999 ? `${arc(0, 180)}${arc(180, 359.999)}` : arc(a, a1) });
    path.style.fill = p.colour;
    g.append(path);
    if (share >= 0.08) {
      const [tx, ty] = pt((R + r) / 2, a + share * 180);
      const t = svgEl('text', { x: tx, y: ty, class: 'arc-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      t.textContent = p.inside ?? (p.short && p.short.length <= 4 ? p.short : fmt.pct(share));
      g.append(t);
    }
    ctx.tip(g, `${fmtMin(p.value)} min · ${fmt.pct(share)}`, [p.label, ...(p.rest || [])], p.key && ctx.pick ? () => ctx.pick(p.key) : null, `${p.label}: ${fmtMin(p.value)} minutes, ${fmt.pct(share)}`);
    el.append(g);
    a = a1;
  }
  if (!total) { const c = svgEl('circle', { cx, cy, r: (R + r) / 2, fill: 'none', 'stroke-width': R - r }); c.style.stroke = 'var(--track)'; el.append(c); }
  const c1 = svgEl('text', { x: cx, y: cy - 6, class: 'donut-centre', 'text-anchor': 'middle' }); c1.textContent = centre ?? fmt.int(total);
  const c2 = svgEl('text', { x: cx, y: cy + 20, class: 'donut-caption', 'text-anchor': 'middle' }); c2.textContent = caption ?? 'minutes';
  el.append(c1, c2);
  return h('div', { class: 'donut-block' },
    h('div', { class: 'donut-wrap' }, el),
    h('ul', { class: 'legend' }, parts.map(p => {
      const li = h('li', { class: p.key ? 'pickable' + ctx.sel(p.key) : '' }, h('span', { class: 'swatch', style: { background: p.colour } }), h('span', { text: `${p.label} · ${fmtMin(p.value)} min` }));
      if (p.key && ctx.pick) ctx.tip(li, p.label, [], () => ctx.pick(p.key));
      return li;
    })));
}

/* ---------- lines (same unit, one axis) ---------- */
/** x: [{ key, label }], series: [{ label, colour, values }] */
export function lines(x, series, ctx, { unit = 'min' } = {}) {
  const top = niceMax(Math.max(0, ...series.flatMap(s => s.values)));
  const n = x.length;
  const xs = x.map((_, i) => (n === 1 ? 50 : (i / (n - 1)) * 100));
  const plot = h('div', { class: 'cc-plot lines' });
  plot.append(h('div', { class: 'cc-grid' }, [1, 0.5, 0].map(() => h('span'))));
  const svg = svgEl('svg', { class: 'cc-line multi', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  for (const s of series) {
    const pl = svgEl('polyline', { points: s.values.map((v, i) => `${xs[i]},${100 - (v / top) * 100}`).join(' '), class: 'cc-poly', 'vector-effect': 'non-scaling-stroke' });
    pl.style.stroke = s.colour;
    svg.append(pl);
  }
  plot.append(svg);
  const hits = h('div', { class: 'cc-hits' }, x.map((xx, i) => {
    const col = h('div', { class: 'cc-hit' + ctx.sel(xx.key), style: { left: `${xs[i]}%` } },
      series.map(s => h('span', { class: 'cc-dot', style: { bottom: `${(s.values[i] / top) * 100}%`, background: s.colour } })));
    return ctx.tip(col, xx.label, series.map(s => `${s.label}: ${fmtMin(s.values[i])} ${unit}`), xx.key && ctx.pick ? () => ctx.pick(xx.key) : null, xx.label);
  }));
  plot.append(hits);
  return h('div', { class: 'cc lines-chart' },
    h('div', { class: 'cc-y' }, [top, top / 2, 0].map(t => h('span', { text: fmtMin(t) }))),
    plot,
    h('div', { class: 'cc-xs' }, x.map((xx, i) => h('span', { style: { left: `${xs[i]}%` }, text: xx.short || xx.label }))),
    series.length > 1 ? h('ul', { class: 'legend' }, series.map(s => h('li', {}, h('span', { class: 'swatch line', style: { background: s.colour } }), h('span', { text: s.label })))) : null);
}

/* ---------- table ---------- */
export function table(items, { label = 'Item', cum = false } = {}) {
  const sorted = cum ? [...items].sort((a, b) => b.value - a.value) : items;
  const sum = sorted.reduce((s, i) => s + i.value, 0);
  let run = 0;
  const touches = sorted.reduce((s, i) => s + (i.touches || 0), 0);
  return h('div', { class: 'tbl-scroll' },
    h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, [label, 'Touches', 'Minutes', 'Op-hours', '% of minutes', ...(cum ? ['Cumulative'] : [])].map((x, i) => h('th', { scope: 'col', class: i ? 'num' : '', text: x })))),
      h('tbody', {}, sorted.map(i => { run += i.value; return h('tr', {},
        h('th', { scope: 'row', text: i.label }),
        h('td', { class: 'num', text: i.touches != null ? fmt.int(i.touches) : '–' }),
        h('td', { class: 'num', text: fmt.dec(i.value, 2) }),
        h('td', { class: 'num', text: fmt.dec(i.value / 60, 2) }),
        h('td', { class: 'num', text: fmt.pct(sum ? i.value / sum : null, 1) }),
        cum ? h('td', { class: 'num', text: fmt.pct(sum ? run / sum : null, 1) }) : null); })),
      h('tfoot', {}, h('tr', {},
        h('th', { scope: 'row', text: 'Total' }),
        h('td', { class: 'num', text: fmt.int(touches) }),
        h('td', { class: 'num', text: fmt.dec(sum, 2) }),
        h('td', { class: 'num', text: fmt.dec(sum / 60, 2) }),
        h('td', { class: 'num', text: sum ? '100%' : '–' }),
        cum ? h('td') : null))));
}

/** The small icon switch for a card's chart kind. */
export function kindSwitch(kinds, current, onPick) {
  return h('div', { class: 'kind-switch', role: 'group', 'aria-label': 'Chart type' }, kinds.map(k => h('button', {
    type: 'button', class: 'kind-btn' + (k === current ? ' on' : ''), title: KINDS[k].label, 'aria-label': KINDS[k].label, 'aria-pressed': String(k === current),
    onclick: () => onPick(k),
  }, kindIcon(k))));
}

export { clear, icon };
