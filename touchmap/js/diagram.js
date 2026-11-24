// The Guide diagram: the K3 line as editable shapes. Shapes linked to a zone open that zone's
// touches in the Guide; conveyors and pipes are connectors attached to the machines.
import { state, save, markSetup, profileName } from './store.js';
import { allPlants } from './org.js';
import { FRAMEWORK } from './framework.js';
import { createBoard } from './board.js';
import { h, clear, icon, toast, confirmBox, deliverFile, stamp, slug, openModal, closeModal } from './ui.js';

export const DIAGRAM_W = 1010, DIAGRAM_H = 610;

/* ---------- drawing helpers: absolute coordinates, as on the first Guide map ---------- */
const INK = '#141414', INK3 = '#6A6A6A', LINE2 = '#CFCFCC', SURF2 = '#FAFAF9';
const body = (x = {}) => ({ fill: 'auto', stroke: INK, strokeWidth: 2, body: true, ...x });
const det = (x = {}) => ({ fill: 'none', stroke: INK3, strokeWidth: 1.5, detail: true, ...x });
const R = (x, y, w, hh, extra = {}) => ({ type: 'rect', x, y, w, h: hh, radius: 0, ...extra });
const C = (cx, cy, r, extra = {}) => ({ type: 'ellipse', x: cx - r, y: cy - r, w: r * 2, h: r * 2, ...extra });
const Ln = (x1, y1, x2, y2, extra = {}) => ({ type: 'line', x1, y1, x2, y2, from: null, to: null, stroke: INK3, strokeWidth: 1.5, detail: true, ...extra });
const Pth = (d, vb, extra = {}) => ({ type: 'path', d, vb, x: vb[0], y: vb[1], w: vb[2], h: vb[3], ...extra });
/** Text centred on cx with its first baseline at y (as SVG text was placed on the old map). */
function T(cx, y, text, { size = 15, w = 190, bold = true, colour = INK, onBody = false } = {}) {
  const lines = String(text).split('\n').length;
  const lh = size * 1.22;
  const top = y - 2 - lh * 0.78;
  return { type: 'text', x: cx - w / 2, y: top, w, h: lines * lh + 4, text, fontSize: size, bold, textColor: colour, fill: 'none', stroke: INK, strokeWidth: 0, onBody };
}
const ring = (cx, cy, r, n, size) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return R(cx + r * Math.cos(a) - size / 2, cy + r * Math.sin(a) - size / 2, size, size, det({ radius: 2 }));
});
/** A machine: its parts (absolute) become one group, linked to its zone; `label` marks the name text. */
function G(id, zone, parts, { label } = {}) {
  const boxOf = (p) => (p.type === 'line' ? { x: Math.min(p.x1, p.x2), y: Math.min(p.y1, p.y2), w: Math.abs(p.x2 - p.x1), h: Math.abs(p.y2 - p.y1) } : p);
  const bs = parts.map(boxOf);
  const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y));
  const w = Math.max(...bs.map(b => b.x + b.w)) - x, hh = Math.max(...bs.map(b => b.y + b.h)) - y;
  const children = parts.map((p, i) => {
    const c = { id: `${id}-${i}`, ...p };
    if (c.type === 'line') Object.assign(c, { x1: p.x1 - x, y1: p.y1 - y, x2: p.x2 - x, y2: p.y2 - y });
    else Object.assign(c, { x: p.x - x, y: p.y - y });
    if (label != null && i === label) c.label = true;
    return c;
  });
  return { id, type: 'group', zone, name: zone, x, y, w, h: hh, cw: w, ch: hh, children };
}

