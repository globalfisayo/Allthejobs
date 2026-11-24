// The K3 line as a tappable drawing: every zone opens the touches that happen there,
// with the framework's how-to-count guide, and can pre-fill Capture.
// The drawing is a schematic of the line's flow, not an engineering layout.
import { CAT_BY_CODE, CATEGORIES, typeInfo } from './framework.js';
import { totalMinutes, setCategory, setType, fmtMin } from './model.js';
import { state, save, activeRun } from './store.js';
import { h, clear, icon, toast, openModal, closeModal, fmt } from './ui.js';

/* ---------- what happens where (all 74 types appear at least once) ---------- */
export const ON_EVERY_MACHINE = [
  ['P5', 'Pre-start & safety device checks'], ['P5', 'LOTO for planned work'], ['P5', 'Work permit'],
  ['P6', 'CIL route (clean, inspect, lubricate)'], ['P6', 'Planned PM job'], ['P6', 'AM readings & records'],
  ['U1', 'Mechanical failure or major jam'], ['U1', 'Electrical, pneumatic or drive failure'], ['U1', 'Control / PLC / HMI fault'],
  ['U1', 'LOTO & restart after repair'], ['U1', 'Breakdown calls & records'],
  ['U2', 'Nuisance trip reset'], ['U2', 'Recording the stop reason'],
  ['U6', 'Air, CO2, power or cooling drop'],
  ['U7', 'Defect tag, reporting & monitoring'], ['U7', 'Workaround on a running defect'], ['U7', 'Setting change for a defect'],
  ['U7', 'Early fix: worn part, leak or loose part'], ['U7', 'Misalignment or sensor fixed'],
];

