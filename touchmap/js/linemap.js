// The K3 line as a tappable drawing: every zone opens the touches that happen there,
// with the framework's how-to-count guide, and can pre-fill Capture.
// The drawing is a schematic of the line's flow, not an engineering layout.
import { CAT_BY_CODE, CATEGORIES, typeInfo } from './framework.js';
import { totalMinutes, setCategory, setType, fmtMin } from './model.js';
import { state, save, activeRun } from './store.js';
import { h, clear, icon, toast, openModal, closeModal, fmt } from './ui.js';
import { createBoard, bodyBox } from './board.js';
import { diagramDoc, defaultDiagram, zonesOnDiagram } from './diagram.js';
import { zoneColour } from './colors.js';

import { ZONE_INFO, ON_EVERY_MACHINE } from './zonemap.js';
export { ZONE_INFO, ON_EVERY_MACHINE };

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

/** Types for a zone, from the framework in use (so Setup edits, renames and hides show here). */
function typesAt(zone) {
  return CATEGORIES.flatMap(c => c.types.filter(t => !t.hidden && (t.zones || []).includes(zone)).map(t => [c.code, t.name]));
}
/** Types that can happen on any machine. */
function everywhere() {
  return CATEGORIES.flatMap(c => c.types.filter(t => !t.hidden && t.everywhere).map(t => [c.code, t.name]));
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
      h('summary', {}, `Plus on every machine (${everywhere().length}): safety, maintenance, breakdowns, defects`),
      h('div', { class: 'zt-list' }, group(everywhere()))) : null),
  { label: zone, wide: true });
}

/* ---------- the card on the Guide tab ---------- */
const view = { mode: 'guide' };

export function lineMapCard() {
  const card = h('section', { class: 'card linemap-card' });
  const run = activeRun();
  let board = null;

  function paint() {
    const doc = diagramDoc();
    const zonesHere = zonesOnDiagram(doc);
    const counts = {};
    let max = 0;
    for (const z of new Set([...zonesHere, ...state.lists.zones])) { counts[z] = loggedAt(z); max = Math.max(max, counts[z].minutes); }
    const heat = view.mode === 'run';
    const badged = new Set();
    const host = h('div', { class: 'linemap-host' });

    clear(card,
      h('div', { class: 'card-tools' },
        h('div', {},
          h('h2', { class: 'card-h' }, icon('map'), 'The K3 line: tap a zone'),
          h('p', { class: 'muted small', text: heat
            ? `Shaded by minutes logged in ${run.name}; badges show touches.`
            : 'Badges count the touch types at each zone. Tap one for how to count each, and to start logging.' })),
        h('div', { class: 'row-gap' },
          h('div', { class: 'seg small', role: 'group', 'aria-label': 'Map shows' },
            [['guide', 'What to log where'], ['run', 'This run']].map(([k, label]) => h('button', {
              type: 'button', class: 'seg-btn' + (view.mode === k ? ' on' : ''), 'aria-pressed': String(view.mode === k),
              onclick: () => { view.mode = k; paint(); },
            }, label))),
          h('a', { class: 'btn ghost small', href: '#diagram' }, icon('edit'), 'Edit diagram'))),
      h('div', { class: 'linemap-scroll' }, host),
      h('p', { class: 'muted small lm-scroll-hint', text: 'Scroll sideways to see the whole line.' }),
      h('div', { class: 'lm-chips' },
        h('span', { class: 'muted small', text: 'Or pick a zone: ' }),
        zonesHere.map(zone => h('button', { type: 'button', class: 'chip small', onclick: () => openZone(zone) }, zone))),
      state.lists.zones.some(z => !zonesHere.includes(z)) ? h('div', { class: 'lm-added' },
        h('span', { class: 'muted small' }, icon('plus'), ' Not on the drawing yet: '),
        state.lists.zones.filter(z => !zonesHere.includes(z)).map(zone => h('button', { type: 'button', class: 'chip small', onclick: () => openZone(zone) }, icon('pin'), zone))) : null,
      heat && !run.touches.length ? h('p', { class: 'muted small', text: 'Nothing logged in this run yet: the map fills in as you log.' }) : null);

    board?.destroy();
    board = createBoard(host, {
      doc, mode: 'view', label: 'The K3 line, zone by zone',
      onShapeClick: (sh) => openZone(sh.zone),
      zoneLabel: (sh) => { const c = counts[sh.zone]; return `${sh.zone}. ${typesAt(sh.zone).length} typical touches${c?.rows ? `. Logged in this run: ${c.touches} touches, ${fmtMin(c.minutes)} minutes` : ''}`; },
      fillFor: (sh) => {
        if (!sh.zone || sh.fill !== 'auto') return null;
        if (heat) { const hv = heatOf(counts[sh.zone]?.minutes, max); return hv ? hv.fill : (sh.type === 'line' ? null : '#FFFFFF'); }
        const zc = zoneColour(sh.zone);
        return zc ? tint(zc, 0.28) : null;
      },
      decorate: (sh, g) => {
        if (!sh.zone || sh.type === 'line' || badged.has(sh.zone)) return;
        badged.add(sh.zone);
        const n = heat ? (counts[sh.zone]?.touches || 0) : typesAt(sh.zone).length;
        if (heat && !n) return;
        const label = heat ? fmt.int(n) : String(n);
        const w = Math.max(26, 10 + label.length * 8);
        // on the outline's top-right corner (a circle's shoulder); beside a text label
        const b = bodyBox(sh);
        const round = b.type === 'ellipse';
        const [bx, by] = b.type === 'text' ? [b.x + b.w + 8 + w / 2, b.y + b.h / 2]
          : round ? [b.x + b.w * 0.9, b.y + b.h * 0.1] : [b.x + b.w - 4, b.y + 4];
        const NS = 'http://www.w3.org/2000/svg';
        const badge = document.createElementNS(NS, 'g'); badge.setAttribute('class', 'lm-badge' + (heat ? ' run' : ''));
        const r = document.createElementNS(NS, 'rect'); Object.entries({ x: bx - w / 2, y: by - 13, width: w, height: 26, rx: 13 }).forEach(([k, v]) => r.setAttribute(k, v));
        const t = document.createElementNS(NS, 'text'); Object.entries({ x: bx, y: by + 5, class: 'lm-badge-t' }).forEach(([k, v]) => t.setAttribute(k, v)); t.textContent = label;
        badge.append(r, t); g.append(badge);
        if (heat && heatOf(counts[sh.zone]?.minutes, max)?.dark) g.classList.add('hot-dark');
      },
    });
    board.svg.classList.add('linemap');
  }
  paint();
  return card;
}

/** A light tint of a colour, for zone fills behind dark text. */
function tint(hex, k) {
  const n = (i) => parseInt(hex.slice(i, i + 2), 16);
  const mix = (c) => Math.round(255 - (255 - c) * k);
  return `rgb(${mix(n(1))},${mix(n(3))},${mix(n(5))})`;
}

export const ZONE_KEYS = zonesOnDiagram(defaultDiagram());
