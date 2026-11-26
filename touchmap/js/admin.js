// Admin: every plant in the business unit on one page. Drill down Romania → plant → line →
// observation; tap any bar, slice or cell to filter the whole page. Data is everything this
// device holds (its own runs and the team log it syncs with), plus optional demo data for the
// plants that are not live yet.
import { CAT_BY_CODE, CATEGORIES } from './framework.js';
import { totalMinutes, runCapacity, fmtMin, observedMinutes } from './model.js';
import { state } from './store.js';
import { status as syncStatus } from './sync.js';
import { ORG, allPlants, plantOf, lineOf } from './org.js';
import { demoRuns, demoLoadedAt, loadOrgDemo, clearOrgDemo } from './demo-org.js';
import { hbars, columns, donut, lines as linesChart, table as itemsTable, kindSwitch } from './charts.js';
import { interactive } from './insights.js';
import { zoneColour } from './colors.js';
import { zoneIcon, categoryIcon } from './iconmap.js';
import { rankList, colsFor, setCols, columnsButton } from './rank.js';
import { h, clear, icon, fmt, toast, confirmBox, infoNote, deliverFile, stamp } from './ui.js';

const COLOUR = {
  Planned: 'var(--c-planned)', Unplanned: 'var(--c-unplanned)', Physical: 'var(--c-physical)', Information: 'var(--c-information)',
  none: 'var(--c-none)', single: 'var(--c-single)',
};
// Where you are (drill path) and what is picked (filters), kept while the app is open.
const S = { plant: '', line: '', run: '', period: 'all', planned: '', category: '', zone: '', touchType: '', type: '' };
const K = { share: 'pareto', zone: 'bars', shareBy: 'minutes', shareLevel: 'categories' };
const FILTERS = ['planned', 'category', 'zone', 'touchType', 'type'];
let rootEl = null;

const typeKey = (t) => (t.category && t.type ? `${t.category}\u0000${t.type}` : '');
const GET = {
  planned: t => t.planned || '', category: t => t.category || '', zone: t => t.zone || '', touchType: t => t.touchType || '', type: typeKey,
};
const NAME = {
  planned: v => v, touchType: v => v, zone: v => v,
  category: v => (CAT_BY_CODE[v] ? `${v} ${CAT_BY_CODE[v].short || CAT_BY_CODE[v].name}` : v),
  type: v => v.replace('\u0000', ' · '),
};

/* ---------- the data: runs → plant / line, touches flattened ---------- */
function runDate(r) {
  const first = r.touches.reduce((m, t) => (!m || (t.start || '') < m ? t.start || m : m), null);
  return r.info?.from || (first ? first.slice(0, 10) : (r.createdAt || '').slice(0, 10));
}
function dataset() {
  const real = Object.values(state.runs).filter(r => !/^Demo shift/.test(r.name));
  const demo = demoRuns();
  const runs = [...real.map(r => ({ r, demo: false })), ...demo.map(r => ({ r, demo: true }))].map(({ r, demo: isDemo }) => {
    const plant = plantOf(r.info?.plant);
    const line = lineOf(plant, r.info?.line);
    const plantId = plant?.id || `?${r.info?.plant || 'Unknown plant'}`;
    const lineId = line?.id || `?${r.info?.line || 'Unknown line'}`;
    return {
      id: r.id, run: r, demo: isDemo, plantId, plantName: plant?.name || r.info?.plant || 'Unknown plant', lineId, lineName: line?.name || r.info?.line || 'Unknown line',
      lineFull: line?.full || r.info?.line || '', date: runDate(r), capacity: runCapacity(r), observedMin: observedMinutes(r),
    };
  });
  const touches = runs.flatMap(x => x.run.touches.map(t => ({ ...t, _run: x.id, _plant: x.plantId, _line: x.lineId, _demo: x.demo, _min: totalMinutes(t), _n: Number(t.count) || 0, _day: (t.start || t.createdAt || '').slice(0, 10) })));
  return { runs, touches };
}

const sinceDay = () => {
  if (S.period === 'all') return '';
  const d = new Date(); d.setDate(d.getDate() - Number(S.period));
  return fmt.dayKey(d.toISOString());
};
const inPath = (x) => (!S.plant || x.plantId === S.plant) && (!S.line || x.lineId === S.line) && (!S.run || x.id === S.run);
const inPeriod = (day) => !sinceDay() || (day && day >= sinceDay());
/** Demo when every observation that holds touches is demo data. */
const isDemo = (rs) => { const full = rs.filter(x => x.run.touches.length); return full.length > 0 && full.every(x => x.demo); };

/** Touches in the drill path and period, with every filter applied except `skip`. */
function scoped(ds, skip = null) {
  const runIds = new Set(ds.runs.filter(x => inPath(x)).map(x => x.id));
  return ds.touches.filter(t => runIds.has(t._run) && inPeriod(t._day) && FILTERS.every(d => d === skip || !S[d] || GET[d](t) === S[d]));
}