export const ZONE_INFO = {
  'Line-side store': {
    machine: false,
    blurb: 'Staged material next to the line: preforms, caps, labels, film, cartons, pallets, glue and ink.',
    types: [['P7', 'Calling for material'], ['P7', 'Material Return'], ['P7', 'Other packaging, consumables & waste'],
      ['P1', 'New SKU material swap & line clearance'], ['U4', 'Chasing or reporting a material problem'],
      ['U5', 'Hold, sorting & rework of held stock'], ['U6', 'Downstream blockage (warehouse / forklift)']],
  },
  'Preform feed': {
    machine: true,
    blurb: 'Preforms tipped from boxes into the hopper; the elevator and infeed rail carry them to the blow moulder.',
    types: [['P7', 'Preform loading'], ['P7', 'Calling for material'], ['P7', 'Material Return'],
      ['P1', 'New SKU material swap & line clearance'], ['U4', 'Preform problem'],
      ['U4', 'Chasing or reporting a material problem'], ['U2', 'Jam or pile-up cleared']],
  },
  'Blow moulder': {
    machine: true,
    blurb: 'Heats the preforms in the oven and stretch-blows them into bottles in the moulds.',
    types: [['P1', 'Parts change'], ['P1', 'Loading recipe'], ['P3', 'Blow moulder settings'],
      ['P4', 'Container & pack checks'], ['P4', 'Production startup checks'], ['U2', 'Blown / burst bottles'],
      ['U2', 'Jam or pile-up cleared'], ['U3', 'Process correction after a defect'], ['U3', 'Defect removal by hand'],
      ['U5', 'Re-sample, re-test & re-validation'], ['U5', 'Corrections after OOS']],
  },
  Labeller: {
    machine: true,
    blurb: 'Labels the empty bottles inside the block, between the blow moulder and the filler.',
    types: [['P1', 'Parts change'], ['P1', 'Loading recipe'], ['P1', 'New SKU material swap & line clearance'],
      ['P3', 'labeller & coder settings'], ['P7', 'Label & film reel change'], ['U4', 'Label, film & packaging problem'],
      ['U2', 'Jam or pile-up cleared'], ['U3', 'Defect removal by hand']],
  },
  Filler: {
    machine: true,
    blurb: 'Fills the bottles with product from the mixer; the hygienic heart of the block.',
    types: [['P1', 'Parts change'], ['P1', 'Loading recipe'], ['P3', 'Filler, mixer capper set-points'],
      ['P2', 'CIP set-up & strip-down'], ['P2', 'Foam / wet cleaning (COP)'], ['P4', 'Container & pack checks'],
      ['P4', 'Production startup checks'], ['U2', 'Blown / burst bottles'], ['U3', 'Process correction after a defect'],
      ['U5', 'Corrections after OOS'], ['U5', 'Glass / foreign-body incident clearance']],
  },
  Capper: {
    machine: true,
    blurb: 'Screws the closures on straight after filling, fed from the cap hopper.',
    types: [['P1', 'Parts change'], ['P7', 'Closure / cap loading'], ['P3', 'Filler, mixer capper set-points'],
      ['P4', 'Container & pack checks'], ['P2', 'Foam / wet cleaning (COP)'], ['U4', 'Closure / cap problem'],
      ['U2', 'Jam or pile-up cleared']],
  },
  'Mixer / carbo': {
    machine: true,
    blurb: 'Mixes syrup and treated water to the recipe Brix and carbonates it before the filler.',
    types: [['P1', 'Adjusting Brix'], ['P1', 'Loading recipe'], ['P3', 'Filler, mixer capper set-points'],
      ['P4', 'Brix / CO2 sampling & test'], ['P2', 'CIP start, checks & records'], ['U4', 'Syrup / ingredient problem'],
      ['U5', 'Re-sample, re-test & re-validation'], ['U5', 'Corrections after OOS']],
  },
  'CIP / utilities': {
    machine: true,
    blurb: 'Cleaning-in-place skid and the supplies the line draws on: compressed air, CO2, water, steam, power.',
    types: [['P2', 'CIP start, checks & records'], ['P2', 'CIP set-up & strip-down'], ['P2', 'Chemical top-up / container change'],
      ['P2', 'Post-CIP rinse & swab sampling'], ['P4', 'Recording QC results & readings'], ['U6', 'Air, CO2, power or cooling drop'],
      ['U6', 'Water, steam or IT unavailable'], ['U6', 'Reporting an outside problem']],
  },
  Coder: {
    machine: true,
    blurb: 'Prints the date and batch code on each bottle after capping.',
    types: [['P3', 'labeller & coder settings'], ['P7', 'Other packaging, consumables & waste'],
      ['P4', 'Container & pack checks'], ['U3', 'Defect removal by hand']],
  },
  'Inspection / rejects': {
    machine: true,
    blurb: 'Fill-level, closure and code inspectors push faulty bottles to the reject table.',
    types: [['P4', 'Inspector function test (test bottles)'], ['U3', 'Rejection handling'], ['U3', 'Recording rejects / scrap'],
      ['U3', 'Defect removal by hand'], ['U5', 'Re-sample, re-test & re-validation'], ['U5', 'Hold, sorting & rework of held stock']],
  },
  Conveyors: {
    machine: true,
    blurb: 'Bottle and pack conveyors linking the machines, with accumulation tables in between.',
    types: [['U2', 'Fallen bottles'], ['U2', 'Jam or pile-up cleared'], ['P3', 'Line speed & packer'],
      ['P4', 'Hygiene & foreign-body rounds'], ['U5', 'Glass / foreign-body incident clearance']],
  },
  'Packer / shrink': {
    machine: true,
    blurb: 'Groups bottles into packs, wraps them in film and shrinks the film in the tunnel.',
    types: [['P1', 'Parts change'], ['P3', 'Line speed & packer'], ['P7', 'Label & film reel change'],
      ['P7', 'Other packaging, consumables & waste'], ['U4', 'Label, film & packaging problem'],
      ['U2', 'Jam or pile-up cleared'], ['U3', 'Defect removal by hand']],
  },
  Palletiser: {
    machine: true,
    blurb: 'Builds the packs into layers on a pallet, with slip-sheets, ready for stretch wrapping.',
    types: [['P3', 'Palletizer Setting'], ['P1', 'Loading recipe'], ['P7', 'Other packaging, consumables & waste'],
      ['U3', 'Sorting, rework & pallet rework (no hold)'], ['U6', 'Downstream blockage (warehouse / forklift)'],
      ['P8', 'System bookings & traceability'], ['U5', 'Hold, sorting & rework of held stock']],
  },
  'Control room / office': {
    machine: false,
    blurb: 'Desk, PC and boards: reports, bookings, meetings, look-ups and records made away from the machine.',
    types: [['P8', 'Shift / production report'], ['P8', 'System bookings & traceability'], ['P8', 'Re-typing numbers (Excel, e-mail, chat)'],
      ['P8', 'Handover, meetings & planned calls'], ['P8', 'Plan & SOP look-ups'], ['P4', 'Recording QC results & readings'],
      ['P5', 'Work permit'], ['P6', 'AM readings & records'], ['U1', 'Breakdown calls & records'], ['U3', 'Recording rejects / scrap'],
      ['U4', 'Chasing or reporting a material problem'], ['U5', 'Deviation records, investigation & QA calls'],
      ['U6', 'Short-notice plan change'], ['U6', 'Reporting an outside problem'], ['U7', 'Defect tag, reporting & monitoring']],
  },
  Other: {
    machine: false,
    blurb: 'Anywhere else on the line: walkways, floors, between machines. Name the place in the task description.',
    types: [['P5', 'BOS / safety observation'], ['P5', '5S & dry housekeeping'], ['P4', 'Hygiene & foreign-body rounds'],
      ['U5', 'Glass / foreign-body incident clearance'], ['P8', 'Handover, meetings & planned calls'], ['U6', 'Short-notice plan change']],
  },
};