/** The K3 line as shipped: the first Guide map's drawings, now editable groups. */
export function defaultDiagram() {
  const shapes = [
    { id: 'block', type: 'rect', x: 222, y: 180, w: 560, h: 232, radius: 26, fill: SURF2, stroke: LINE2, strokeWidth: 2, text: 'ERGOBLOC BLOCK', fontSize: 12, bold: true, textColor: INK3, align: 'left', valign: 'top', caps: true },
    // conveyor: capper → inspection → round the corner → packer → palletiser, with its flow marks
    { id: 'belt', type: 'line', zone: 'Conveyors', from: { id: 'z-cap', anchor: 'e' }, to: { id: 'z-pal', anchor: 'e' }, via: [{ x: 975, y: 300 }, { x: 975, y: 520 }],
      x1: 0, y1: 0, x2: 0, y2: 0, stroke: 'auto', base: '#DCDCD8', strokeWidth: 18, dash: 'belt', route: 'straight' },
    { id: 'pipe-mix', type: 'line', from: { id: 'z-mix', anchor: 's' }, to: { id: 'z-fill', anchor: 'n' }, x1: 0, y1: 0, x2: 0, y2: 0, stroke: '#9DB9DC', strokeWidth: 7, route: 'straight' },
    { id: 'pipe-cip', type: 'line', from: { id: 'z-cip', anchor: 's' }, to: null, x1: 0, y1: 0, x2: 815, y2: 180, stroke: '#9DB9DC', strokeWidth: 7, route: 'straight' },
    { id: 'rail', type: 'line', from: null, to: { id: 'z-blow', anchor: 'w' }, x1: 118, y1: 300, x2: 0, y2: 0, stroke: INK3, strokeWidth: 3, arrowEnd: true, route: 'straight' },
    C(427, 300, 15, { id: 'star-1', fill: '#FFFFFF', stroke: LINE2, strokeWidth: 2 }),
    C(559, 300, 13, { id: 'star-2', fill: '#FFFFFF', stroke: LINE2, strokeWidth: 2 }),
    C(717, 300, 9, { id: 'star-3', fill: '#FFFFFF', stroke: LINE2, strokeWidth: 2 }),

    G('z-store', 'Line-side store', [
      R(30, 30, 170, 120, body({ radius: 12 })),
      ...[0, 1, 2].flatMap(i => [R(46 + i * 50, 60, 38, 40, det({ radius: 3 })), R(44 + i * 50, 100, 42, 7, det({ radius: 2 }))]),
      T(115, 134, 'Line-side store', { onBody: true }),
    ], { label: 7 }),
    G('z-preform', 'Preform feed', [
      { type: 'hopper', x: 40, y: 206, w: 132, h: 80, ...body() },
      R(94, 286, 24, 64, det({ radius: 3 })),
      ...[0, 1, 2, 3].map(i => R(70 + i * 20, 226, 10, 26, { radius: 4, fill: '#FFD9DB', stroke: '#C8000A', strokeWidth: 1 })),
      T(106, 374, 'Preform feed'),
    ], { label: 6 }),
    G('z-blow', 'Blow moulder', [
      C(330, 300, 80, body()), C(330, 300, 48, det()), ...ring(330, 300, 64, 14, 12),
      T(330, 305, 'Blow\nmoulder', { size: 14, w: 92, onBody: true }),
    ], { label: 16 }),
    G('z-label', 'Labeller', [
      C(492, 300, 46, body()), ...ring(492, 300, 56, 8, 10),
      T(492, 305, 'Labeller', { size: 14, w: 88, onBody: true }),
    ], { label: 9 }),
    G('z-fill', 'Filler', [
      C(632, 300, 72, body()), C(632, 300, 42, det()), ...ring(632, 300, 58, 18, 8),
      T(632, 305, 'Filler', { size: 14, w: 80, onBody: true }),
    ], { label: 20 }),
    G('z-cap', 'Capper', [
      C(748, 300, 26, body()), ...ring(748, 300, 15, 6, 7),
      T(748, 350, 'Capper', { w: 90 }),
    ], { label: 7 }),
    G('z-mix', 'Mixer / carbo', [
      R(565, 40, 135, 88, body({ radius: 22 })),
      Ln(585, 70, 680, 70, { strokeLinecap: 'round' }),
      T(632.5, 102, 'Mixer / carbo', { size: 14, w: 130, onBody: true }),
    ], { label: 2 }),
    G('z-cip', 'CIP / utilities', [
      R(730, 40, 170, 88, body({ radius: 12 })),
      C(765, 74, 18, det()), C(810, 74, 18, det()),
      Ln(840, 62, 884, 62), Ln(840, 74, 884, 74), Ln(840, 86, 884, 86),
      T(815, 116, 'CIP / utilities', { size: 14, w: 160, onBody: true }),
    ], { label: 6 }),
    G('z-coder', 'Coder', [
      R(800, 276, 52, 48, body({ radius: 6 })),
      Ln(812, 292, 840, 292), Ln(812, 302, 832, 302),
      T(826, 346, 'Coder', { w: 80 }),
    ], { label: 3 }),
    G('z-insp', 'Inspection / rejects', [
      R(880, 266, 74, 64, body({ radius: 6 })),
      C(917, 292, 11, det()),
      R(886, 338, 62, 24, det({ radius: 4 })),
      T(917, 244, 'Inspection / rejects', { w: 186 }),
      T(917, 378, 'reject table', { size: 12, bold: false, colour: INK3, w: 100 }),
    ], { label: 3 }),
    G('z-pack', 'Packer / shrink', [
      R(660, 488, 220, 64, body({ radius: 10 })),
      ...[0, 1, 2, 3].map(i => Pth(`M${760 + i * 26} 494 q13 26 0 52`, [760 + i * 26, 494, 7, 52], det())),
      R(672, 504, 72, 32, det({ radius: 4 })),
      T(770, 576, 'Packer / shrink', { w: 160 }),
    ], { label: 6 }),
    G('z-pal', 'Palletiser', [
      R(446, 470, 136, 100, body({ radius: 10 })),
      ...[0, 1, 2].map(i => R(470, 486 + i * 18, 88, 15, det({ radius: 2 }))),
      R(466, 540, 96, 8, det({ radius: 2 })),
      T(514, 592, 'Palletiser', { w: 120 }),
    ], { label: 5 }),
    G('z-ctrl', 'Control room / office', [
      R(30, 452, 170, 118, body({ radius: 12 })),
      R(62, 474, 52, 34, det({ radius: 4 })), R(124, 474, 52, 34, det({ radius: 4 })),
      T(115, 538, 'Control room\n/ office', { size: 14, w: 150, onBody: true }),
    ], { label: 3 }),
    G('z-other', 'Other', [
      R(236, 474, 168, 86, body({ radius: 43, base: SURF2 })),
      T(320, 512, 'Other', { size: 14, w: 120, onBody: true }),
      T(320, 532, 'anywhere on the line', { size: 12, bold: false, colour: INK3, w: 160, onBody: true }),
    ], { label: 1 }),
    { id: 'belt-label', type: 'text', zone: 'Conveyors', x: 852, y: 427, w: 110, h: 22, text: 'Conveyors', fill: 'none', stroke: INK, strokeWidth: 0, fontSize: 15, bold: true, textColor: INK, align: 'right' },
  ];
  // equipment numbers, in the order of the line (shown on the Guide's black badges)
  const ORDER = ['z-store', 'z-preform', 'z-blow', 'z-label', 'z-fill', 'z-cap', 'z-mix', 'z-cip', 'z-coder', 'z-insp', 'belt-label', 'z-pack', 'z-pal', 'z-ctrl', 'z-other'];
  ORDER.forEach((id, i) => { const sh = shapes.find(x => x.id === id); if (sh) sh.num = i + 1; });
  return { w: DIAGRAM_W, h: DIAGRAM_H, shapes };
}