function tally(rows, keyFn) {
  const m = new Map();
  for (const t of rows) {
    const k = keyFn(t);
    const v = m.get(k) || { key: k, minutes: 0, touches: 0, rows: 0, planned: 0, unplanned: 0, physical: 0, information: 0 };
    v.minutes += t._min; v.touches += t._n; v.rows++;
    if (t.planned === 'Planned') v.planned += t._min; else if (t.planned === 'Unplanned') v.unplanned += t._min;
    if (t.touchType === 'Physical') v.physical += t._min; else if (t.touchType === 'Information') v.information += t._min;
    m.set(k, v);
  }
  return m;
}
const total = (rows) => rows.reduce((s, t) => s + t._min, 0);

/* ---------- interaction ---------- */
function rerender() {
  if (!rootEl) return;
  const y = window.scrollY;
  renderAdmin(rootEl);
  window.scrollTo(0, y);
}
function drill(level, id) {
  if (level === 'bu') Object.assign(S, { plant: '', line: '', run: '' });
  if (level === 'plant') Object.assign(S, { plant: id, line: '', run: '' });
  if (level === 'line') Object.assign(S, { line: id, run: '' });
  if (level === 'run') S.run = id;
  rerender();
}
const toggle = (dim, key) => { S[dim] = S[dim] === key ? '' : key; rerender(); };
const selOf = (dim) => (key) => (S[dim] ? (S[dim] === key ? ' sel' : ' dimmed') : '');
const ctxFor = (dim) => ({
  sel: dim ? selOf(dim) : () => '',
  pick: dim ? (key) => toggle(dim, key) : null,
  tip: (el, lead, rest = [], onPick = null, label = null) => interactive(el, { lead, rest, onPick, label }),
});

/* ---------- pieces ---------- */
function tile(ico, label, value, sub) {
  return h('div', { class: 'adm-tile' }, h('span', { class: 'adm-tile-ico' }, icon(ico)),
    h('div', {}, h('div', { class: 'adm-tile-v', text: value }), h('div', { class: 'adm-tile-l', text: label }), sub ? h('div', { class: 'adm-tile-s', text: sub }) : null));
}
function split(planned, unplanned) {
  const sum = planned + unplanned;
  return h('div', { class: 'adm-split', role: 'img', 'aria-label': sum ? `Planned ${fmt.pct(planned / sum)}, unplanned ${fmt.pct(unplanned / sum)}` : 'No minutes yet' },
    sum ? [h('span', { style: { width: `${(planned / sum) * 100}%`, background: COLOUR.Planned } }), h('span', { style: { width: `${(unplanned / sum) * 100}%`, background: COLOUR.Unplanned } })] : h('span', { class: 'empty-track' }));
}
function card(title, ico, body, { kinds, kind, onKind, note, cls = '', tools = null, before = null } = {}) {
  return h('section', { class: 'card adm-card ' + cls },
    h('div', { class: 'chart-head' }, h('h2', { class: 'card-h' }, icon(ico), title),
      tools || kinds ? h('div', { class: 'chart-tools' }, tools, kinds ? kindSwitch(kinds, kind, onKind) : null) : null),
    before,
    body,
    note ? infoNote(note) : null);
}
const legend = (items) => h('ul', { class: 'legend' }, items.map(([label, colour]) => h('li', {}, h('span', { class: 'swatch', style: { background: colour } }), h('span', { text: label }))));
const withIcon = (ico, text) => h('span', { class: 'bl' }, icon(ico, 'lbl-ico'), h('span', { text }));
const toItems = (list, { label, colour, rest, rich } = {}) => list.map(v => ({
  key: v.key, label: label ? label(v) : v.key || 'Not set', rich: rich ? rich(v) : undefined, value: v.minutes, touches: v.touches, pct: null, colour: colour ? colour(v) : COLOUR.single,
  rest: rest ? rest(v) : [`${fmt.int(v.touches)} touches · ${fmt.dec(v.minutes / 60, 1)} h`],
}));