/* ---------- drawing ---------- */
const SVGNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k) el.append(k);
  return el;
}
function t(x, y, text, cls = 'lm-label', anchor = 'middle') {
  const el = s('text', { x, y, class: cls, 'text-anchor': anchor });
  el.textContent = text;
  return el;
}
const ring = (cx, cy, r, n, size, cls = 'lm-detail') => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return s('rect', { x: cx + r * Math.cos(a) - size / 2, y: cy + r * Math.sin(a) - size / 2, width: size, height: size, rx: 2, class: cls });
});

// Each zone: its drawing (body = the shape that carries heat), where its label and count badge go.
const ZONES = {
  'Line-side store': { badge: [196, 36], draw: () => [
    s('rect', { x: 30, y: 30, width: 170, height: 120, rx: 12, class: 'lm-body' }),
    ...[0, 1, 2].map(i => s('g', {}, s('rect', { x: 46 + i * 50, y: 60, width: 38, height: 40, rx: 3, class: 'lm-detail' }), s('rect', { x: 44 + i * 50, y: 100, width: 42, height: 7, rx: 2, class: 'lm-detail' }))),
    t(115, 134, 'Line-side store')] },
  'Preform feed': { badge: [172, 206], draw: () => [
    s('path', { d: 'M40 206 H172 L146 286 H66 Z', class: 'lm-body' }),
    s('rect', { x: 94, y: 286, width: 24, height: 64, rx: 3, class: 'lm-detail' }),
    s('path', { d: 'M118 300 C170 300 190 300 248 300', class: 'lm-rail' }),
    ...[0, 1, 2, 3].map(i => s('rect', { x: 70 + i * 20, y: 226, width: 10, height: 26, rx: 4, class: 'lm-preform' })),
    t(106, 374, 'Preform feed')] },
  'Blow moulder': { badge: [400, 228], draw: () => [
    s('circle', { cx: 330, cy: 300, r: 80, class: 'lm-body' }),
    s('circle', { cx: 330, cy: 300, r: 48, class: 'lm-detail' }),
    ...ring(330, 300, 64, 14, 12),
    t(330, 305, 'Blow', 'lm-inner'), t(330, 322, 'moulder', 'lm-inner')] },
  Labeller: { badge: [530, 256], draw: () => [
    s('circle', { cx: 492, cy: 300, r: 46, class: 'lm-body' }),
    ...ring(492, 300, 56, 8, 10),
    t(492, 305, 'Labeller', 'lm-inner')] },
  Filler: { badge: [692, 234], draw: () => [
    s('circle', { cx: 632, cy: 300, r: 72, class: 'lm-body' }),
    s('circle', { cx: 632, cy: 300, r: 42, class: 'lm-detail' }),
    ...ring(632, 300, 58, 18, 8),
    t(632, 305, 'Filler', 'lm-inner')] },
  Capper: { badge: [770, 270], draw: () => [
    s('circle', { cx: 748, cy: 300, r: 26, class: 'lm-body' }),
    ...ring(748, 300, 15, 6, 7),
    t(748, 350, 'Capper')] },
  'Mixer / carbo': { badge: [690, 44], draw: () => [
    s('path', { d: 'M632 128 V228', class: 'lm-pipe' }),
    s('rect', { x: 560, y: 40, width: 135, height: 88, rx: 22, class: 'lm-body' }),
    s('path', { d: 'M580 70 H675', class: 'lm-detail-line' }),
    t(627, 102, 'Mixer / carbo', 'lm-inner')] },
  'CIP / utilities': { badge: [898, 44], draw: () => [
    s('path', { d: 'M770 128 V180', class: 'lm-pipe' }),
    s('rect', { x: 730, y: 40, width: 170, height: 88, rx: 12, class: 'lm-body' }),
    s('circle', { cx: 765, cy: 74, r: 18, class: 'lm-detail' }), s('circle', { cx: 810, cy: 74, r: 18, class: 'lm-detail' }),
    s('path', { d: 'M840 62 h44 M840 74 h44 M840 86 h44', class: 'lm-detail-line' }),
    t(815, 116, 'CIP / utilities', 'lm-inner')] },
  Coder: { badge: [854, 276], draw: () => [
    s('rect', { x: 800, y: 276, width: 52, height: 48, rx: 6, class: 'lm-body' }),
    s('path', { d: 'M812 292 h28 M812 302 h20', class: 'lm-detail-line' }),
    t(826, 346, 'Coder')] },
  'Inspection / rejects': { badge: [956, 268], draw: () => [
    s('rect', { x: 880, y: 266, width: 74, height: 64, rx: 6, class: 'lm-body' }),
    s('circle', { cx: 917, cy: 292, r: 11, class: 'lm-detail' }),
    s('rect', { x: 886, y: 338, width: 62, height: 24, rx: 4, class: 'lm-detail' }),
    t(917, 244, 'Inspection / rejects'), t(917, 378, 'reject table', 'lm-small')] },
  Conveyors: { badge: [990, 430], draw: () => [
    s('path', { d: 'M774 300 H975 V520 H590', class: 'lm-conveyor lm-body-stroke' }),
    s('path', { d: 'M774 300 H975 V520 H590', class: 'lm-conveyor-marks' }),
    s('path', { d: 'M774 300 H975 V520 H590', class: 'lm-hit' }),
    t(962, 440, 'Conveyors', 'lm-label', 'end')] },
  'Packer / shrink': { badge: [880, 486], draw: () => [
    s('rect', { x: 660, y: 488, width: 220, height: 64, rx: 10, class: 'lm-body' }),
    ...[0, 1, 2, 3].map(i => s('path', { d: `M${760 + i * 26} 494 q13 26 0 52`, class: 'lm-detail-line' })),
    s('rect', { x: 672, y: 504, width: 72, height: 32, rx: 4, class: 'lm-detail' }),
    t(770, 576, 'Packer / shrink')] },
  Palletiser: { badge: [584, 470], draw: () => [
    s('rect', { x: 446, y: 470, width: 136, height: 100, rx: 10, class: 'lm-body' }),
    ...[0, 1, 2].map(i => s('rect', { x: 470, y: 486 + i * 18, width: 88, height: 15, rx: 2, class: 'lm-detail' })),
    s('rect', { x: 466, y: 540, width: 96, height: 8, rx: 2, class: 'lm-detail' }),
    t(514, 592, 'Palletiser')] },
  'Control room / office': { badge: [200, 452], draw: () => [
    s('rect', { x: 30, y: 452, width: 170, height: 118, rx: 12, class: 'lm-body' }),
    s('rect', { x: 62, y: 474, width: 52, height: 34, rx: 4, class: 'lm-detail' }),
    s('rect', { x: 124, y: 474, width: 52, height: 34, rx: 4, class: 'lm-detail' }),
    t(115, 538, 'Control room', 'lm-inner'), t(115, 556, '/ office', 'lm-inner')] },
  Other: { badge: [404, 474], draw: () => [
    s('rect', { x: 236, y: 474, width: 168, height: 86, rx: 43, class: 'lm-body lm-other' }),
    t(320, 512, 'Other', 'lm-inner'), t(320, 532, 'anywhere on the line', 'lm-small')] },
};