/** Built-in library entries: each machine of the default line, ready to drop into any diagram. */
export function builtinLibrary() {
  return defaultDiagram().shapes.filter(sh => sh.type === 'group').map(g => ({
    id: 'builtin:' + g.id, builtin: true, name: g.name, w: g.w, h: g.h, cw: g.cw, ch: g.ch, children: g.children, zone: g.zone,
  }));
}
/** The team's saved shapes plus the built-in machines. */
export function libraryItems() {
  const own = (state.library || []).filter(x => x && Array.isArray(x.children));
  return [...own, ...builtinLibrary()];
}

/* ---------- line drawings: the K3 default plus any line the team saves ---------- */
export const K3_ID = 'k3';
export const drawings = () => (state.lineDrawings || []).filter(d => d && d.id && Array.isArray(d.shapes));
/** The drawing shown: the one picked on this device, else the one for my line, else K3. */
export function currentDrawingId() {
  const list = drawings();
  if (state.drawingId === K3_ID) return K3_ID;
  if (state.drawingId && list.some(d => d.id === state.drawingId)) return state.drawingId;
  const p = state.profile;
  const mine = p && list.find(d => d.plant === p.plant && d.line === p.line);
  return mine ? mine.id : K3_ID;
}
export function drawingName(id = currentDrawingId()) {
  return id === K3_ID ? 'K3' : drawings().find(d => d.id === id)?.name || 'Line';
}
export function diagramDoc() {
  const id = currentDrawingId();
  if (id !== K3_ID) { const d = drawings().find(x => x.id === id); return { w: d.w || DIAGRAM_W, h: d.h || DIAGRAM_H, shapes: d.shapes }; }
  return state.diagram && Array.isArray(state.diagram.shapes) ? state.diagram : defaultDiagram();
}
export const isCustomDiagram = () => currentDrawingId() !== K3_ID || !!state.diagram;
export const zonesOnDiagram = (doc = diagramDoc()) => [...new Set(doc.shapes.map(s => s.zone).filter(Boolean))];
/** zone → equipment number on the current drawing */
export function zoneNumbers(doc = diagramDoc()) {
  const out = {};
  for (const sh of doc.shapes) if (sh.zone && sh.num != null && out[sh.zone] == null) out[sh.zone] = sh.num;
  return out;
}
/** Pick which drawing this device shows. */
export function useDrawing(id) { state.drawingId = id; save(); }

