// Notes on a chart: text, arrows, shapes, icons and pasted or uploaded images, drawn over
// the chart with the whiteboard. Saved per chart for the team, positioned relative to the
// chart so they stay put on a phone or a projector.
import { state, markSetup } from './store.js';
import { createBoard } from './board.js';
import { h, icon } from './ui.js';

const POS = ['x', 'x1', 'x2'], POSY = ['y', 'y1', 'y2'];
const toRel = (shapes, W, H) => shapes.map(sh => {
  const o = { ...sh };
  for (const k of POS) if (typeof o[k] === 'number') o[k] = o[k] / W;
  for (const k of POSY) if (typeof o[k] === 'number') o[k] = o[k] / H;
  return o;
});
const toAbs = (shapes, W, H) => shapes.map(sh => {
  const o = { ...sh };
  for (const k of POS) if (typeof o[k] === 'number') o[k] = o[k] * W;
  for (const k of POSY) if (typeof o[k] === 'number') o[k] = o[k] * H;
  return o;
});

let editingId = null;
export const isAnnotating = () => !!editingId;

/** Attach the layer to a chart card: `body` is the chart area. Returns { edit(), button }. */
export function annotationLayer(card, body, chartId) {
  body.classList.add('annot-anchor');
  const host = h('div', { class: 'annot-host', 'aria-hidden': 'true' });
  body.append(host);
  let board = null;
  let timer = null;
  const saved = () => state.annotations?.[chartId]?.shapes || [];

  function size() { const r = body.getBoundingClientRect(); return { W: Math.max(1, r.width), H: Math.max(1, r.height) }; }

  function showView() {
    board?.destroy(); board = null;
    host.replaceChildren();
    host.classList.remove('editing');
    const shapes = saved();
    if (!shapes.length) return;
    const { W, H } = size();
    board = createBoard(host, { doc: { w: W, h: H, shapes: toAbs(shapes, W, H) }, mode: 'view', overlay: true, label: 'Chart notes' });
  }

  function edit() {
    if (editingId && editingId !== chartId) return;
    editingId = chartId;
    board?.destroy();
    host.replaceChildren();
    const { W, H } = size();
    const tools = h('div', { class: 'annot-tools' });
    card.insertBefore(tools, body);
    const done = h('button', { type: 'button', class: 'btn primary small', onclick: finish }, icon('check'), 'Done');
    const clearAll = h('button', { type: 'button', class: 'btn ghost small', onclick: () => { board.setShapes([]); persist({ shapes: [] }); } }, icon('trash'), 'Clear notes');
    const temp = h('div');
    tools.append(temp);
    board = createBoard(temp, {
      doc: { w: W, h: H, shapes: toAbs(saved(), W, H) }, mode: 'edit', overlay: true, compact: true, label: 'Chart notes editor',
      extraTools: [clearAll, done],
      onChange: (doc) => persist(doc),
    });
    // The toolbar and properties sit above the chart; the drawing surface sits on it.
    host.append(board.parts.stage);
    host.classList.add('editing');
    card.classList.add('annotating');
    function persist(doc) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const { W: w, H: hh } = size();
        state.annotations = { ...(state.annotations || {}) };
        if (doc.shapes.length) state.annotations[chartId] = { v: 1, shapes: toRel(doc.shapes, w, hh) };
        else delete state.annotations[chartId];
        markSetup();
      }, 400);
    }
    function finish() {
      clearTimeout(timer);
      const doc = board.doc();
      const { W: w, H: hh } = size();
      state.annotations = { ...(state.annotations || {}) };
      if (doc.shapes.length) state.annotations[chartId] = { v: 1, shapes: toRel(doc.shapes, w, hh) };
      else delete state.annotations[chartId];
      markSetup();
      board.destroy(); board = null;
      tools.remove();
      card.classList.remove('annotating');
      editingId = null;
      showView();
    }
  }

  const button = h('button', { type: 'button', class: 'kind-btn annot-btn' + (saved().length ? ' has' : ''), title: 'Add notes, arrows, icons or images to this chart', 'aria-label': 'Annotate this chart', onclick: edit }, icon('edit'));
  requestAnimationFrame(showView);
  const ro = new ResizeObserver(() => { if (editingId !== chartId) showView(); });
  ro.observe(body);
  return { edit, button };
}
