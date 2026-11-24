// The K3 line as a tappable drawing: every zone opens the touches that happen there,
// with the framework's how-to-count guide, and can pre-fill Capture.
// The drawing is a schematic of the line's flow, not an engineering layout.
import { CAT_BY_CODE, CATEGORIES, typeInfo } from './framework.js';
import { totalMinutes, setCategory, setType, fmtMin } from './model.js';
import { state, save, activeRun, runsList, markTouch, markSetup } from './store.js';
import { h, clear, icon, iconPath, toast, openModal, closeModal, confirmBox, fmt } from './ui.js';
import { createBoard, bodyBox } from './board.js';
import { diagramDoc, defaultDiagram, zonesOnDiagram, zoneNumbers, drawingName, drawingOptions, currentDrawingId, useDrawing } from './diagram.js';
import { zoneColour } from './colors.js';
import { zoneIcon, categoryIcon, touchTypeIcon } from './iconmap.js';
import { editFramework, usage, typeEditor } from './setup.js';
import { applyFramework } from './framework.js';

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

/* ---------- changing the touches at a zone, from the popup ---------- */
const allZones = () => [...new Set([...state.lists.zones, ...zonesOnDiagram()])];
/** Undo for a framework change: put the previous framework back. */
function withUndo(label, zone, change) {
  const before = JSON.stringify(state.framework);
  change();
  toast(label, { action: { label: 'Undo', fn: () => { state.framework = JSON.parse(before); applyFramework(state.framework); markSetup(); openZone(zone, { editing: true }); } }, timeout: 7000 });
  openZone(zone, { editing: true });
}
const findType = (cats, code, name) => cats.find(c => c.code === code)?.types.find(t => t.name === name);
function moveType(code, name, from, to) {
  withUndo(`Moved “${name}” to ${to}.`, from, () => editFramework(cats => {
    const t = findType(cats, code, name);
    t.zones = [...new Set([...(t.zones || []).filter(z => z !== from), to])];
  }));
}
function unplace(code, name, zone) {
  withUndo(`“${name}” is no longer listed at ${zone}. It stays on Capture under ${code}.`, zone, () => editFramework(cats => {
    const t = findType(cats, code, name);
    t.zones = (t.zones || []).filter(z => z !== zone);
  }));
}
async function hideOrDelete(code, name, zone) {
  const used = usage(code, name);
  const ok = await confirmBox(used
    ? { title: `Hide “${name}”?`, body: `${used} logged ${used === 1 ? 'touch uses' : 'touches use'} it, so it is hidden from Capture rather than deleted. Show it again in Setup.`, ok: 'Hide it' }
    : { title: `Delete “${name}”?`, body: 'Nothing has been logged with it. It is removed from Capture and the Guide for the whole team.', ok: 'Delete', danger: true });
  if (!ok) { openZone(zone, { editing: true }); return; }
  withUndo(used ? `“${name}” hidden.` : `“${name}” deleted.`, zone, () => editFramework(cats => {
    const c = cats.find(x => x.code === code);
    if (used) findType(cats, code, name).hidden = true;
    else c.types = c.types.filter(t => t.name !== name);
  }));
}
/** Move a type to another category (and so to planned or unplanned); its logged touches follow. */
async function reclassify(code, name, to, zone) {
  if (!to || to === code) return;
  const target = CAT_BY_CODE[to];
  const used = usage(code, name);
  const flips = target.planned !== CAT_BY_CODE[code]?.planned;
  const ok = await confirmBox({
    title: `Move “${name}” to ${to}?`,
    body: `${target.name}${flips ? `: it becomes ${target.planned ? 'planned' : 'unplanned'}` : ''}. ${used ? `The ${used} logged ${used === 1 ? 'touch moves' : 'touches move'} with it.` : 'Nothing has been logged with it yet.'}`,
    ok: 'Move it',
  });
  if (!ok) { openZone(zone, { editing: true }); return; }
  const clash = target.types.some(t => t.name === name);
  const newName = clash ? `${name} (from ${code})` : name;
  editFramework(cats => {
    const from = cats.find(c => c.code === code), dest = cats.find(c => c.code === to);
    const i = from.types.findIndex(t => t.name === name);
    const [t] = from.types.splice(i, 1);
    dest.types.push({ ...t, name: newName });
  });
  const now = new Date().toISOString();
  for (const r of runsList()) for (const t of r.touches) {
    if (t.category === code && t.type === name) { t.category = to; t.type = newName; t.planned = target.planned ? 'Planned' : 'Unplanned'; t.updatedAt = now; markTouch(r, t.id); }
  }
  save();
  toast(`“${newName}” is now ${to}${used ? `, with its ${used} logged ${used === 1 ? 'touch' : 'touches'}` : ''}.`);
  openZone(zone, { editing: true });
}