/** Options for a drawing picker: K3 and every saved line. */
export function drawingOptions() {
  return [{ id: K3_ID, name: 'K3 · Ploiești (default)' }, ...drawings().map(d => ({ id: d.id, name: d.name + (d.by ? ` · ${d.by}` : '') }))];
}

/** Ask for a name (and which plant and line it is), for a new line drawing. */
function askLine({ title, okLabel, start = '' }) {
  return new Promise((resolve) => {
    let done = false;
    const p = state.profile || {};
    const name = h('input', { type: 'text', id: 'ld-name', value: start, placeholder: 'e.g. Ploiești K5', maxlength: '60', autocomplete: 'off' });
    const plantSel = h('select', { id: 'ld-plant' }, allPlants().map(pl => h('option', { value: pl.id, selected: pl.id === (p.plant || 'PLO'), text: `${pl.name}${pl.live ? '' : ' (not live yet)'}` })));
    const lineSel = h('select', { id: 'ld-line' });
    const paintLines = () => {
      const pl = allPlants().find(x => x.id === plantSel.value);
      clear(lineSel, h('option', { value: '', text: 'Another line (not in the list)' }), (pl?.lines || []).map(l => h('option', { value: l.id, selected: l.id === p.line, text: `${l.name} · ${l.blurb}` })));
    };
    plantSel.addEventListener('change', paintLines); paintLines();
    const finish = (v) => { done = true; closeModal(); resolve(v); };
    const ok = () => { const n = name.value.trim(); if (!n) { toast('Give the line a name.', { tone: 'bad' }); return; } finish({ name: n, plant: plantSel.value, line: lineSel.value || null }); };
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    openModal(h('div', { class: 'confirm editor-form' },
      h('div', { class: 'wiz-top' }, h('h2', {}, icon('line'), ' ', title), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => finish(null) }, icon('close'))),
      h('label', { class: 'f', for: 'ld-name' }, h('span', { class: 'f-label', text: 'Name' }), name),
      h('div', { class: 'f-grid' },
        h('label', { class: 'f', for: 'ld-plant' }, h('span', { class: 'f-label', text: 'Plant' }), plantSel),
        h('label', { class: 'f', for: 'ld-line' }, h('span', { class: 'f-label', text: 'Line' }), lineSel)),
      h('p', { class: 'muted small', text: 'Saved drawings are shared with your team. Anyone on that line sees it in their Guide first.' }),
      h('div', { class: 'row-end' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => finish(null) }, 'Cancel'), h('button', { type: 'button', class: 'btn primary', onclick: ok }, icon('check'), okLabel))),
    { label: title, onClose: () => { if (!done) resolve(null); } });
    setTimeout(() => name.focus(), 50);
  });
}