/* ---------- data for one zone ---------- */
function loggedAt(zone) {
  const run = activeRun();
  const rows = run.touches.filter(x => x.zone === zone);
  const byType = new Map();
  for (const r of rows) {
    const k = `${r.category}\u0000${r.type}`;
    const v = byType.get(k) || { code: r.category, type: r.type || 'Type not set', touches: 0, minutes: 0 };
    v.touches += Number(r.count) || 0; v.minutes += totalMinutes(r);
    byType.set(k, v);
  }
  const types = [...byType.values()].sort((a, b) => b.minutes - a.minutes);
  return { rows: rows.length, touches: types.reduce((s2, v) => s2 + v.touches, 0), minutes: types.reduce((s2, v) => s2 + v.minutes, 0), types };
}

function heatOf(minutes, max) {
  if (!max || !minutes) return null;
  const k = minutes / max;
  // white → brand red, the analysis tab's magnitude ramp
  const lerp = (a, b) => Math.round(a + (b - a) * k);
  return { fill: `rgb(${lerp(255, 244)},${lerp(236, 0)},${lerp(237, 9)})`, dark: k > 0.55 };
}

/* ---------- prefill Capture ---------- */
function prefill(zone, code, typeName) {
  const d = state.draft;
  d.zone = zone;
  if (code) { setCategory(d, code); if (typeName) setType(d, typeName); }
  save();
  closeModal();
  location.hash = '#capture';
  toast(code ? `Ready to log: ${zone} · ${code} ${typeName}. Start the stopwatch when it begins.` : `Zone set to ${zone}.`);
}