/* ---------- children of the current level ---------- */
function children(ds, rows) {
  const runsHere = ds.runs.filter(x => inPath(x) && (inPeriod(x.date) || x.run.touches.some(t => inPeriod((t.start || '').slice(0, 10)))));
  if (S.run) {
    const m = tally(rows, t => t.zone || 'Not set');
    return { level: 'zone', noun: 'zone', list: [...m.values()].sort((a, b) => b.minutes - a.minutes).map(v => ({ ...v, id: v.key, name: v.key, ico: zoneIcon(v.key), pick: () => toggle('zone', v.key) })) };
  }
  if (S.line) {
    const m = tally(rows, t => t._run);
    return {
      level: 'run', noun: 'observation',
      list: runsHere.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(x => ({
        ...(m.get(x.id) || { minutes: 0, touches: 0, planned: 0, unplanned: 0, rows: 0 }), key: x.id, id: x.id, name: x.run.name, sub: x.date ? fmt.day(x.date + 'T12:00') : '', demo: x.demo, ico: 'clock', capacity: x.capacity,
        observers: [...new Set(x.run.touches.map(t => t.observer).filter(Boolean))], pick: () => drill('run', x.id),
      })),
    };
  }
  if (S.plant) {
    const plant = allPlants().find(p => p.id === S.plant);
    const m = tally(rows, t => t._line);
    const ids = [...new Set([...(plant?.lines || []).map(l => l.id), ...runsHere.map(x => x.lineId)])];
    return {
      level: 'line', noun: 'line',
      list: ids.map(id => {
        const l = plant?.lines.find(x => x.id === id);
        const rs = runsHere.filter(x => x.lineId === id);
        return { ...(m.get(id) || { minutes: 0, touches: 0, planned: 0, unplanned: 0, rows: 0 }), key: id, id, name: l?.name || rs[0]?.lineName || id, sub: l?.blurb || rs[0]?.lineFull || '', live: !!(l?.live || plant?.live && !l),
          demo: isDemo(rs), runs: rs.filter(x => x.run.touches.length).length, last: rs.map(x => x.date).sort().pop(), ico: 'line', pick: () => drill('line', id) };
      }),
    };
  }
  const m = tally(rows, t => t._plant);
  const ids = [...new Set([...allPlants().map(p => p.id), ...runsHere.map(x => x.plantId)])];
  return {
    level: 'plant', noun: 'plant',
    list: ids.map(id => {
      const p = allPlants().find(x => x.id === id);
      const rs = runsHere.filter(x => x.plantId === id);
      return { ...(m.get(id) || { minutes: 0, touches: 0, planned: 0, unplanned: 0, rows: 0 }), key: id, id, name: p?.name || rs[0]?.plantName || id,
        sub: `${p ? p.lines.length : new Set(rs.map(x => x.lineId)).size} lines`, live: !!p?.live, demo: isDemo(rs), runs: rs.filter(x => x.run.touches.length).length,
        lines: new Set(rs.map(x => x.lineId)).size, last: rs.map(x => x.date).sort().pop(), ico: 'factory', pick: () => drill('plant', id) };
    }),
  };
}

function childCards(kids) {
  return h('div', { class: 'adm-kids' }, kids.list.map(k => {
    const has = k.minutes > 0 || k.runs > 0;
    const status = kids.level === 'zone' ? null : k.demo ? ['Demo', 'demo'] : k.live === false && !has ? ['Coming soon', 'soon'] : has ? ['Live', 'live'] : k.live ? ['No data yet', 'idle'] : null;
    const sum = k.planned + k.unplanned;
    const el = h('button', { type: 'button', class: 'adm-kid' + (has ? '' : ' empty') + (kids.level === 'zone' && S.zone === k.id ? ' on' : ''), onclick: () => k.pick(), disabled: !has && kids.level !== 'zone' },
      h('div', { class: 'adm-kid-top' },
        h('span', { class: 'adm-kid-ico' }, icon(k.ico)),
        h('span', { class: 'adm-kid-name' }, h('strong', { text: k.name }), k.sub ? h('span', { class: 'muted small', text: k.sub }) : null),
        status ? h('span', { class: 'adm-st ' + status[1], text: status[0] }) : null),
      has ? [
        h('div', { class: 'adm-kid-nums' },
          h('span', {}, h('strong', { text: fmt.dec(k.minutes / 60, 1) }), ' h'),
          h('span', {}, h('strong', { text: fmt.int(k.touches) }), ' touches'),
          sum ? h('span', {}, h('strong', { text: fmt.pct(k.planned / sum) }), ' planned') : null),
        split(k.planned, k.unplanned),
        h('div', { class: 'adm-kid-foot muted small' },
          k.runs != null ? `${k.runs} ${k.runs === 1 ? 'observation' : 'observations'}` : '',
          k.lines ? ` · ${k.lines} ${k.lines === 1 ? 'line' : 'lines'}` : '',
          k.last ? ` · last ${fmt.day(k.last + 'T12:00')}` : '',
          k.observers?.length ? ` · ${k.observers.join(', ')}` : ''),
      ] : h('p', { class: 'muted small adm-kid-none', text: k.live === false ? 'Not live yet. Load demo data to preview it.' : 'No observations synced yet.' }),
      has && kids.level !== 'zone' ? h('span', { class: 'adm-kid-go' }, icon('chevronRight')) : null);
    return el;
  }));
}

/* ---------- charts ---------- */
function byChild(kids) {
  const list = kids.list.filter(k => k.minutes > 0);
  if (!list.length) return h('p', { class: 'empty', text: 'Nothing logged in this scope yet.' });
  const ctx = { sel: () => '', pick: (key) => list.find(k => k.key === key)?.pick(), tip: ctxFor(null).tip };
  return h('div', {},
    legend([['Planned', COLOUR.Planned], ['Unplanned', COLOUR.Unplanned], ['Not set', COLOUR.none]]),
    columns(list.map(k => ({ key: k.key, label: k.name, short: k.name.length > 12 ? k.name.slice(0, 11) + '…' : k.name,
      segs: [{ value: k.planned, colour: COLOUR.Planned, label: 'Planned' }, { value: k.unplanned, colour: COLOUR.Unplanned, label: 'Unplanned' }, { value: Math.max(0, k.minutes - k.planned - k.unplanned), colour: COLOUR.none, label: 'Not set' }],
      rest: [`${fmt.int(k.touches)} touches`, kids.level === 'zone' ? 'Tap to filter' : `Tap to open this ${kids.noun}`] })), ctx, { xRotate: list.length > 7 }));
}