/* ---------- popup ---------- */
export function openZone(zone, { editing = false } = {}) {
  const info = { ...(ZONE_INFO[zone] || { machine: true, blurb: 'An area added in Setup.' }), types: typesAt(zone) };
  const here = loggedAt(zone);
  const num = zoneNumbers()[zone];
  const reopen = () => openZone(zone, { editing: true });
  const item = ([code, name]) => {
    const c = CAT_BY_CODE[code];
    if (!c) return null;
    const tinfo = typeInfo(code, name);
    if (editing) {
      const moveSel = h('select', { class: 'zt-sel', 'aria-label': `Move ${name} to another zone` },
        h('option', { value: '', text: 'Move to…' }), allZones().filter(z => z !== zone).map(z => h('option', { value: z, text: z })));
      moveSel.addEventListener('change', () => { if (moveSel.value) moveType(code, name, zone, moveSel.value); });
      const catSel = h('select', { class: 'zt-sel', 'aria-label': `Reclassify ${name}` },
        h('option', { value: '', text: 'Reclassify…' }),
        [true, false].map(p => h('optgroup', { label: p ? 'Planned' : 'Unplanned' }, CATEGORIES.filter(x => x.planned === p && x.code !== code).map(x => h('option', { value: x.code, text: `${x.code} ${x.short}` })))));
      catSel.addEventListener('change', () => reclassify(code, name, catSel.value, zone));
      return h('div', { class: 'zt zt-edit' },
        h('div', { class: 'zt-edit-h' },
          h('span', { class: 'code ' + (c.planned ? 'code-p' : 'code-u'), text: code }),
          h('span', { class: 'zt-name', text: name }),
          h('span', { class: 'tt-tag' }, icon(touchTypeIcon(tinfo?.touchType)), tinfo?.touchType || '')),
        h('div', { class: 'zt-edit-acts' },
          moveSel, catSel,
          h('button', { type: 'button', class: 'icon-btn small', title: 'Edit name, how to count and zones', 'aria-label': `Edit ${name}`, onclick: () => typeEditor(code, typeInfo(code, name), reopen) }, icon('edit')),
          h('button', { type: 'button', class: 'icon-btn small', title: `Take it off ${zone}`, 'aria-label': `Remove ${name} from ${zone}`, onclick: () => unplace(code, name, zone) }, icon('close')),
          h('button', { type: 'button', class: 'icon-btn small danger', title: 'Hide or delete it', 'aria-label': `Hide or delete ${name}`, onclick: () => hideOrDelete(code, name, zone) }, icon('trash'))));
    }
    return h('details', { class: 'zt' },
      h('summary', {},
        h('span', { class: 'code ' + (c.planned ? 'code-p' : 'code-u'), text: code }),
        h('span', { class: 'zt-name', text: name }),
        h('span', { class: 'tt-tag' }, icon(touchTypeIcon(tinfo?.touchType)), tinfo?.touchType || '')),
      h('div', { class: 'zt-body' },
        h('p', { class: 'zt-cat' }, icon(categoryIcon(code)), ' ', c.name),
        h('p', {}, h('strong', { text: 'How to count: ' }), tinfo?.guide || ''),
        h('button', { type: 'button', class: 'btn primary small', onclick: () => prefill(zone, code, name) }, icon('timer'), 'Log this touch')));
  };
  const group = (pairs) => {
    const byCat = new Map();
    for (const p of pairs) { if (!byCat.has(p[0])) byCat.set(p[0], []); byCat.get(p[0]).push(p); }
    return [...byCat.keys()].sort().flatMap(k => byCat.get(k)).map(item);
  };
  const addSel = h('select', { class: 'zt-sel', 'aria-label': 'Category for the new touch type' },
    h('option', { value: '', text: 'In category…' }),
    [true, false].map(p => h('optgroup', { label: p ? 'Planned' : 'Unplanned' }, CATEGORIES.filter(x => x.planned === p).map(x => h('option', { value: x.code, text: `${x.code} ${x.short}` })))));
  addSel.addEventListener('change', () => { if (addSel.value) typeEditor(addSel.value, null, reopen, { zones: [zone] }); });

  openModal(h('div', { class: 'zone-pop' + (editing ? ' editing' : '') },
    h('div', { class: 'wiz-top' },
      h('div', { class: 'zp-title' },
        h('span', { class: 'zp-ico' }, icon(zoneIcon(zone))),
        h('div', {}, h('h2', {}, num != null ? h('span', { class: 'zp-num', text: String(num) }) : null, zone), h('p', { class: 'muted', text: info.blurb }))),
      h('div', { class: 'row-gap' },
        h('button', { type: 'button', class: 'btn small ' + (editing ? 'primary' : 'ghost'), 'aria-pressed': String(editing), onclick: () => openZone(zone, { editing: !editing }) }, icon(editing ? 'check' : 'edit'), editing ? 'Done editing' : 'Edit touches'),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close')))),
    !editing && here.rows ? h('div', { class: 'zone-run' },
      h('div', { class: 'sum-h', text: `Logged here in ${activeRun().name}` }),
      h('p', {}, h('strong', { text: `${fmt.int(here.touches)} touches · ${fmtMin(here.minutes)} min` }), ` across ${here.rows} ${here.rows === 1 ? 'row' : 'rows'}`),
      h('ul', { class: 'zone-run-list' }, here.types.slice(0, 5).map(v => h('li', {},
        h('span', { class: 'code ' + (CAT_BY_CODE[v.code]?.planned === false ? 'code-u' : CAT_BY_CODE[v.code] ? 'code-p' : 'code-x'), text: v.code || '?' }),
        h('span', { text: v.type }), h('span', { class: 'muted', text: ` ${fmt.int(v.touches)} · ${fmtMin(v.minutes)} min` }))))) : null,
    editing ? h('div', { class: 'zt-add' }, icon('plus'), h('strong', { text: 'Add a touch type here' }), addSel)
      : h('div', { class: 'row-gap' }, h('button', { type: 'button', class: 'btn primary', onclick: () => prefill(zone) }, icon('timer'), 'Log a touch here')),
    h('h3', { class: 'zone-h' }, h('span', { class: 'touch-ico' }, icon('pointer')), `Touches that happen here (${info.types.length})`),
    h('p', { class: 'muted small', text: editing ? 'Move one to another zone, reclassify it (planned ⇄ unplanned moves its logged touches too), take it off this zone, or hide it. Changes are shared with your team.' : 'Tap one for how to count it, or to start logging it.' }),
    h('div', { class: 'zt-list' }, group(info.types)),
    info.machine && !editing ? h('details', { class: 'zt-shared' },
      h('summary', {}, `Plus on every machine (${everywhere().length}): safety, maintenance, breakdowns, defects`),
      h('div', { class: 'zt-list' }, group(everywhere()))) : null),
  { label: zone, wide: true });
}

/* ---------- the card on the Guide tab ---------- */
const view = { mode: 'numbers' };

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

    const opts = drawingOptions();
    const picker = opts.length > 1 ? h('select', { class: 'run-pick-sel', 'aria-label': 'Which line' }, opts.map(o => h('option', { value: o.id, selected: o.id === currentDrawingId(), text: o.name }))) : null;
    picker?.addEventListener('change', () => { useDrawing(picker.value); paint(); });
    clear(card,
      h('div', { class: 'card-tools' },
        h('div', {},
          h('h2', { class: 'card-h' }, icon('map'), `The ${drawingName()} line: tap a zone`),
          h('p', { class: 'muted small', text: heat
            ? `Shaded by minutes logged in ${run.name}; badges show touches.`
            : view.mode === 'numbers' ? 'Badges number the equipment along the line. Tap a zone for its touches; Edit touches there to change them.'
              : 'Badges count the touch types at each zone. Tap one for how to count each, and to start logging.' })),
        h('div', { class: 'row-gap' },
          picker ? h('label', { class: 'run-pick' }, icon('line'), picker, icon('chevron', 'run-pick-chev')) : null,
          h('div', { class: 'seg small', role: 'group', 'aria-label': 'Badges show' },
            [['numbers', 'Numbers'], ['guide', 'Touch types', 'pointer'], ['run', 'This run', 'pointer']].map(([k, label, ico]) => h('button', {
              type: 'button', class: 'seg-btn' + (view.mode === k ? ' on' : ''), 'aria-pressed': String(view.mode === k),
              onclick: () => { view.mode = k; paint(); },
            }, ico ? h('span', { class: 'touch-ico' }, icon(ico)) : h('span', { class: 'num-ico', text: '#' }), label))),
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
        const n = heat ? (counts[sh.zone]?.touches || 0) : view.mode === 'numbers' ? sh.num : typesAt(sh.zone).length;
        if (n == null) return;
        badged.add(sh.zone);
        if (heat && !n) return;
        const label = heat ? fmt.int(n) : String(n);
        // equipment numbers: a black circle; touch counts: a yellow pill with a pointing hand
        const touch = view.mode !== 'numbers';
        const w = touch ? 32 + label.length * 8 : Math.max(26, 10 + label.length * 8);
        // on the outline's top-right corner (a circle's shoulder); beside a text label
        const b = bodyBox(sh);
        const round = b.type === 'ellipse';
        const [bx, by] = b.type === 'text' ? [b.x + b.w + 8 + w / 2, b.y + b.h / 2]
          : round ? [b.x + b.w * 0.9, b.y + b.h * 0.1] : [b.x + b.w - 4, b.y + 4];
        const NS = 'http://www.w3.org/2000/svg';
        const badge = document.createElementNS(NS, 'g'); badge.setAttribute('class', 'lm-badge' + (touch ? ' touch' : '') + (heat ? ' run' : ''));
        const r = document.createElementNS(NS, 'rect'); Object.entries({ x: bx - w / 2, y: by - 13, width: w, height: 26, rx: 13 }).forEach(([k, v]) => r.setAttribute(k, v));
        const t = document.createElementNS(NS, 'text'); Object.entries({ x: touch ? bx + 8 : bx, y: by + 5, class: 'lm-badge-t' }).forEach(([k, v]) => t.setAttribute(k, v)); t.textContent = label;
        badge.append(r, t);
        if (touch) {
          const hand = document.createElementNS(NS, 'path');
          Object.entries({ d: iconPath('pointer'), transform: `translate(${bx - w / 2 + 6} ${by - 8}) scale(0.66)`, class: 'lm-badge-ico' }).forEach(([k, v]) => hand.setAttribute(k, v));
          badge.append(hand);
        }
        g.append(badge);
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