/** Types for a zone: the built-in mapping (minus hidden types) plus types placed there in Setup. */
function typesAt(zone) {
  const base = (ZONE_INFO[zone]?.types || []).filter(([c, n]) => typeInfo(c, n) && !typeInfo(c, n).hidden);
  const extra = CATEGORIES.flatMap(c => c.types.filter(t => !t.hidden && (t.zones || []).includes(zone)).map(t => [c.code, t.name]));
  const seen = new Set();
  return [...base, ...extra].filter(([c, n]) => { const k = c + '|' + n; if (seen.has(k)) return false; seen.add(k); return true; });
}

/* ---------- popup ---------- */
export function openZone(zone) {
  const info = { ...(ZONE_INFO[zone] || { machine: true, blurb: 'An area added in Setup.' }), types: typesAt(zone) };
  const here = loggedAt(zone);
  const item = ([code, name]) => {
    const c = CAT_BY_CODE[code];
    if (!c) return null;
    const tinfo = typeInfo(code, name);
    return h('details', { class: 'zt' },
      h('summary', {},
        h('span', { class: 'code ' + (c.planned ? 'code-p' : 'code-u'), text: code }),
        h('span', { class: 'zt-name', text: name }),
        h('span', { class: 'tt-tag', text: tinfo?.touchType || '' })),
      h('div', { class: 'zt-body' },
        h('p', { class: 'zt-cat', text: c.name }),
        h('p', {}, h('strong', { text: 'How to count: ' }), tinfo?.guide || ''),
        h('button', { type: 'button', class: 'btn primary small', onclick: () => prefill(zone, code, name) }, icon('timer'), 'Log this touch')));
  };
  const group = (pairs) => {
    const byCat = new Map();
    for (const p of pairs) { if (!byCat.has(p[0])) byCat.set(p[0], []); byCat.get(p[0]).push(p); }
    return [...byCat.keys()].sort().flatMap(k => byCat.get(k)).map(item);
  };

  openModal(h('div', { class: 'zone-pop' },
    h('div', { class: 'wiz-top' },
      h('div', {}, h('h2', { text: zone }), h('p', { class: 'muted', text: info.blurb })),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close'))),
    here.rows ? h('div', { class: 'zone-run' },
      h('div', { class: 'sum-h', text: `Logged here in ${activeRun().name}` }),
      h('p', {}, h('strong', { text: `${fmt.int(here.touches)} touches · ${fmtMin(here.minutes)} min` }), ` across ${here.rows} ${here.rows === 1 ? 'row' : 'rows'}`),
      h('ul', { class: 'zone-run-list' }, here.types.slice(0, 5).map(v => h('li', {},
        h('span', { class: 'code ' + (CAT_BY_CODE[v.code]?.planned === false ? 'code-u' : CAT_BY_CODE[v.code] ? 'code-p' : 'code-x'), text: v.code || '?' }),
        h('span', { text: v.type }), h('span', { class: 'muted', text: ` ${fmt.int(v.touches)} · ${fmtMin(v.minutes)} min` }))))) : null,
    h('div', { class: 'row-gap' },
      h('button', { type: 'button', class: 'btn primary', onclick: () => prefill(zone) }, icon('timer'), 'Log a touch here')),
    h('h3', { class: 'zone-h', text: `Touches that happen here (${info.types.length})` }),
    h('p', { class: 'muted small', text: 'Tap one for how to count it, or to start logging it.' }),
    h('div', { class: 'zt-list' }, group(info.types)),
    info.machine ? h('details', { class: 'zt-shared' },
      h('summary', {}, `Plus on every machine (${ON_EVERY_MACHINE.length}): safety, maintenance, breakdowns, defects`),
      h('div', { class: 'zt-list' }, group(ON_EVERY_MACHINE.filter(([c, n]) => typeInfo(c, n) && !typeInfo(c, n).hidden)))) : null),
  { label: zone, wide: true });
}

/* ---------- the card on the Guide tab ---------- */
const view = { mode: 'guide' };

export function lineMapCard() {
  const card = h('section', { class: 'card linemap-card' });
  const run = activeRun();

  function paint() {
    const counts = {};
    let max = 0;
    for (const z of Object.keys(ZONES)) { counts[z] = loggedAt(z); max = Math.max(max, counts[z].minutes); }
    const heat = view.mode === 'run';

    const svg = s('svg', { viewBox: '0 0 1010 610', class: 'linemap' + (heat ? ' heat' : ''), role: 'group', 'aria-label': 'The K3 line, zone by zone' });
    svg.append(
      s('rect', { x: 222, y: 180, width: 560, height: 232, rx: 26, class: 'lm-block' }),
      t(242, 204, 'ERGOBLOC BLOCK', 'lm-block-label', 'start'),
      s('circle', { cx: 427, cy: 300, r: 15, class: 'lm-star' }), s('circle', { cx: 559, cy: 300, r: 13, class: 'lm-star' }), s('circle', { cx: 717, cy: 300, r: 9, class: 'lm-star' }));

    for (const [zone, z] of Object.entries(ZONES)) {
      const c = counts[zone];
      const g = s('g', { class: 'lm-zone', tabindex: '0', role: 'button', 'data-zone': zone,
        'aria-label': `${zone}. ${typesAt(zone).length} typical touches${c.rows ? `. Logged in this run: ${c.touches} touches, ${fmtMin(c.minutes)} minutes` : ''}` }, z.draw());
      if (heat) {
        const hv = heatOf(c.minutes, max);
        if (hv) { g.style.setProperty('--heat', hv.fill); g.classList.add('hot'); if (hv.dark) g.classList.add('hot-dark'); }
      }
      const n = heat ? c.touches : typesAt(zone).length;
      if (n || !heat) {
        const [bx, by] = z.badge;
        const label = heat ? fmt.int(n) : String(n);
        const w = Math.max(26, 10 + label.length * 8);
        g.append(s('g', { class: 'lm-badge' + (heat ? ' run' : '') },
          s('rect', { x: bx - w / 2, y: by - 13, width: w, height: 26, rx: 13 }),
          t(bx, by + 5, label, 'lm-badge-t')));
      }
      const open = () => openZone(zone);
      g.addEventListener('click', open);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      svg.append(g);
    }
    // Flow direction along the line, drawn on top of the conveyor.
    for (const [x, y, r] of [[212, 300, 0], [936, 300, 0], [975, 470, 90], [620, 520, 180]]) {
      svg.append(s('path', { d: 'M-7 -7 L5 0 L-7 7', transform: `translate(${x} ${y}) rotate(${r})`, class: 'lm-flow' }));
    }

    clear(card,
      h('div', { class: 'card-tools' },
        h('div', {},
          h('h2', { class: 'card-h', text: 'The K3 line: tap a zone' }),
          h('p', { class: 'muted small', text: heat
            ? `Shaded by minutes logged in ${run.name}; badges show touches. Tap a zone for what was logged and how to count it.`
            : 'Each badge is the number of touch types that typically happen there. Tap a zone to see them, with how to count each one, and start logging from there.' })),
        h('div', { class: 'seg small', role: 'group', 'aria-label': 'Map shows' },
          [['guide', 'What to log where'], ['run', 'This run']].map(([k, label]) => h('button', {
            type: 'button', class: 'seg-btn' + (view.mode === k ? ' on' : ''), 'aria-pressed': String(view.mode === k),
            onclick: () => { view.mode = k; paint(); },
          }, label)))),
      h('div', { class: 'linemap-scroll' }, svg),
      h('p', { class: 'muted small lm-scroll-hint', text: 'Scroll sideways to see the whole line.' }),
      h('div', { class: 'lm-chips' },
        h('span', { class: 'muted small', text: 'Or pick a zone: ' }),
        Object.keys(ZONES).map(zone => h('button', { type: 'button', class: 'chip small', onclick: () => openZone(zone) }, zone))),
      state.lists.zones.some(z => !ZONES[z]) ? h('div', { class: 'lm-added' },
        h('span', { class: 'muted small' }, icon('plus'), ' Added areas: '),
        state.lists.zones.filter(z => !ZONES[z]).map(zone => h('button', { type: 'button', class: 'chip small', onclick: () => openZone(zone) }, icon('pin'), zone))) : null,
      heat && !run.touches.length ? h('p', { class: 'muted small', text: 'Nothing logged in this run yet: the map fills in as you log.' }) : null);
  }
  paint();
  return card;
}

export const ZONE_KEYS = Object.keys(ZONES);