function heatMatrix(kids, rows) {
  const list = kids.list.filter(k => k.minutes > 0);
  if (!list.length) return h('p', { class: 'empty', text: 'Nothing logged in this scope yet.' });
  const keyOf = { plant: t => t._plant, line: t => t._line, run: t => t._run, zone: t => t.zone || 'Not set' }[kids.level];
  const cell = new Map();
  let max = 0;
  for (const t of rows) {
    const k = `${keyOf(t)}|${t.category || ''}`;
    const v = (cell.get(k) || 0) + t._min;
    cell.set(k, v); max = Math.max(max, v);
  }
  const cats = CATEGORIES.map(c => c.code).filter(code => list.some(k => cell.get(`${k.key}|${code}`)));
  return h('div', { class: 'tbl-scroll' }, h('table', { class: 'adm-heat' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: kids.noun[0].toUpperCase() + kids.noun.slice(1) }),
      cats.map(code => h('th', { scope: 'col', title: CAT_BY_CODE[code]?.name },
        h('span', { class: 'code ' + (CAT_BY_CODE[code]?.planned ? 'code-p' : 'code-u'), text: code }))))),
    h('tbody', {}, list.map(k => h('tr', {},
      h('th', { scope: 'row' }, h('button', { type: 'button', class: 'link-btn', onclick: () => k.pick(), text: k.name })),
      cats.map(code => {
        const v = cell.get(`${k.key}|${code}`) || 0;
        const f = max ? v / max : 0;
        const td = h('td', { class: 'num' + (S.category === code ? ' sel' : ''), style: v ? { background: `rgba(244, 0, 9, ${(0.06 + f * 0.86).toFixed(3)})`, color: f > 0.5 ? '#fff' : 'var(--ink)' } : null, text: v ? fmtMin(v) : '' });
        return v ? interactive(td, { lead: `${fmtMin(v)} min`, rest: [k.name, CAT_BY_CODE[code]?.name || code, 'Tap to filter by this category'], onPick: () => toggle('category', code), label: `${k.name}, ${code}: ${fmtMin(v)} minutes` }) : td;
      }))))));
}

function trend(rows) {
  const m = new Map();
  for (const t of rows) {
    if (!t._day) continue;
    const v = m.get(t._day) || { Planned: 0, Unplanned: 0 };
    if (t.planned === 'Planned' || t.planned === 'Unplanned') v[t.planned] += t._min;
    m.set(t._day, v);
  }
  const days = [...m.keys()].sort();
  if (days.length < 2) return h('p', { class: 'empty', text: 'Needs observations on two or more days.' });
  return h('div', {}, legend([['Planned', COLOUR.Planned], ['Unplanned', COLOUR.Unplanned]]),
    linesChart(days.map(d => ({ key: d, label: fmt.day(d + 'T12:00'), short: d.slice(8, 10) + '/' + d.slice(5, 7) })), [
      { label: 'Planned', colour: COLOUR.Planned, values: days.map(d => m.get(d).Planned) },
      { label: 'Unplanned', colour: COLOUR.Unplanned, values: days.map(d => m.get(d).Unplanned) }], ctxFor(null)));
}

function topTypes(rows, ds) {
  const m = tally(rows, typeKey);
  const sum = total(rows);
  const plantsOf = new Map();
  for (const t of rows) { const k = typeKey(t); if (!k) continue; if (!plantsOf.has(k)) plantsOf.set(k, new Set()); plantsOf.get(k).add(t._plant); }
  const list = [...m.values()].filter(v => v.key).sort((a, b) => b.minutes - a.minutes).slice(0, 12);
  if (!list.length) return h('p', { class: 'empty', text: 'No categorised touches here yet.' });
  const plantName = (id) => allPlants().find(p => p.id === id)?.name || id;
  return h('div', { class: 'tbl-scroll' }, h('table', { class: 'tbl adm-types' },
    h('thead', {}, h('tr', {}, ['#', 'Type of touch', 'Minutes', 'Touches', 'Share', S.plant ? null : 'Plants'].filter(Boolean).map((x, i) => h('th', { scope: 'col', class: i >= 2 ? 'num' : '', text: x })))),
    h('tbody', {}, list.map((v, i) => {
      const [code, name] = v.key.split('\u0000');
      const c = CAT_BY_CODE[code];
      const tr = h('tr', { class: S.type === v.key ? 'sel' : '' },
        h('td', { class: 'muted', text: String(i + 1) }),
        h('th', { scope: 'row' }, h('span', { class: 'bl' }, h('span', { class: 'code ' + (c ? (c.planned ? 'code-p' : 'code-u') : 'code-x'), text: code }), h('span', { text: name }))),
        h('td', { class: 'num', text: fmtMin(v.minutes) }),
        h('td', { class: 'num', text: fmt.int(v.touches) }),
        h('td', { class: 'num', text: fmt.pct(sum ? v.minutes / sum : null, 1) }),
        S.plant ? null : h('td', { class: 'num', title: [...(plantsOf.get(v.key) || [])].map(plantName).join(', '), text: String(plantsOf.get(v.key)?.size || 0) }));
      return interactive(tr, { lead: `${fmtMin(v.minutes)} min`, rest: [name, c?.name || code, `${fmt.int(v.touches)} touches`, 'Tap to filter by this type'], onPick: () => toggle('type', v.key), label: `${name}: ${fmtMin(v.minutes)} minutes` });
    }))));
}