/* ---------- the editor page (#diagram) ---------- */
let saveTimer = null;
export function renderDiagramEditor(root) {
  let board = null;
  let pending = null;
  const status = h('span', { class: 'muted small de-status' });
  const markSaved = (txt) => { status.textContent = txt; };
  const queueSave = (doc) => {
    markSaved('Saving…');
    pending = doc;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 600);
  };
  const drawingId = currentDrawingId();
  function flush() {
    if (!pending) return;
    if (drawingId === K3_ID) state.diagram = { w: pending.w, h: pending.h, shapes: pending.shapes };
    else state.lineDrawings = drawings().map(d => (d.id === drawingId ? { ...d, w: pending.w, h: pending.h, shapes: pending.shapes, at: new Date().toISOString(), by: profileName() || d.by } : d));
    pending = null; markSetup(); markSaved('Saved');
  }
  const again = () => { clearTimeout(saveTimer); flush(); renderDiagramEditor(root); };
  async function saveAsNew(blank) {
    flush();
    const p = state.profile || {};
    const v = await askLine({ title: blank ? 'Start a new line drawing' : 'Save as a new line', okLabel: blank ? 'Start drawing' : 'Save line', start: blank ? '' : `${p.plantName || 'Ploiești'} ${p.lineCustom ? p.lineName : p.line || ''}`.trim() });
    if (!v) { paintPicker(); return; }
    const d = { id: 'ld' + Date.now().toString(36), ...v, w: DIAGRAM_W, h: DIAGRAM_H, shapes: blank ? [] : board.doc().shapes, by: profileName() || undefined, at: new Date().toISOString() };
    state.lineDrawings = [...drawings(), d];
    state.drawingId = d.id;
    markSetup();
    toast(blank ? `${d.name}: add machines from the Library, or draw them.` : `Saved as ${d.name}. It is shared with your team.`);
    again();
  }
  async function renameIt() {
    const d = drawings().find(x => x.id === drawingId); if (!d) return;
    const v = await askLine({ title: 'Rename this line', okLabel: 'Save', start: d.name });
    if (!v) return;
    state.lineDrawings = drawings().map(x => (x.id === drawingId ? { ...x, ...v } : x));
    markSetup(); again();
  }
  async function deleteIt() {
    const d = drawings().find(x => x.id === drawingId); if (!d) return;
    const ok = await confirmBox({ title: `Delete the ${d.name} drawing?`, body: 'It is removed for everyone on the team. Touches logged on that line are not affected.', ok: 'Delete drawing', danger: true });
    if (!ok) return;
    clearTimeout(saveTimer); pending = null;
    state.lineDrawings = drawings().filter(x => x.id !== drawingId);
    state.drawingId = K3_ID;
    markSetup(); toast('Drawing deleted.'); renderDiagramEditor(root);
  }
  const picker = h('select', { class: 'run-pick-sel', 'aria-label': 'Line drawing' });
  function paintPicker() {
    clear(picker, drawingOptions().map(o => h('option', { value: o.id, selected: o.id === drawingId, text: o.name })),
      h('option', { value: '__save', text: '＋ Save as a new line…' }),
      h('option', { value: '__blank', text: '＋ Start a blank line…' }));
  }
  paintPicker();
  picker.addEventListener('change', () => {
    if (picker.value === '__save') return saveAsNew(false);
    if (picker.value === '__blank') return saveAsNew(true);
    clearTimeout(saveTimer); flush();
    useDrawing(picker.value);
    renderDiagramEditor(root);
  });
  const exportPng = async () => {
    const blob = await board.exportPng();
    if (blob) deliverFile(blob, `${slug(drawingName(drawingId))}-line-diagram-${stamp()}.png`, 'image/png');
  };
  const exportSvg = () => deliverFile(board.svgString().text, `${slug(drawingName(drawingId))}-line-diagram-${stamp()}.svg`, 'image/svg+xml');
  async function reset() {
    const k3 = drawingId === K3_ID;
    const ok = await confirmBox({ title: k3 ? 'Reset the diagram?' : `Start ${drawingName(drawingId)} again from the K3 line?`, body: 'The drawing is replaced by the default K3 line. Touch types and zones are not affected.', ok: 'Reset', danger: true });
    if (!ok) return;
    clearTimeout(saveTimer); pending = null;
    if (k3) { state.diagram = null; markSetup(); } else { pending = { w: DIAGRAM_W, h: DIAGRAM_H, shapes: defaultDiagram().shapes }; flush(); }
    board.setShapes(defaultDiagram().shapes); board.fit();
    toast('Diagram reset to the default.');
  }
  const zones = [...new Set([...FRAMEWORK.zones, ...state.lists.zones])];
  const host = h('div', { class: 'de-board' });
  clear(root, h('section', { class: 'diagram-editor' },
    h('div', { class: 'de-head' },
      h('a', { class: 'btn ghost small', href: '#guide', title: 'Back to the Guide', 'aria-label': 'Back to the Guide' }, icon('book'), h('span', { class: 'btn-t', text: 'Guide' })),
      h('h1', { class: 'view-title' }, icon('map', 'title-ico'), h('span', { class: 'title-t', text: 'Edit the line diagram' })),
      h('label', { class: 'run-pick de-pick', title: 'Which line drawing' }, icon('line'), picker, icon('chevron', 'run-pick-chev')),
      drawingId !== K3_ID ? [
        h('button', { type: 'button', class: 'icon-btn small', title: 'Rename this line', 'aria-label': 'Rename this line', onclick: renameIt }, icon('edit')),
        h('button', { type: 'button', class: 'icon-btn small', title: 'Delete this line drawing', 'aria-label': 'Delete this line drawing', onclick: deleteIt }, icon('trash')),
      ] : null,
      status,
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn ghost small', title: 'Download as PNG', 'aria-label': 'Download as PNG', onclick: exportPng }, icon('download'), h('span', { class: 'btn-t', text: 'PNG' })),
      h('button', { type: 'button', class: 'btn ghost small', title: 'Download as SVG', 'aria-label': 'Download as SVG', onclick: exportSvg }, icon('image'), h('span', { class: 'btn-t', text: 'SVG' })),
      h('button', { type: 'button', class: 'btn ghost small', title: 'Reset to the default drawing', 'aria-label': 'Reset to the default drawing', onclick: reset }, icon('reset'), h('span', { class: 'btn-t', text: 'Reset' })),
      h('a', { class: 'btn primary small', href: '#guide' }, icon('check'), 'Done')),
    host));
  const library = {
    items: libraryItems,
    save: (entry) => {
      const who = profileName();
      state.library = [{ ...entry, by: who || undefined, at: new Date().toISOString() }, ...(state.library || []).filter(x => x.name !== entry.name)].slice(0, 80);
      markSetup();
      toast(`Saved to the library: ${entry.name}. Everyone on your team sees it after the next sync.`);
    },
    remove: async (item) => {
      const ok = await confirmBox({ title: `Remove ${item.name}?`, body: 'It leaves the shared library for everyone. Drawings that already use it keep their copy.', ok: 'Remove', danger: true });
      if (!ok) return false;
      state.library = (state.library || []).filter(x => x.id !== item.id);
      markSetup();
      return true;
    },
  };
  board = createBoard(host, { doc: diagramDoc(), mode: 'edit', zones, onChange: queueSave, library, label: `${drawingName(drawingId)} line diagram editor` });
  markSaved(isCustomDiagram() ? 'Edited' : 'Default');
  return () => { clearTimeout(saveTimer); flush(); board.destroy(); };
}
