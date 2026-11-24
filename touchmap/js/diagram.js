// The Guide diagram: the K3 line as editable shapes. Shapes linked to a zone open that zone's
// touches in the Guide; conveyors and pipes are connectors attached to the machines.
import { state, markSetup } from './store.js';
import { FRAMEWORK } from './framework.js';
import { createBoard } from './board.js';
import { h, clear, icon, toast, confirmBox, deliverFile, stamp } from './ui.js';

export const DIAGRAM_W = 1010, DIAGRAM_H = 610;

const Z = (id, type, zone, x, y, w, hh, extra = {}) => ({
  id, type, zone, x, y, w, h: hh, text: zone, fill: 'auto', stroke: '#141414', strokeWidth: 2, fontSize: 14, bold: true, textColor: '#141414',
  radius: type === 'rect' ? 12 : 0, ...extra,
});
const L = (id, from, to, extra = {}) => ({ id, type: 'line', from, to, x1: 0, y1: 0, x2: 0, y2: 0, stroke: '#141414', strokeWidth: 2, route: 'straight', ...extra });

/** The line as shipped: same layout as the first Guide map, now made of editable shapes. */
export function defaultDiagram() {
  const belt = { stroke: '#D6D6D2', strokeWidth: 16, zone: 'Conveyors' };
  const shapes = [
    { id: 'block', type: 'rect', x: 222, y: 180, w: 560, h: 232, radius: 26, fill: '#FAFAF9', stroke: '#CFCFCC', strokeWidth: 2, text: 'ERGOBLOC BLOCK', fontSize: 12, bold: true, textColor: '#6A6A6A', align: 'left', valign: 'top', caps: true },
    L('belt-1', { id: 'z-cap', anchor: 'e' }, { id: 'z-insp', anchor: 'w' }, belt),
    L('belt-2', { id: 'z-insp', anchor: 's' }, { id: 'z-pack', anchor: 'n' }, { ...belt, route: 'elbow' }),
    L('belt-3', { id: 'z-pack', anchor: 'w' }, { id: 'z-pal', anchor: 'e' }, belt),
    L('pipe-mix', { id: 'z-mix', anchor: 's' }, { id: 'z-fill', anchor: 'n' }, { stroke: '#9DB9DC', strokeWidth: 7 }),
    { id: 'pipe-cip', type: 'line', from: { id: 'z-cip', anchor: 's' }, to: null, x1: 0, y1: 0, x2: 815, y2: 180, stroke: '#9DB9DC', strokeWidth: 7, route: 'straight' },
    { id: 'star-1', type: 'ellipse', x: 412, y: 285, w: 30, h: 30, fill: '#FFFFFF', stroke: '#CFCFCC', strokeWidth: 2 },
    { id: 'star-2', type: 'ellipse', x: 546, y: 287, w: 26, h: 26, fill: '#FFFFFF', stroke: '#CFCFCC', strokeWidth: 2 },
    { id: 'star-3', type: 'ellipse', x: 708, y: 291, w: 18, h: 18, fill: '#FFFFFF', stroke: '#CFCFCC', strokeWidth: 2 },
    Z('z-store', 'rect', 'Line-side store', 30, 30, 170, 120),
    Z('z-preform', 'hopper', 'Preform feed', 40, 206, 132, 82, { fontSize: 13 }),
    Z('z-blow', 'ellipse', 'Blow moulder', 250, 220, 160, 160),
    Z('z-label', 'ellipse', 'Labeller', 442, 250, 100, 100, { fontSize: 13 }),
    Z('z-fill', 'ellipse', 'Filler', 560, 228, 144, 144),
    Z('z-cap', 'ellipse', 'Capper', 722, 272, 56, 56, { fontSize: 10 }),
    Z('z-mix', 'rect', 'Mixer / carbo', 560, 40, 135, 88, { radius: 22 }),
    Z('z-cip', 'rect', 'CIP / utilities', 730, 40, 170, 88),
    Z('z-coder', 'rect', 'Coder', 800, 276, 54, 48, { fontSize: 11, radius: 6 }),
    Z('z-insp', 'rect', 'Inspection / rejects', 880, 260, 100, 72, { fontSize: 11, radius: 8 }),
    Z('z-pack', 'rect', 'Packer / shrink', 660, 488, 220, 64),
    Z('z-pal', 'rect', 'Palletiser', 446, 470, 136, 100),
    Z('z-ctrl', 'rect', 'Control room / office', 30, 452, 170, 118),
    Z('z-other', 'ellipse', 'Other', 236, 474, 168, 86, { text: 'Other · anywhere on the line', fontSize: 13 }),
    { id: 'belt-label', type: 'text', zone: 'Conveyors', x: 818, y: 350, w: 104, h: 30, text: 'Conveyors', fill: 'none', stroke: '#141414', strokeWidth: 0, fontSize: 14, bold: true, textColor: '#141414' },
    L('flow-in', { id: 'z-preform', anchor: 'e' }, { id: 'z-blow', anchor: 'w' }, { stroke: '#6A6A6A', strokeWidth: 3, arrowEnd: true }),
  ];
  return { w: DIAGRAM_W, h: DIAGRAM_H, shapes };
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
      h('a', { class: 'btn ghost small', href: '#guide' }, icon('book'), 'Guide'),
      h('h1', { class: 'view-title' }, icon('map', 'title-ico'), 'Edit the line diagram'),
      status,
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn ghost small', onclick: exportPng }, icon('download'), 'PNG'),
      h('button', { type: 'button', class: 'btn ghost small', onclick: exportSvg }, icon('download'), 'SVG'),
      h('button', { type: 'button', class: 'btn ghost small', onclick: reset }, icon('reset'), 'Reset'),
      h('a', { class: 'btn primary small', href: '#guide' }, icon('check'), 'Done')),
    host));
  board = createBoard(host, { doc: diagramDoc(), mode: 'edit', zones, onChange: save, label: 'K3 line diagram editor' });
  markSaved(isCustomDiagram() ? 'Edited' : 'Default');
  return () => { clearTimeout(saveTimer); flush(); board.destroy(); };
}