function observers(rows, ds) {
  const m = new Map();
  const runById = new Map(ds.runs.map(x => [x.id, x]));
  for (const t of rows) {
    const who = t.observer || 'Not recorded';
    const v = m.get(who) || { who, plants: new Set(), lines: new Set(), runs: new Set(), touches: 0, minutes: 0, last: '', demo: true };
    const x = runById.get(t._run);
    v.plants.add(x?.plantName); v.lines.add(x?.lineName); v.runs.add(t._run);
    v.touches += t._n; v.minutes += t._min; if ((t.start || '') > v.last) v.last = t.start || v.last; if (!t._demo) v.demo = false;
    m.set(who, v);
  }
  const list = [...m.values()].sort((a, b) => b.minutes - a.minutes);
  if (!list.length) return h('p', { class: 'empty', text: 'No observers in this scope yet.' });
  return h('div', { class: 'tbl-scroll' }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, ['Observer', 'Plant', 'Line', 'Observations', 'Touches', 'Hours', 'Last active'].map((x, i) => h('th', { scope: 'col', class: i >= 3 && i < 6 ? 'num' : '', text: x })))),
    h('tbody', {}, list.map(v => h('tr', {},
      h('th', { scope: 'row' }, v.who, v.demo ? h('span', { class: 'adm-st demo inline', text: 'Demo' }) : null),
      h('td', { text: [...v.plants].filter(Boolean).join(', ') }),
      h('td', { text: [...v.lines].filter(Boolean).join(', ') }),
      h('td', { class: 'num', text: String(v.runs.size) }),
      h('td', { class: 'num', text: fmt.int(v.touches) }),
      h('td', { class: 'num', text: fmt.dec(v.minutes / 60, 1) }),
      h('td', { text: v.last ? fmt.day(v.last) : '–' }))))));
}

function runTable(ds, rows) {
  const byRun = tally(rows, t => t._run);
  const list = ds.runs.filter(x => inPath(x) && inPeriod(x.date)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!list.length) return h('p', { class: 'empty', text: 'No observations in this scope.' });
  return h('div', { class: 'tbl-scroll' }, h('table', { class: 'tbl adm-runs' },
    h('thead', {}, h('tr', {}, ['Date', 'Plant', 'Line', 'Observation', 'Touches', 'Hours', 'Planned', 'Coverage'].map((x, i) => h('th', { scope: 'col', class: i >= 4 ? 'num' : '', text: x })))),
    h('tbody', {}, list.map(x => {
      const v = byRun.get(x.id) || { minutes: 0, touches: 0, planned: 0, unplanned: 0 };
      const ps = v.planned + v.unplanned;
      const tr = h('tr', { class: S.run === x.id ? 'sel' : '' },
        h('td', { text: x.date ? fmt.day(x.date + 'T12:00') : '–' }),
        h('td', { text: x.plantName }),
        h('td', { text: x.lineName }),
        h('th', { scope: 'row' }, x.run.name, x.demo ? h('span', { class: 'adm-st demo inline', text: 'Demo' }) : null),
        h('td', { class: 'num', text: fmt.int(v.touches) }),
        h('td', { class: 'num', text: fmt.dec(v.minutes / 60, 1) }),
        h('td', { class: 'num', text: ps ? fmt.pct(v.planned / ps) : '–' }),
        h('td', { class: 'num', text: x.capacity ? fmt.pct(v.minutes / 60 / x.capacity) : '–' }));
      return interactive(tr, { lead: x.run.name, rest: [`${x.plantName} · ${x.lineName}`, `${fmt.int(v.touches)} touches · ${fmt.dec(v.minutes / 60, 1)} h`, 'Tap to open this observation'],
        onPick: () => { Object.assign(S, { plant: x.plantId, line: x.lineId }); drill('run', x.id); }, label: `${x.run.name}, ${x.plantName} ${x.lineName}` });
    }))));
}

/* ---------- export ---------- */
function exportCsv(ds) {
  const runById = new Map(ds.runs.map(x => [x.id, x]));
  const rows = scoped(ds);
  const head = ['Business unit', 'Plant', 'Line', 'Observation', 'Date', 'Zone', 'Planned/Unplanned', 'Category', 'Type of touch', 'Touch type', 'Count', 'Minutes', 'Observer', 'Person observed', 'Description', 'Demo'];
  const q = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [head.join(','), ...rows.map(t => { const x = runById.get(t._run); return [x.run.info?.bu || 'Romania', x.plantName, x.lineName, x.run.name, t._day, t.zone, t.planned, t.category, t.type, t.touchType, t._n, t._min.toFixed(2), t.observer, t.who, t.description, x.demo ? 'yes' : ''].map(q).join(','); })];
  deliverFile('﻿' + lines.join('\n'), `touch-map-all-plants-${stamp()}.csv`, 'text/csv');
}

