// The Guide diagram: the K3 line as editable shapes. Shapes linked to a zone open that zone's
// touches in the Guide; conveyors and pipes are connectors attached to the machines.
import { state, markSetup, profileName } from './store.js';
import { FRAMEWORK } from './framework.js';
import { createBoard } from './board.js';
import { h, clear, icon, toast, confirmBox, deliverFile, stamp } from './ui.js';

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
  // the conveyor sits under the machines it runs through
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

export const diagramDoc = () => (state.diagram && Array.isArray(state.diagram.shapes) ? state.diagram : defaultDiagram());
export const isCustomDiagram = () => !!state.diagram;
export const zonesOnDiagram = (doc = diagramDoc()) => [...new Set(doc.shapes.map(s => s.zone).filter(Boolean))];

/* ---------- the editor page (#diagram) ---------- */
let saveTimer = null;
export function renderDiagramEditor(root) {
  let board = null;
  let pending = null;
  const status = h('span', { class: 'muted small de-status' });
  const markSaved = (txt) => { status.textContent = txt; };
  const save = (doc) => {
    markSaved('Saving…');
    pending = doc;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 600);
  };
  function flush() {
    if (!pending) return;
    state.diagram = { w: pending.w, h: pending.h, shapes: pending.shapes };
    pending = null; markSetup(); markSaved('Saved');
  }
  const exportPng = async () => {
    const blob = await board.exportPng();
    if (blob) deliverFile(blob, `k3-line-diagram-${stamp()}.png`, 'image/png');
  };
  const exportSvg = () => deliverFile(board.svgString().text, `k3-line-diagram-${stamp()}.svg`, 'image/svg+xml');
  async function reset() {
    const ok = await confirmBox({ title: 'Reset the diagram?', body: 'Your edits to the drawing are replaced by the default K3 line. Touch types and zones are not affected.', ok: 'Reset', danger: true });
    if (!ok) return;
    clearTimeout(saveTimer); pending = null;
    state.diagram = null; markSetup();
    board.setShapes(defaultDiagram().shapes); board.fit();
    toast('Diagram reset to the default.');
  }
  const zones = [...new Set([...FRAMEWORK.zones, ...state.lists.zones])];
  const host = h('div', { class: 'de-board' });
  clear(root, h('section', { class: 'diagram-editor' },
    h('div', { class: 'de-head' },
      h('a', { class: 'btn ghost small', href: '#guide', title: 'Back to the Guide', 'aria-label': 'Back to the Guide' }, icon('book'), h('span', { class: 'btn-t', text: 'Guide' })),
      h('h1', { class: 'view-title' }, icon('map', 'title-ico'), h('span', { class: 'title-t', text: 'Edit the line diagram' })),
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
  board = createBoard(host, { doc: diagramDoc(), mode: 'edit', zones, onChange: save, library, label: 'K3 line diagram editor' });
  markSaved(isCustomDiagram() ? 'Edited' : 'Default');
  return () => { clearTimeout(saveTimer); flush(); board.destroy(); };
}