/* ---------- the page ---------- */
export function renderAdmin(root) {
  rootEl = root;
  const ds = dataset();
  if (S.run && !ds.runs.some(x => x.id === S.run)) S.run = '';
  const rows = scoped(ds);
  const unit = ORG.units[0];
  const plant = allPlants().find(p => p.id === S.plant);
  const lineName = S.line ? (plant?.lines.find(l => l.id === S.line)?.name || ds.runs.find(x => x.lineId === S.line)?.lineName || S.line) : '';
  const run = S.run ? ds.runs.find(x => x.id === S.run) : null;
  // at observation level the cards are zones: keep every zone visible while one is picked
  const kidsRows = S.run ? scoped(ds, 'zone') : rows;
  const kidsAll = children(ds, kidsRows);

  // headline numbers
  const runsHere = ds.runs.filter(x => inPath(x) && inPeriod(x.date));
  const withData = runsHere.filter(x => x.run.touches.length);
  const sum = total(rows);
  const plannedMin = rows.filter(t => t.planned === 'Planned').reduce((s, t) => s + t._min, 0);
  const unplannedMin = rows.filter(t => t.planned === 'Unplanned').reduce((s, t) => s + t._min, 0);
  const cap = withData.reduce((s, x) => s + x.capacity, 0);
  const obs = new Set(rows.map(t => t.observer).filter(Boolean));
  const catTally = [...tally(rows, t => t.category || '').values()].filter(v => v.key).sort((a, b) => b.minutes - a.minutes);
  const demoAt = demoLoadedAt();
  const sync = syncStatus();

  const crumbs = [
    ['bu', unit.name, 'globe', !S.plant],
    plant || S.plant ? ['plant', plant?.name || ds.runs.find(x => x.plantId === S.plant)?.plantName || S.plant, 'factory', S.plant && !S.line] : null,
    S.line ? ['line', lineName, 'line', S.line && !S.run] : null,
    run ? ['run', run.run.name, 'clock', true] : null,
  ].filter(Boolean);

  const active = FILTERS.filter(d => S[d]);
  const loadDemo = async () => {
    const live = ds.runs.some(x => !x.demo && x.run.touches.length);
    loadOrgDemo({ includeLive: !live });
    toast(live ? 'Demo data loaded for Timișoara and Poiana Negri.' : 'Demo data loaded for every plant, including a preview of Ploiești K3 until real observations sync.');
    rerender();
  };
  const clearDemo = async () => {
    const ok = await confirmBox({ title: 'Clear the demo data?', body: 'Only the demo observations go. Real observations synced from the plants stay.', ok: 'Clear demo data', danger: true });
    if (!ok) return;
    clearOrgDemo();
    toast('Demo data cleared.');
    rerender();
  };

  const levelTitle = { plant: 'Plants', line: 'Lines', run: 'Observations', zone: 'Zones' }[kidsAll.level];
  const scopeName = run ? `${run.run.name} · ${run.plantName} ${run.lineName}` : S.line ? `${plant?.name || ''} · ${lineName}` : plant ? plant.name : `${unit.name} · all plants`;

  clear(root, h('section', { class: 'admin' },
    h('div', { class: 'view-head adm-head' },
      h('div', {},
        h('h1', { class: 'view-title' }, icon('shield', 'title-ico'), 'All plants'),
        h('p', { class: 'view-sub', text: `${scopeName}. Tap a card, bar or cell to drill down or filter.` })),
      h('div', { class: 'row-gap adm-actions' },
        h('div', { class: 'seg small', role: 'group', 'aria-label': 'Period' }, [['all', 'All time'], ['90', '90 days'], ['30', '30 days'], ['7', '7 days']].map(([k, t]) => h('button', {
          type: 'button', class: 'seg-btn' + (S.period === k ? ' on' : ''), 'aria-pressed': String(S.period === k), onclick: () => { S.period = k; rerender(); },
        }, t))),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => exportCsv(ds) }, icon('download'), 'CSV'),
        demoAt ? h('button', { type: 'button', class: 'btn ghost small', onclick: clearDemo }, icon('trash'), 'Clear demo')
          : h('button', { type: 'button', class: 'btn ghost small', onclick: loadDemo }, icon('sparkle'), 'Load demo data'))),

    demoAt ? h('div', { class: 'adm-banner demo' }, icon('sparkle'), h('span', {}, h('strong', { text: 'Demo data is showing' }), ` for the plants that are not live yet, loaded ${fmt.ago(demoAt)}. It stays on this device. `,
      h('button', { type: 'button', class: 'link-btn', onclick: clearDemo, text: 'Clear it' }))) : null,
    sync.kind === 'off' ? h('div', { class: 'adm-banner' }, icon('cloudOff'), h('span', {}, 'This device is not connected to the team log, so only its own observations show. ', h('a', { href: '#setup', text: 'Connect it in Setup' }), ' to see every plant.')) : null,

    h('nav', { class: 'adm-crumbs', 'aria-label': 'Drill path' }, crumbs.map(([lvl, name, ico, here], i) => [
      i ? icon('chevronRight', 'adm-sep') : null,
      h('button', { type: 'button', class: 'adm-crumb' + (here ? ' on' : ''), 'aria-current': here ? 'page' : null, onclick: () => (lvl === 'bu' ? drill('bu') : lvl === 'plant' ? drill('plant', S.plant) : lvl === 'line' ? (S.run = '', rerender()) : null) }, icon(ico), name),
    ])),

    active.length ? h('div', { class: 'adm-filters' }, icon('filter'), active.map(d => h('button', { type: 'button', class: 'chip small on', onclick: () => toggle(d, S[d]) }, `${NAME[d](S[d])}`, icon('close'))),
      h('button', { type: 'button', class: 'link-btn small', onclick: () => { for (const d of FILTERS) S[d] = ''; rerender(); }, text: 'Clear filters' })) : null,

    h('div', { class: 'adm-tiles' },
      S.plant ? tile('line', 'Lines observed', fmt.int(new Set(withData.map(x => x.lineId)).size), plant ? `of ${plant.lines.length}` : '')
        : tile('factory', 'Plants with data', fmt.int(new Set(withData.map(x => x.plantId)).size), `of ${unit.plants.length}`),
      tile('clock', 'Observations', fmt.int(withData.length), (() => { const n = new Set(withData.map(x => x.lineId)).size; return `on ${n} ${n === 1 ? 'line' : 'lines'}`; })()),
      tile('hand', 'Touches', fmt.int(rows.reduce((s, t) => s + t._n, 0)), `${fmt.int(rows.length)} rows`),
      tile('timer', 'Mapped hours', fmt.dec(sum / 60, 1), cap ? `${fmt.pct(sum / 60 / cap)} of ${fmt.dec(cap, 0)} op-hours` : ''),
      tile('layers', 'Planned share', plannedMin + unplannedMin ? fmt.pct(plannedMin / (plannedMin + unplannedMin)) : '–', `${fmt.dec(unplannedMin / 60, 1)} h unplanned`),
      tile('users', 'Observers', fmt.int(obs.size), catTally[0] ? `Top: ${catTally[0].key} ${CAT_BY_CODE[catTally[0].key]?.short || ''}` : '')),

    h('section', { class: 'card adm-card' },
      h('div', { class: 'chart-head' }, h('h2', { class: 'card-h' }, icon(kidsAll.level === 'plant' ? 'factory' : kidsAll.level === 'line' ? 'line' : kidsAll.level === 'run' ? 'clock' : 'pin'), levelTitle),
        h('span', { class: 'muted small', text: kidsAll.level === 'zone' ? 'Tap a zone to filter' : `Tap a ${kidsAll.noun} to open it` })),
      childCards(kidsAll)),

    h('div', { class: 'grid-2' },
      card(`Planned vs unplanned by ${kidsAll.noun}`, 'chart', byChild(kidsAll), { note: 'Mapped minutes in each, split planned and unplanned. Tap a column to open it.' }),
      card('Where the minutes go', 'trend', (() => {
        const types = K.shareLevel === 'types';
        const all = [...tally(scoped(ds, 'category'), t => t.category || '').values()].filter(v => v.key).sort((a, b) => b.minutes - a.minutes);
        const allItems = toItems(all, { label: v => CAT_BY_CODE[v.key]?.name || v.key, colour: v => (CAT_BY_CODE[v.key]?.planned ? COLOUR.Planned : COLOUR.Unplanned),
          rich: v => h('span', { class: 'bl' }, h('span', { class: 'code ' + (CAT_BY_CODE[v.key]?.planned ? 'code-p' : 'code-u'), text: v.key }), icon(categoryIcon(v.key), 'lbl-ico'), h('span', { text: CAT_BY_CODE[v.key]?.short || v.key })) });
        if (!allItems.length) return h('p', { class: 'empty', text: 'Nothing logged in this scope yet.' });
        if (K.share === 'donut') return donut(allItems, ctxFor('category'), { centre: fmt.dec(total(scoped(ds, 'category')) / 60, 0), caption: 'hours', ariaLabel: 'Minutes by category', maxParts: 6 });
        if (K.share === 'table') return itemsTable(allItems, { label: 'Category', cum: true });
        // the Pareto, with the same columns as in Analysis
        const by = K.shareBy;
        const mv = (v) => (by === 'touches' ? v.touches : v.minutes);
        const typeRows = [...tally(scoped(ds, types ? 'type' : 'category'), typeKey).values()].filter(v => v.key).map(v => {
          const [code, name] = v.key.split('\u0000'); return { ...v, code, name };
        });
        const rows = types
          ? typeRows.map(v => { const c = CAT_BY_CODE[v.code]; return { key: v.key, code: v.code, planned: c ? c.planned : null, icon: categoryIcon(v.code), category: c?.short || v.code, categoryFull: c?.name, type: v.name, minutes: v.minutes, touches: v.touches, colour: c?.planned ? COLOUR.Planned : COLOUR.Unplanned }; })
          : all.map(v => {
            const c = CAT_BY_CODE[v.key];
            const mine = typeRows.filter(r => r.code === v.key).sort((x, y) => mv(y) - mv(x));
            return { key: v.key, code: v.key, planned: c ? c.planned : null, icon: categoryIcon(v.key), category: c?.short || v.key, categoryFull: c?.name, type: mine[0]?.name || '', typeMore: Math.max(0, mine.length - 1), minutes: v.minutes, touches: v.touches, colour: c?.planned ? COLOUR.Planned : COLOUR.Unplanned };
          });
        const shown = types ? [...rows].sort((x, y) => mv(y) - mv(x)).slice(0, 25) : rows;
        return h('div', { class: 'pareto' },
          rankList(shown, ctxFor(types ? 'type' : 'category'), { cfg: colsFor('adm-category'), measure: by, mode: types ? 'types' : 'categories', onCfg: (cfg) => { setCols('adm-category', cfg); rerender(); } }),
          h('details', { class: 'tbl-wrap' }, h('summary', { text: 'Table with the cumulative share' }),
            itemsTable(rows.map(r => ({ key: r.key, label: [r.code, types ? r.type : r.categoryFull || r.category].filter(Boolean).join(' · '), value: r.minutes, touches: r.touches })), { label: types ? 'Type of touch' : 'Category', cum: true })));
      })(), { kinds: ['pareto', 'donut', 'table'], kind: K.share, onKind: (k) => { K.share = k; rerender(); },
        note: 'By category, biggest first with the top three marked. Tap one to filter the page.',
        tools: K.share === 'pareto' ? columnsButton('adm-category', { mode: K.shareLevel, onChange: rerender }) : null,
        before: K.share === 'pareto' ? h('div', { class: 'card-tools adm-rank-tools' },
          h('div', { class: 'seg small', role: 'group', 'aria-label': 'Detail' }, [['categories', 'Categories', 'chevrons-down-up'], ['types', 'All types', 'chevrons-up-down']].map(([k, t, ico]) => h('button', {
            type: 'button', class: 'seg-btn' + (K.shareLevel === k ? ' on' : ''), 'aria-pressed': String(K.shareLevel === k), onclick: () => { K.shareLevel = k; rerender(); } }, icon(ico), t))),
          h('div', { class: 'seg small rank-by', role: 'group', 'aria-label': 'Rank by' }, h('span', { class: 'seg-lbl', text: 'Rank by' }), [['minutes', 'Minutes', 'timer'], ['touches', 'Touches', 'hand']].map(([k, t, ico]) => h('button', {
            type: 'button', class: 'seg-btn' + (K.shareBy === k ? ' on' : ''), 'aria-pressed': String(K.shareBy === k), onclick: () => { K.shareBy = k; rerender(); } }, icon(ico), t)))) : null })),

    h('div', { class: 'grid-2' },
      card('Physical vs information', 'hand', (() => {
        const m = tally(scoped(ds, 'touchType'), t => t.touchType || '');
        const items = toItems(['Physical', 'Information'].map(k => m.get(k)).filter(Boolean), { colour: v => COLOUR[v.key] });
        const sumTT = items.reduce((s, i) => s + i.value, 0);
        return items.length ? donut(items, ctxFor('touchType'), { centre: fmt.pct(sumTT ? (m.get('Physical')?.minutes || 0) / sumTT : null), caption: 'physical', ariaLabel: 'Physical vs information minutes' }) : h('p', { class: 'empty', text: 'Nothing logged yet.' });
      })(), { note: 'Physical touches point to automation; information touches to digitalisation.' }),
      card('By zone / equipment', 'pin', (() => {
        const list = [...tally(scoped(ds, 'zone'), t => t.zone || '').values()].filter(v => v.key).sort((a, b) => b.minutes - a.minutes);
        const items = toItems(list, { colour: v => zoneColour(v.key) || COLOUR.single, rich: v => withIcon(zoneIcon(v.key), v.key) });
        if (!items.length) return h('p', { class: 'empty', text: 'Nothing logged yet.' });
        return K.zone === 'columns' ? columns(items.map(i => ({ key: i.key, label: i.label, short: i.label.split(' ')[0], segs: [{ value: i.value, colour: i.colour }], rest: i.rest })), ctxFor('zone'), { xRotate: true })
          : K.zone === 'table' ? itemsTable(items, { label: 'Zone' }) : hbars(items, ctxFor('zone'));
      })(), { kinds: ['bars', 'columns', 'table'], kind: K.zone, onKind: (k) => { K.zone = k; rerender(); } })),

    card(`Category heat by ${kidsAll.noun}`, 'grid', heatMatrix(kidsAll, scoped(ds, 'category')), { note: 'Minutes per category in each. Darker is more. Tap a name to open it, a cell to filter by its category.' }),

    h('div', { class: 'grid-2' },
      card('Trend by day', 'trend', trend(rows), { note: 'Planned and unplanned minutes on each observation day in this scope.' }),
      card('Top touch types', 'tag', topTypes(scoped(ds, 'type'), ds), { note: 'The twelve types with the most minutes. “Plants” counts where each appears.' })),

    card('Observations', 'clock', runTable(ds, rows), { note: 'Every observation in this scope, newest first. Coverage is mapped hours against the run’s operator-hours.' }),
    card('Observers', 'users', observers(rows, ds), { note: 'Who logged the touches in this scope, from the name each device signs touches with.' })));
}
