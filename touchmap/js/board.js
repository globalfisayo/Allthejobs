// A small whiteboard: shapes, text, lines and arrows that snap to shapes, images and icons,
// colours and dashes, alignment snapping, undo/redo, zoom and pan, PNG/SVG export.
// Shapes can be grouped (a machine drawn from circles and squares becomes one piece) and a group
// saved to a shared library. Used for the Guide diagram (full editor) and for chart annotations.
import { h, clear, icon, toast, PATHS } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k) el.append(k);
  return el;
};
let idSeq = 0;
export const newId = () => 'sh' + Date.now().toString(36) + (idSeq++).toString(36) + Math.random().toString(36).slice(2, 5);
const clone = (o) => JSON.parse(JSON.stringify(o));
const BOX = new Set(['rect', 'ellipse', 'triangle', 'diamond', 'hopper', 'text', 'image', 'icon', 'path', 'group']);
export const COLOURS = ['#141414', '#6A6A6A', '#CFCFCC', '#FFFFFF', '#F40009', '#FFD9DB', '#1E63B8', '#DCE8F7', '#159A6A', '#DFF2EA', '#6250D6', '#EAE6FB', '#EB6834', '#EDA100', '#FFF3C4'];
let clipboard = [];

/* ---------- geometry ---------- */
export function bbox(sh, shapes) {
  if (sh.type === 'line') {
    const [a, b] = ends(sh, shapes);
    const pts = [a, ...(sh.via || []), b];
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  return { x: sh.x, y: sh.y, w: sh.w, h: sh.h };
}

/* ---------- groups ---------- */
// A group keeps its children in its own coordinates (0..cw, 0..ch); drawing maps them onto the
// group's box, so moving or resizing the group moves or scales everything in it.
export function placed(c, g) {
  const sx = g.w / (g.cw || g.w || 1), sy = g.h / (g.ch || g.h || 1);
  const k = Math.min(sx, sy);
  const o = { ...c };
  if (c.type === 'line') {
    Object.assign(o, { x1: g.x + c.x1 * sx, y1: g.y + c.y1 * sy, x2: g.x + c.x2 * sx, y2: g.y + c.y2 * sy, from: null, to: null });
    if (c.via) o.via = c.via.map(p => ({ x: g.x + p.x * sx, y: g.y + p.y * sy }));
  } else Object.assign(o, { x: g.x + c.x * sx, y: g.y + c.y * sy, w: c.w * sx, h: c.h * sy });
  if (c.fontSize) o.fontSize = c.fontSize * k;
  if (c.radius) o.radius = c.radius * k;
  return o;
}
const bodyIndex = (g) => (g.children || []).findIndex(c => c.body);
const labelIndex = (g) => {
  const kids = g.children || [];
  const i = kids.findIndex(c => c.label);
  return i >= 0 ? i : kids.findIndex(c => c.type === 'text' || (c.text && c.type !== 'line'));
};
/** The box of the shape that carries a group's outline (where anchors and badges go). */
export function bodyBox(sh) {
  if (sh.type === 'group') {
    const i = bodyIndex(sh);
    if (i >= 0) return bodyBox(placed(sh.children[i], sh));
  }
  return { x: sh.x, y: sh.y, w: sh.w, h: sh.h, type: sh.type };
}
/** Shape(s) a style change applies to: a group's body (fill, border) or its label (text). */
function targetsOf(sh, role) {
  if (sh.type !== 'group') return [sh];
  const kids = sh.children || [];
  if (role === 'label') { const i = labelIndex(sh); return i >= 0 ? [kids[i]] : []; }
  const bodies = kids.filter(c => c.body);
  const list = bodies.length ? bodies : kids.filter(c => c.type !== 'text' && c.type !== 'line' && c.fill !== 'none');
  return list.flatMap(c => (c.type === 'group' ? targetsOf(c, role) : [c]));
}
/** A shape (or line) moved into a group's own coordinates, with line ends resolved. */
function toLocal(sh, x, y, shapes) {
  const c = clone(sh);
  if (c.type === 'line') {
    const [a, b] = ends(sh, shapes);
    Object.assign(c, { x1: a.x - x, y1: a.y - y, x2: b.x - x, y2: b.y - y, from: null, to: null });
    if (c.via) c.via = c.via.map(p => ({ x: p.x - x, y: p.y - y }));
  } else { c.x -= x; c.y -= y; }
  return c;
}
/** Wrap shapes into a group (their own coordinates relative to the group's box). */
export function makeGroup(list, shapes, id = newId()) {
  const bs = list.map(sh => bbox(sh, shapes));
  const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y));
  const w = Math.max(1, Math.max(...bs.map(b => b.x + b.w)) - x), hh = Math.max(1, Math.max(...bs.map(b => b.y + b.h)) - y);
  const zoned = list.find(sh => sh.zone);
  const children = list.map(sh => {
    const c = toLocal(sh, x, y, shapes);
    c.id = newId();
    if (zoned && sh === zoned) c.body = true;
    delete c.zone;
    return c;
  });
  if (!children.some(c => c.body)) {
    const boxes = children.filter(c => c.type !== 'text' && c.type !== 'line');
    const big = boxes.sort((a, b) => b.w * b.h - a.w * a.h)[0];
    if (big) big.body = true;
  }
  const g = { id, type: 'group', x, y, w, h: hh, cw: w, ch: hh, children };
  if (zoned) g.zone = zoned.zone;
  return g;
}

function anchorPoint(sh, a) {
  if (sh.type === 'group') { const i = bodyIndex(sh); if (i >= 0) return anchorPoint(placed(sh.children[i], sh), a); }
  const { x, y, w, h: hh } = sh;
  const pts = {
    n: { x: x + w / 2, y }, s: { x: x + w / 2, y: y + hh }, e: { x: x + w, y: y + hh / 2 }, w: { x, y: y + hh / 2 }, c: { x: x + w / 2, y: y + hh / 2 },
  };
  if (sh.type === 'triangle') { pts.e = { x: x + w * 0.75, y: y + hh / 2 }; pts.w = { x: x + w * 0.25, y: y + hh / 2 }; }
  if (sh.type === 'hopper') { pts.s = { x: x + w / 2, y: y + hh }; pts.e = { x: x + w * 0.9, y: y + hh / 2 }; pts.w = { x: x + w * 0.1, y: y + hh / 2 }; }
  return pts[a] || pts.c;
}
function ends(line, shapes) {
  const find = (ref) => ref && shapes.find(x => x.id === ref.id && x.type !== 'line');
  const fa = find(line.from), fb = find(line.to);
  return [fa ? { ...anchorPoint(fa, line.from.anchor), a: line.from.anchor } : { x: line.x1, y: line.y1 },
    fb ? { ...anchorPoint(fb, line.to.anchor), a: line.to.anchor } : { x: line.x2, y: line.y2 }];
}
function routePoints(line, shapes) {
  const [a, b] = ends(line, shapes);
  if (line.via?.length) return [a, ...line.via, b];
  if (line.route !== 'elbow') return [a, b];
  const horiz = a.a ? (a.a === 'e' || a.a === 'w') : Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  if (horiz) { const mx = (a.x + b.x) / 2; return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b]; }
  const my = (a.y + b.y) / 2; return [a, { x: a.x, y: my }, { x: b.x, y: my }, b];
}
const dashOf = (d, w) => (d === 'dashed' ? `${w * 4} ${w * 3}` : d === 'dotted' ? `0.1 ${Math.max(4, w * 2.5)}` : null);
/** Chevrons every `gap` units along a polyline, pointing the way it runs (a conveyor's flow). */
function chevrons(pts, colour, gap = 120) {
  const out = [];
  let next = gap / 2, walked = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    for (; next <= walked + len; next += gap) {
      const f = len ? (next - walked) / len : 0;
      out.push(s('path', { d: 'M-6 -7 L5 0 L-6 7', transform: `translate(${p.x + (q.x - p.x) * f} ${p.y + (q.y - p.y) * f}) rotate(${ang})`, fill: 'none', stroke: colour, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'bd-chev' }));
    }
    walked += len;
  }
  return out;
}
function arrowHead(p, q, w, colour) {
  const ang = Math.atan2(p.y - q.y, p.x - q.x);
  const size = 7 + w * 2.2;
  const a1 = ang + Math.PI * 0.85, a2 = ang - Math.PI * 0.85;
  return s('polygon', { points: `${p.x},${p.y} ${p.x + size * Math.cos(a1)},${p.y + size * Math.sin(a1)} ${p.x + size * Math.cos(a2)},${p.y + size * Math.sin(a2)}`, fill: colour });
}
function wrap(text, width, size) {
  const max = Math.max(1, Math.floor(width / (size * 0.56)));
  const out = [];
  for (const para of String(text || '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      if ((line + ' ' + word).trim().length > max && line) { out.push(line); line = word; } else line = (line + ' ' + word).trim();
    }
    out.push(line);
  }
  return out;
}

/* ---------- drawing one shape ---------- */
export function drawShape(sh, shapes, { fillFor, inner = false } = {}) {
  const g = inner ? s('g', { class: 'bd-part', opacity: sh.opacity ?? null })
    : s('g', { 'data-id': sh.id, class: 'bd-shape' + (sh.zone ? ' bd-zone' : ''), opacity: sh.opacity ?? 1 });
  const sw = sh.strokeWidth ?? 2;
  const auto = (x) => (fillFor && fillFor(x)) || null;
  const stroke = sh.stroke === 'auto' ? (auto({ ...sh, fill: 'auto' }) || sh.base || '#DCDCD8') : (sh.stroke ?? '#141414');
  const dash = sh.dash === 'belt' ? null : dashOf(sh.dash, sw);
  const fill = sh.fill === 'auto' ? auto(sh) || sh.base || '#FFFFFF' : sh.fill || 'none';
  const cls = 'bd-body' + (sh.detail ? ' bd-detail' : '');
  const common = { fill, stroke: sw ? stroke : 'none', 'stroke-width': sw, 'stroke-dasharray': dash, 'stroke-linecap': sh.dash === 'dotted' ? 'round' : null, 'stroke-linejoin': 'round', class: cls };
  const { x, y, w, h: hh } = sh;
  if (sh.type === 'group') {
    const zoneFill = auto({ ...sh, fill: 'auto' });
    const childFill = (c) => (c.fill === 'auto' || c.stroke === 'auto' ? zoneFill : null);
    for (const c of sh.children || []) g.append(drawShape(placed(c, sh), shapes, { fillFor: childFill, inner: true }));
    if (!inner) g.append(s('rect', { x, y, width: Math.max(w, 1), height: Math.max(hh, 1), fill: 'transparent', class: 'bd-hit' }));
    return g;
  }
  if (sh.type === 'line') {
    const pts = routePoints(sh, shapes);
    const d = 'M' + pts.map(p => `${p.x} ${p.y}`).join(' L');
    g.append(s('path', { d, fill: 'none', stroke, 'stroke-width': sw, 'stroke-dasharray': dash, 'stroke-linecap': sh.dash === 'belt' ? 'butt' : 'round', 'stroke-linejoin': 'round', class: cls + (sh.dash === 'belt' ? ' bd-belt' : '') }));
    if (sh.dash === 'belt') {
      g.append(s('path', { d, fill: 'none', stroke: '#FFFFFF', 'stroke-width': Math.max(1.5, sw / 9), 'stroke-dasharray': `${sw / 3} ${sw / 1.8}`, class: 'bd-belt-marks' }));
      g.append(...chevrons(pts, sh.chevronColour || '#6A6A6A'));
    }
    if (sh.arrowEnd) g.append(arrowHead(pts[pts.length - 1], pts[pts.length - 2], sw, stroke));
    if (sh.arrowStart) g.append(arrowHead(pts[0], pts[1], sw, stroke));
    if (!inner) g.append(s('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': Math.max(18, sw + 14), class: 'bd-hit' }));
    if (sh.text) {
      const mid = pts[Math.floor(pts.length / 2) - (pts.length % 2 ? 0 : 1)];
      const nxt = pts[Math.floor(pts.length / 2)];
      const t = s('text', { x: (mid.x + nxt.x) / 2, y: (mid.y + nxt.y) / 2 - 6, 'text-anchor': 'middle', 'font-size': sh.fontSize || 13, 'font-weight': sh.bold ? 700 : 500, fill: sh.textColor || '#141414', class: 'bd-text', 'paint-order': 'stroke', stroke: '#fff', 'stroke-width': 4 });
      t.textContent = sh.text;
      g.append(t);
    }
    return g;
  }
  if (sh.type === 'rect') g.append(s('rect', { x, y, width: w, height: hh, rx: sh.radius ?? 0, ...common }));
  else if (sh.type === 'ellipse') g.append(s('ellipse', { cx: x + w / 2, cy: y + hh / 2, rx: w / 2, ry: hh / 2, ...common }));
  else if (sh.type === 'triangle') g.append(s('polygon', { points: `${x + w / 2},${y} ${x + w},${y + hh} ${x},${y + hh}`, ...common }));
  else if (sh.type === 'diamond') g.append(s('polygon', { points: `${x + w / 2},${y} ${x + w},${y + hh / 2} ${x + w / 2},${y + hh} ${x},${y + hh / 2}`, ...common }));
  else if (sh.type === 'hopper') g.append(s('polygon', { points: `${x},${y} ${x + w},${y} ${x + w * 0.8},${y + hh} ${x + w * 0.2},${y + hh}`, ...common }));
  else if (sh.type === 'path') {
    const vb = sh.vb || [0, 0, w || 1, hh || 1];
    g.append(s('path', { d: sh.d, transform: `translate(${x} ${y}) scale(${w / (vb[2] || 1)} ${hh / (vb[3] || 1)}) translate(${-vb[0]} ${-vb[1]})`, ...common, 'vector-effect': 'non-scaling-stroke' }));
  }
  else if (sh.type === 'image') {
    g.append(s('image', { href: sh.src, x, y, width: w, height: hh, preserveAspectRatio: 'xMidYMid meet' }));
    if (sw) g.append(s('rect', { x, y, width: w, height: hh, fill: 'none', stroke, 'stroke-width': sw, 'stroke-dasharray': dash, rx: sh.radius ?? 0 }));
  } else if (sh.type === 'icon') {
    const svgIcon = s('svg', { x, y, width: w, height: hh, viewBox: '0 0 24 24', overflow: 'visible' },
      s('path', { d: PATHS[sh.icon] || PATHS.info, fill: 'none', stroke: sh.stroke || '#141414', 'stroke-width': Math.max(0.5, (sh.strokeWidth ?? 2)), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    g.append(svgIcon);
  }
  // hit area for text, icons and images
  if (!inner) g.append(s('rect', { x, y, width: Math.max(w, 1), height: Math.max(hh, 1), fill: 'transparent', class: 'bd-hit' }));
  if (sh.text && sh.type !== 'icon' && sh.type !== 'image') {
    const size = sh.fontSize || 14;
    const pad = 8;
    const lines = wrap(sh.text, Math.max(20, w - pad * 2), size);
    const lh = size * 1.22;
    const align = sh.align || 'center';
    const tx = align === 'left' ? x + pad : align === 'right' ? x + w - pad : x + w / 2;
    const block = lines.length * lh;
    const valign = sh.valign || 'middle';
    const top = valign === 'top' ? y + pad : valign === 'bottom' ? y + hh - pad - block : y + (hh - block) / 2;
    const t = s('text', { x: tx, 'text-anchor': align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle', 'font-size': size, 'font-weight': sh.bold ? 750 : 550, fill: sh.textColor || '#141414', class: 'bd-text' + (sh.onBody ? ' on-body' : ''), 'letter-spacing': sh.caps ? '0.12em' : null });
    lines.forEach((ln, i) => { const sp = s('tspan', { x: tx, y: top + lh * (i + 0.78) }); sp.textContent = ln; t.append(sp); });
    g.append(t);
  }
  return g;
}

/* ---------- the board ---------- */
/**
 * host: element to render into. opts:
 *  doc { w, h, shapes }, mode 'edit' | 'view', overlay (transparent, no pan/zoom),
 *  zones [names] for linking, onChange(doc), onShapeClick(shape), decorate(shape, g, shapes), fillFor(shape),
 *  extraTools (nodes added to the toolbar), compact (smaller toolbar/props)
 */
export function createBoard(host, opts) {
  const doc = clone(opts.doc || { w: 1000, h: 600, shapes: [] });
  let shapes = doc.shapes;
  const edit = opts.mode === 'edit';
  let tool = 'select';
  let sel = new Set();
  let view = { x: 0, y: 0, w: doc.w, h: doc.h };
  let grid = !opts.overlay;
  const undo = [], redo = [];
  let guides = [];
  let hoverAnchor = null;

  const svg = s('svg', { class: 'bd-svg' + (opts.overlay ? ' overlay' : ''), xmlns: NS, role: edit ? 'application' : 'group', 'aria-label': opts.label || 'Diagram' });
  const gGrid = s('g', { class: 'bd-grid' });
  const gShapes = s('g', { class: 'bd-shapes' });
  const gUi = s('g', { class: 'bd-ui' });
  svg.append(gGrid, gShapes, gUi);
  const textEdit = h('textarea', { class: 'bd-text-edit', hidden: true, 'aria-label': 'Shape text' });
  const stage = h('div', { class: 'bd-stage' }, svg, textEdit);
  const props = h('aside', { class: 'bd-props', 'aria-label': 'Shape properties' });
  const toolbar = h('div', { class: 'bd-toolbar', role: 'toolbar', 'aria-label': 'Drawing tools' });
  const root = h('div', { class: 'board ' + (edit ? 'edit' : 'view') + (opts.overlay ? ' overlay' : '') + (opts.compact ? ' compact' : '') },
    edit ? toolbar : null, h('div', { class: 'bd-main' }, stage, edit ? props : null));
  clear(host, root);

  const setViewBox = () => svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  setViewBox();
  if (opts.overlay) svg.setAttribute('preserveAspectRatio', 'none');

  const byId = (id) => shapes.find(x => x.id === id);
  const toSvg = (e) => {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };
  const scale = () => { const r = svg.getBoundingClientRect(); return r.width ? view.w / r.width : 1; };
  const snapV = (v) => (grid ? Math.round(v / 10) * 10 : v);

  function commit() {
    undo.push(JSON.stringify(shapes));
    if (undo.length > 120) undo.shift();
    redo.length = 0;
    opts.onChange?.({ ...doc, shapes: clone(shapes) });
  }
  // the state before the first change is the base of the history
  undo.push(JSON.stringify(shapes));
  function undoIt() { if (undo.length < 2) return; redo.push(undo.pop()); shapes = JSON.parse(undo[undo.length - 1]); sel = new Set([...sel].filter(byId)); render(); paintProps(); opts.onChange?.({ ...doc, shapes: clone(shapes) }); }
  function redoIt() { if (!redo.length) return; const st = redo.pop(); undo.push(st); shapes = JSON.parse(st); render(); paintProps(); opts.onChange?.({ ...doc, shapes: clone(shapes) }); }

  /* ----- render ----- */
  function render() {
    clear(gGrid);
    if (edit && grid && !opts.overlay) {
      const step = 20;
      const x0 = Math.floor(view.x / step) * step, y0 = Math.floor(view.y / step) * step;
      const dots = [];
      for (let x = x0; x < view.x + view.w; x += step) for (let y = y0; y < view.y + view.h; y += step) dots.push(`M${x} ${y}h0.01`);
      if (dots.length < 40000) gGrid.append(s('path', { d: dots.join(''), stroke: '#CFCFCC', 'stroke-width': 1.6 * scale(), 'stroke-linecap': 'round' }));
    }
    clear(gShapes);
    for (const sh of shapes) {
      const g = drawShape(sh, shapes, { fillFor: opts.fillFor });
      if (!edit) {
        if (opts.onShapeClick && sh.zone) {
          g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button');
          g.setAttribute('aria-label', opts.zoneLabel ? opts.zoneLabel(sh) : sh.zone);
          g.addEventListener('click', () => opts.onShapeClick(sh));
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onShapeClick(sh); } });
        }
        opts.decorate?.(sh, g, shapes);
      }
      gShapes.append(g);
    }
    paintUi();
  }
  function paintUi() {
    clear(gUi);
    if (!edit) return;
    const k = scale();
    for (const id of sel) {
      const sh = byId(id); if (!sh) continue;
      if (sh.type === 'line') {
        const [a, b] = ends(sh, shapes);
        for (const [p, which] of [[a, 'from'], [b, 'to']]) gUi.append(s('circle', { cx: p.x, cy: p.y, r: 7 * k, class: 'bd-handle end' + (sh[which] ? ' attached' : ''), 'data-handle': which, 'data-for': sh.id, 'stroke-width': 2 * k }));
        if (sel.size === 1 && sh.route !== 'elbow') {
          // drag a small square to bend the line; drag a bend to move it
          const pts = routePoints(sh, shapes);
          (sh.via || []).forEach((p, i) => gUi.append(s('rect', { x: p.x - 6 * k, y: p.y - 6 * k, width: 12 * k, height: 12 * k, rx: 6 * k, class: 'bd-handle via', 'data-handle': `via:${i}`, 'data-for': sh.id, 'stroke-width': 2 * k })));
          for (let i = 0; i < pts.length - 1; i++) {
            const m = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
            if (Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y) > 40 * k) gUi.append(s('rect', { x: m.x - 4.5 * k, y: m.y - 4.5 * k, width: 9 * k, height: 9 * k, rx: 2 * k, class: 'bd-handle mid', 'data-handle': `mid:${i}`, 'data-for': sh.id, 'stroke-width': 1.5 * k }));
          }
        }
        continue;
      }
      const { x, y, w, h: hh } = sh;
      gUi.append(s('rect', { x, y, width: w, height: hh, class: 'bd-sel', 'stroke-width': 1.5 * k }));
      if (sel.size === 1) {
        const hs = { nw: [x, y], n: [x + w / 2, y], ne: [x + w, y], e: [x + w, y + hh / 2], se: [x + w, y + hh], s: [x + w / 2, y + hh], sw: [x, y + hh], w: [x, y + hh / 2] };
        for (const [name, [hx, hy]] of Object.entries(hs)) gUi.append(s('rect', { x: hx - 6 * k, y: hy - 6 * k, width: 12 * k, height: 12 * k, rx: 2 * k, class: 'bd-handle', 'data-handle': name, 'data-for': sh.id, 'stroke-width': 1.5 * k }));
      }
    }
    for (const gd of guides) gUi.append(s('line', { ...gd, class: 'bd-guide', 'stroke-width': 1 * k }));
    if (hoverAnchor) {
      const sh = byId(hoverAnchor.id);
      if (sh) for (const a of ['n', 'e', 's', 'w']) {
        const p = anchorPoint(sh, a);
        gUi.append(s('circle', { cx: p.x, cy: p.y, r: (a === hoverAnchor.anchor ? 7 : 4.5) * k, class: 'bd-anchor' + (a === hoverAnchor.anchor ? ' on' : ''), 'stroke-width': 1.5 * k }));
      }
    }
    if (marquee) gUi.append(s('rect', { ...rectOf(marquee), class: 'bd-marquee', 'stroke-width': 1 * k }));
  }
  const rectOf = (m) => ({ x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1), width: Math.abs(m.x1 - m.x0), height: Math.abs(m.y1 - m.y0) });

  /* ----- snapping ----- */
  function snapAnchor(p, exceptId) {
    const k = scale();
    let best = null;
    for (let i = shapes.length - 1; i >= 0; i--) {
      const sh = shapes[i];
      if (!BOX.has(sh.type) || sh.id === exceptId) continue;
      const pad = 16 * k;
      if (p.x < sh.x - pad || p.x > sh.x + sh.w + pad || p.y < sh.y - pad || p.y > sh.y + sh.h + pad) continue;
      for (const a of ['n', 'e', 's', 'w']) {
        const q = anchorPoint(sh, a);
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (!best || d < best.d) best = { id: sh.id, anchor: a, d, p: q };
      }
      if (best) break;
    }
    return best;
  }
  function alignSnap(moving, dx, dy) {
    const k = scale(), tol = 6 * k;
    guides = [];
    const others = shapes.filter(x => BOX.has(x.type) && !sel.has(x.id));
    const mb = moving.reduce((b, sh) => {
      const r = { x: sh.x + dx, y: sh.y + dy, w: sh.w, h: sh.h };
      return b ? { x: Math.min(b.x, r.x), y: Math.min(b.y, r.y), x2: Math.max(b.x2, r.x + r.w), y2: Math.max(b.y2, r.y + r.h) } : { x: r.x, y: r.y, x2: r.x + r.w, y2: r.y + r.h };
    }, null);
    if (!mb) return { dx, dy };
    const xs = [mb.x, (mb.x + mb.x2) / 2, mb.x2], ys = [mb.y, (mb.y + mb.y2) / 2, mb.y2];
    let bx = null, by = null;
    for (const o of others) {
      const oxs = [o.x, o.x + o.w / 2, o.x + o.w], oys = [o.y, o.y + o.h / 2, o.y + o.h];
      for (const a of xs) for (const b of oxs) if (Math.abs(a - b) < tol && (!bx || Math.abs(a - b) < Math.abs(bx.d))) bx = { d: b - a, at: b, o };
      for (const a of ys) for (const b of oys) if (Math.abs(a - b) < tol && (!by || Math.abs(a - b) < Math.abs(by.d))) by = { d: b - a, at: b, o };
    }
    if (bx) { dx += bx.d; guides.push({ x1: bx.at, x2: bx.at, y1: Math.min(mb.y, bx.o.y) - 20, y2: Math.max(mb.y2, bx.o.y + bx.o.h) + 20 }); }
    else if (grid) { const nx = snapV(mb.x); dx += nx - mb.x; }
    if (by) { dy += by.d; guides.push({ y1: by.at, y2: by.at, x1: Math.min(mb.x, by.o.x) - 20, x2: Math.max(mb.x2, by.o.x + by.o.w) + 20 }); }
    else if (grid) { const ny = snapV(mb.y); dy += ny - mb.y; }
    return { dx, dy };
  }

  /* ----- pointer interaction ----- */
  let drag = null;
  let marquee = null;
  let lastTap = null;
  const pointers = new Map();
  let pinch = null;

  function startPinch() {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, view: { ...view } };
    drag = null; marquee = null;
  }
  function onDown(e) {
    if (!edit) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && !opts.overlay) { startPinch(); return; }
    if (pointers.size > 1) return;
    hideTextEdit(true);
    svg.setPointerCapture?.(e.pointerId);
    const p = toSvg(e);
    const handle = e.target.closest?.('[data-handle]');
    const shapeEl = e.target.closest?.('[data-id]');
    if (tool === 'hand' || e.button === 1 || spaceDown) { drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, view: { ...view } }; return; }
    if (['rect', 'ellipse', 'triangle', 'diamond', 'hopper', 'text'].includes(tool)) {
      const sh = { id: newId(), type: tool, x: snapV(p.x), y: snapV(p.y), w: 1, h: 1, ...styleFor(tool) };
      shapes.push(sh); sel = new Set([sh.id]);
      drag = { kind: 'create', id: sh.id, x0: sh.x, y0: sh.y };
      render(); return;
    }
    if (tool === 'line' || tool === 'arrow') {
      const sn = snapAnchor(p);
      const sh = { id: newId(), type: 'line', x1: sn ? sn.p.x : snapV(p.x), y1: sn ? sn.p.y : snapV(p.y), x2: p.x, y2: p.y, from: sn ? { id: sn.id, anchor: sn.anchor } : null, to: null, stroke: lastStroke, strokeWidth: 2, arrowEnd: tool === 'arrow', route: 'straight' };
      shapes.push(sh); sel = new Set([sh.id]);
      drag = { kind: 'end', id: sh.id, which: 'to' };
      render(); return;
    }
    if (handle) {
      const sh = byId(handle.dataset.for);
      const hd = handle.dataset.handle;
      if (sh.type === 'line' && hd.startsWith('via:')) drag = { kind: 'via', id: sh.id, i: Number(hd.slice(4)) };
      else if (sh.type === 'line' && hd.startsWith('mid:')) {
        const i = Number(hd.slice(4));
        sh.via = [...(sh.via || [])];
        sh.via.splice(i, 0, { x: snapV(p.x), y: snapV(p.y) });
        drag = { kind: 'via', id: sh.id, i };
        render();
      } else if (sh.type === 'line') drag = { kind: 'end', id: sh.id, which: hd };
      else drag = { kind: 'resize', id: sh.id, h: hd, orig: { ...sh }, p0: p };
      return;
    }
    if (shapeEl) {
      const id = shapeEl.dataset.id;
      // Double-tap (touch or mouse) types into the shape. Detected here, because the first tap
      // re-renders the shape and the browser's own dblclick would lose its target.
      const now = Date.now();
      if (lastTap && lastTap.id === id && now - lastTap.t < 400) { lastTap = null; drag = null; sel = new Set([id]); render(); paintProps(); showTextEdit(byId(id)); return; }
      lastTap = { id, t: now };
      if (e.shiftKey) { if (sel.has(id)) sel.delete(id); else sel.add(id); }
      else if (!sel.has(id)) sel = new Set([id]);
      const orig = new Map([...sel].map(i => [i, clone(byId(i))]));
      drag = { kind: 'move', p0: p, orig, moved: false };
      render(); paintProps(); return;
    }
    if (!e.shiftKey) sel = new Set();
    marquee = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    render(); paintProps();
  }
  let raf = 0;
  function onMove(e) {
    if (!edit) return;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const f = Math.max(0.2, Math.min(5, pinch.d / d));
      const r = svg.getBoundingClientRect();
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const nw = pinch.view.w * f, nh = pinch.view.h * f;
      const fx = (pinch.cx - r.left) / r.width, fy = (pinch.cy - r.top) / r.height;
      view = { x: pinch.view.x + fx * (pinch.view.w - nw) - (cx - pinch.cx) * (nw / r.width), y: pinch.view.y + fy * (pinch.view.h - nh) - (cy - pinch.cy) * (nh / r.height), w: nw, h: nh };
      setViewBox(); schedule(); paintZoom(); return;
    }
    const p = toSvg(e);
    if (!drag) {
      if ((tool === 'line' || tool === 'arrow')) { const sn = snapAnchor(p); hoverAnchor = sn ? { id: sn.id, anchor: sn.anchor } : null; schedule(); }
      if (marquee) { marquee.x1 = p.x; marquee.y1 = p.y; schedule(); }
      return;
    }
    if (drag.kind === 'pan') {
      const k = scale();
      view = { ...drag.view, x: drag.view.x - (e.clientX - drag.sx) * k, y: drag.view.y - (e.clientY - drag.sy) * k };
      setViewBox(); schedule(); return;
    }
    if (drag.kind === 'create') {
      const sh = byId(drag.id);
      const x2 = snapV(p.x), y2 = snapV(p.y);
      let w = x2 - drag.x0, hh = y2 - drag.y0;
      if (e.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(hh)); w = Math.sign(w || 1) * m; hh = Math.sign(hh || 1) * m; }
      sh.x = Math.min(drag.x0, drag.x0 + w); sh.y = Math.min(drag.y0, drag.y0 + hh); sh.w = Math.abs(w); sh.h = Math.abs(hh);
      schedule(); return;
    }
    if (drag.kind === 'via') {
      const sh = byId(drag.id);
      if (sh?.via?.[drag.i]) { sh.via[drag.i] = { x: snapV(p.x), y: snapV(p.y) }; schedule(); }
      return;
    }
    if (drag.kind === 'end') {
      const sh = byId(drag.id);
      const sn = snapAnchor(p, null);
      const ref = sn && !(drag.which === 'to' ? sh.from?.id === sn.id : sh.to?.id === sn.id) ? { id: sn.id, anchor: sn.anchor } : null;
      hoverAnchor = ref;
      if (drag.which === 'to') { sh.to = ref; sh.x2 = ref ? sn.p.x : p.x; sh.y2 = ref ? sn.p.y : p.y; }
      else { sh.from = ref; sh.x1 = ref ? sn.p.x : p.x; sh.y1 = ref ? sn.p.y : p.y; }
      schedule(); return;
    }
    if (drag.kind === 'resize') {
      const sh = byId(drag.id), o = drag.orig;
      let { x, y, w, h: hh } = o;
      const dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
      if (drag.h.includes('e')) w = snapV(o.x + o.w + dx) - o.x;
      if (drag.h.includes('s')) hh = snapV(o.y + o.h + dy) - o.y;
      if (drag.h.includes('w')) { const nx = snapV(o.x + dx); w = o.x + o.w - nx; x = nx; }
      if (drag.h.includes('n')) { const ny = snapV(o.y + dy); hh = o.y + o.h - ny; y = ny; }
      if ((e.shiftKey || sh.type === 'image' || sh.type === 'icon' || sh.type === 'group') && drag.h.length === 2) {
        const ratio = o.w / o.h;
        if (w / hh > ratio) w = hh * ratio; else hh = w / ratio;
        if (drag.h.includes('w')) x = o.x + o.w - w;
        if (drag.h.includes('n')) y = o.y + o.h - hh;
      }
      if (w >= 8 && hh >= 8) Object.assign(sh, { x, y, w, h: hh });
      schedule(); return;
    }
    if (drag.kind === 'move') {
      let dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
      if (!drag.moved && Math.hypot(dx, dy) < 3 * scale()) return;
      drag.moved = true;
      const boxes = [...drag.orig.values()].filter(x => x.type !== 'line');
      ({ dx, dy } = alignSnap(boxes, dx, dy));
      for (const [id, o] of drag.orig) {
        const sh = byId(id); if (!sh) continue;
        if (sh.type === 'line') {
          if (!sh.from) { sh.x1 = o.x1 + dx; sh.y1 = o.y1 + dy; }
          if (!sh.to) { sh.x2 = o.x2 + dx; sh.y2 = o.y2 + dy; }
          if (o.via) sh.via = o.via.map(q => ({ x: q.x + dx, y: q.y + dy }));
        } else { sh.x = o.x + dx; sh.y = o.y + dy; }
      }
      schedule();
    }
  }
  function onUp(e) {
    if (!edit) return;
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    const d = drag; drag = null; guides = []; hoverAnchor = null;
    if (marquee) {
      const r = rectOf(marquee);
      if (r.width > 4 || r.height > 4) for (const sh of shapes) {
        const b = bbox(sh, shapes);
        if (b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.width && b.y + b.h <= r.y + r.height) sel.add(sh.id);
      }
      marquee = null; render(); paintProps(); return;
    }
    if (!d) return;
    if (d.kind === 'create') {
      const sh = byId(d.id);
      if (sh.w < 12 && sh.h < 12) { const def = defaultSize(sh.type); sh.w = def.w; sh.h = def.h; }
      tool = 'select'; paintToolbar();
      render(); paintProps(); commit();
      if (sh.type === 'text') showTextEdit(sh);
      return;
    }
    if (d.kind === 'end') {
      const sh = byId(d.id);
      const [a, b] = ends(sh, shapes);
      if (Math.hypot(a.x - b.x, a.y - b.y) < 6) { shapes = shapes.filter(x => x.id !== sh.id); sel.delete(sh.id); }
      if (tool !== 'select') { tool = 'select'; paintToolbar(); }
      render(); paintProps(); commit(); return;
    }
    if (d.kind === 'move' && !d.moved) { render(); return; }
    if (d.kind === 'pan') { render(); return; }
    render(); paintProps(); commit();
  }
  let scheduled = false;
  function schedule() { if (scheduled) return; scheduled = true; raf = requestAnimationFrame(() => { scheduled = false; render(); }); }

  const defaultSize = (type) => (type === 'text' ? { w: 160, h: 40 } : type === 'icon' ? { w: 48, h: 48 } : type === 'ellipse' ? { w: 110, h: 110 } : { w: 140, h: 80 });
  let lastFill = 'auto', lastStroke = '#141414';
  function styleFor(type) {
    if (type === 'text') return { fill: 'none', stroke: '#141414', strokeWidth: 0, text: 'Text', fontSize: 18, bold: true, textColor: '#141414' };
    return { fill: opts.overlay ? '#FFFFFF' : lastFill, stroke: lastStroke, strokeWidth: 2, text: '', fontSize: 14, radius: type === 'rect' ? 10 : 0 };
  }

  /* ----- text editing in place ----- */
  let editing = null;       // { id, idx } idx: a group's label child
  let editOrig = '';
  const editObj = () => { const sh = editing && byId(editing.id); return sh && editing.idx != null ? sh.children?.[editing.idx] : sh; };
  function showTextEdit(top) {
    if (!top || top.type === 'icon' || top.type === 'image') return;
    let sh = top, idx = null, b;
    if (top.type === 'group') {
      idx = labelIndex(top);
      if (idx < 0) return;
      sh = top.children[idx];
      b = placed(sh, top);
    }
    editing = { id: top.id, idx };
    editOrig = sh.text || '';
    const m = svg.getScreenCTM();
    const r = stage.getBoundingClientRect();
    b ||= sh.type === 'line' ? (() => { const [a, c] = ends(sh, shapes); return { x: (a.x + c.x) / 2 - 80, y: (a.y + c.y) / 2 - 20, w: 160, h: 40 }; })() : sh;
    const p1 = new DOMPoint(b.x, b.y).matrixTransform(m), p2 = new DOMPoint(b.x + b.w, b.y + b.h).matrixTransform(m);
    Object.assign(textEdit.style, { left: `${p1.x - r.left}px`, top: `${p1.y - r.top}px`, width: `${Math.max(120, p2.x - p1.x)}px`, height: `${Math.max(40, p2.y - p1.y)}px`, fontSize: `${((b.fontSize || sh.fontSize) || 14) / scale()}px`, textAlign: sh.align || 'center' });
    textEdit.value = sh.text || '';
    textEdit.hidden = false;
    setTimeout(() => { textEdit.focus(); textEdit.select(); }, 0);
  }
  function hideTextEdit(save) {
    if (!editing) return;
    const sh = editObj();
    editing = null; textEdit.hidden = true;
    if (!sh) return;
    sh.text = save ? textEdit.value : editOrig;
    render(); paintProps();
    if (sh.text !== editOrig) commit();
  }
  textEdit.addEventListener('blur', () => hideTextEdit(true));
  textEdit.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); hideTextEdit(false); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); hideTextEdit(true); }
    e.stopPropagation();
  });
  textEdit.addEventListener('input', () => { const sh = editObj(); if (sh) { sh.text = textEdit.value; render(); } });

  /* ----- actions ----- */
  const selected = () => shapes.filter(x => sel.has(x.id));
  function update(fn) { for (const sh of selected()) fn(sh); render(); paintProps(); commit(); }
  function remove() {
    if (!sel.size) return;
    const gone = new Set(sel);
    shapes = shapes.filter(x => !gone.has(x.id));
    for (const sh of shapes) if (sh.type === 'line') {
      if (sh.from && gone.has(sh.from.id)) { const [a] = ends({ ...sh, from: null }, shapes); sh.from = null; Object.assign(sh, { x1: a.x, y1: a.y }); }
      if (sh.to && gone.has(sh.to.id)) { sh.to = null; }
    }
    sel = new Set(); render(); paintProps(); commit();
  }
  function groupSelected() {
    const list = selected();
    if (list.length < 2) return;
    const ids = new Set(list.map(x => x.id));
    const at = shapes.findIndex(x => ids.has(x.id));
    const g = makeGroup(list, shapes);
    shapes = shapes.filter(x => !ids.has(x.id));
    shapes.splice(Math.min(at, shapes.length), 0, g);
    // connectors from outside keep following: they now attach to the group
    for (const l of shapes) if (l.type === 'line') {
      if (l.from && ids.has(l.from.id)) l.from = { id: g.id, anchor: l.from.anchor };
      if (l.to && ids.has(l.to.id)) l.to = { id: g.id, anchor: l.to.anchor };
    }
    sel = new Set([g.id]); render(); paintProps(); commit();
    toast('Grouped. It moves and resizes as one piece; save it to the library to reuse it.');
  }
  function ungroupSelected() {
    const g = selected().find(x => x.type === 'group');
    if (!g) return;
    const kids = g.children.map(c => ({ ...placed(c, g), id: newId() }));
    const bi = bodyIndex(g);
    if (g.zone) (kids[bi >= 0 ? bi : 0]).zone = g.zone;
    const at = shapes.indexOf(g);
    shapes.splice(at, 1, ...kids);
    for (const l of shapes) if (l.type === 'line') for (const end of ['from', 'to']) {
      if (l[end]?.id !== g.id) continue;
      if (bi >= 0) l[end] = { id: kids[bi].id, anchor: l[end].anchor };
      else { const [a, b] = ends({ ...l }, [...shapes, g]); const p = end === 'from' ? a : b; l[end] = null; if (end === 'from') Object.assign(l, { x1: p.x, y1: p.y }); else Object.assign(l, { x2: p.x, y2: p.y }); }
    }
    sel = new Set(kids.map(k => k.id)); render(); paintProps(); commit();
  }
  /** A selection as a library entry: a group as it is, any other shapes wrapped into one. */
  function asEntry(list, name) {
    const g = list.length === 1 && list[0].type === 'group' ? list[0] : makeGroup(list, shapes);
    return { id: newId(), name, w: g.w, h: g.h, cw: g.cw, ch: g.ch, children: clone(g.children), zone: g.zone || undefined };
  }
  async function saveToLibrary(name) {
    const list = selected();
    if (!list.length || !opts.library) return;
    const entry = asEntry(list, name.trim() || 'Untitled shape');
    if (list.length === 1 && list[0].type === 'group') { list[0].name = entry.name; commit(); }
    await opts.library.save(entry);
    paintProps();
  }
  function insertEntry(item) {
    addShape({ type: 'group', name: item.name, w: item.w, h: item.h, cw: item.cw || item.w, ch: item.ch || item.h, children: clone(item.children).map(c => ({ ...c, id: newId() })), ...(item.zone ? { zone: item.zone } : {}) });
  }
  function preview(item) {
    const pad = 6;
    const g = { id: 'pv', type: 'group', x: 0, y: 0, w: item.w, h: item.h, cw: item.cw || item.w, ch: item.ch || item.h, children: item.children };
    const v = s('svg', { viewBox: `${-pad} ${-pad} ${item.w + pad * 2} ${item.h + pad * 2}`, class: 'bd-lib-pv', 'aria-hidden': 'true' });
    v.append(drawShape(g, [], {}));
    return v;
  }
  function pickLibrary(anchorBtn) {
    const lib = opts.library;
    const items = lib.items();
    const pop = h('div', { class: 'bd-pop bd-lib', role: 'dialog', 'aria-label': 'Shape library' });
    const close = () => { pop.remove(); document.removeEventListener('pointerdown', outside, true); };
    const outside = (e) => { if (!pop.contains(e.target) && !anchorBtn.contains(e.target)) close(); };
    const groups = [['Your team’s shapes', items.filter(i => !i.builtin)], ['K3 line machines', items.filter(i => i.builtin)]];
    clear(pop,
      h('div', { class: 'bd-lib-head' }, icon('shapes'), h('strong', { text: 'Shape library' }),
        h('span', { class: 'muted small', text: 'Tap to add. Select a group, then Save in its panel, to add yours.' })),
      groups.map(([title, list]) => (list.length || title.startsWith('Your') ? [
        h('div', { class: 'bd-lib-title', text: title }),
        list.length ? h('div', { class: 'bd-lib-grid' }, list.map(item => h('div', { class: 'bd-lib-item' },
          h('button', { type: 'button', class: 'bd-lib-btn', title: `Add ${item.name}`, 'aria-label': `Add ${item.name}`, onclick: () => { close(); insertEntry(item); } },
            preview(item), h('span', { class: 'bd-lib-name', text: item.name }),
            item.by ? h('span', { class: 'bd-lib-by', text: item.by }) : null),
          !item.builtin && lib.remove ? h('button', { type: 'button', class: 'icon-btn small bd-lib-del', title: `Remove ${item.name} from the library`, 'aria-label': `Remove ${item.name}`, onclick: async () => { if (await lib.remove(item)) { close(); pickLibrary(anchorBtn); } } }, icon('trash')) : null)))
          : h('p', { class: 'muted small bd-lib-empty', text: 'Nothing saved yet. Group some shapes (select them, then Group), and save the group here: everyone on your team can then use it.' }),
      ] : null)));
    root.append(pop);
    const r = anchorBtn.getBoundingClientRect(), rr = root.getBoundingClientRect();
    pop.style.left = `${Math.max(0, Math.min(rr.width - Math.min(rr.width, 420), r.left - rr.left))}px`;
    pop.style.top = `${r.bottom - rr.top + 6}px`;
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  }
  function duplicate(list = selected(), offset = 24) {
    const map = new Map();
    const copies = list.map(sh => { const c = clone(sh); c.id = newId(); map.set(sh.id, c.id); return c; });
    for (const c of copies) {
      if (c.type === 'line') {
        c.from = c.from && map.has(c.from.id) ? { ...c.from, id: map.get(c.from.id) } : null;
        c.to = c.to && map.has(c.to.id) ? { ...c.to, id: map.get(c.to.id) } : null;
        const src = list.find(x => map.get(x.id) === c.id);
        const [a, b] = ends(src, shapes);
        if (!c.from) { c.x1 = a.x + offset; c.y1 = a.y + offset; }
        if (!c.to) { c.x2 = b.x + offset; c.y2 = b.y + offset; }
        if (c.via) c.via = c.via.map(q => ({ x: q.x + offset, y: q.y + offset }));
      } else { c.x += offset; c.y += offset; }
    }
    shapes.push(...copies); sel = new Set(copies.map(c => c.id)); render(); paintProps(); commit();
  }
  function arrange(front) {
    const picked = selected();
    shapes = front ? [...shapes.filter(x => !sel.has(x.id)), ...picked] : [...picked, ...shapes.filter(x => !sel.has(x.id))];
    render(); commit();
  }
  function align(how) {
    const boxes = selected().filter(x => x.type !== 'line');
    if (boxes.length < 2) return;
    const minX = Math.min(...boxes.map(b => b.x)), maxX = Math.max(...boxes.map(b => b.x + b.w));
    const minY = Math.min(...boxes.map(b => b.y)), maxY = Math.max(...boxes.map(b => b.y + b.h));
    for (const b of boxes) {
      if (how === 'left') b.x = minX; if (how === 'right') b.x = maxX - b.w; if (how === 'center') b.x = (minX + maxX) / 2 - b.w / 2;
      if (how === 'top') b.y = minY; if (how === 'bottom') b.y = maxY - b.h; if (how === 'middle') b.y = (minY + maxY) / 2 - b.h / 2;
    }
    render(); commit();
  }
  function addShape(sh) {
    const c = { x: view.x + view.w / 2 - sh.w / 2, y: view.y + view.h / 2 - sh.h / 2 };
    const full = { id: newId(), ...sh, x: snapV(c.x), y: snapV(c.y) };
    shapes.push(full); sel = new Set([full.id]); render(); paintProps(); commit();
    return full;
  }
  async function addImage(file) {
    try {
      const src = await fileToDataUrl(file);
      const img = await loadImage(src);
      const maxW = Math.min(view.w * 0.5, 420);
      const w = Math.min(maxW, img.width), hh = w * (img.height / img.width);
      addShape({ type: 'image', src, w, h: hh, strokeWidth: 0, stroke: '#141414' });
    } catch { toast('That image could not be read.', { tone: 'bad' }); }
  }
  function pickImage() {
    const input = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    input.addEventListener('change', () => { const f = input.files?.[0]; if (f) addImage(f); input.remove(); });
    document.body.append(input); input.click();
  }
  function pickIcon(anchorBtn) {
    const pop = h('div', { class: 'bd-pop', role: 'dialog', 'aria-label': 'Icons' },
      Object.keys(PATHS).map(name => h('button', { type: 'button', class: 'bd-icon-btn', title: name, 'aria-label': name, onclick: () => { pop.remove(); addShape({ type: 'icon', icon: name, w: 48, h: 48, stroke: lastStroke === '#141414' ? '#F40009' : lastStroke, strokeWidth: 2 }); } }, icon(name))));
    root.append(pop);
    const r = anchorBtn.getBoundingClientRect(), rr = root.getBoundingClientRect();
    pop.style.left = `${Math.max(0, Math.min(rr.width - 300, r.left - rr.left))}px`;
    pop.style.top = `${r.bottom - rr.top + 6}px`;
    const close = (e) => { if (!pop.contains(e.target) && e.target !== anchorBtn) { pop.remove(); document.removeEventListener('pointerdown', close, true); } };
    setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
  }
  function zoom(f, cx, cy) {
    const nw = view.w * f, nh = view.h * f;
    const px = cx ?? view.x + view.w / 2, py = cy ?? view.y + view.h / 2;
    view = { x: px - (px - view.x) * f, y: py - (py - view.y) * f, w: nw, h: nh };
    setViewBox(); render(); paintZoom();
  }
  function fit() {
    if (!shapes.length) { view = { x: 0, y: 0, w: doc.w, h: doc.h }; }
    else {
      const bs = shapes.map(sh => bbox(sh, shapes));
      const x = Math.min(...bs.map(b => b.x)) - 30, y = Math.min(...bs.map(b => b.y)) - 30;
      const x2 = Math.max(...bs.map(b => b.x + b.w)) + 30, y2 = Math.max(...bs.map(b => b.y + b.h)) + 30;
      const r = svg.getBoundingClientRect();
      const aspect = r.width && r.height ? r.width / r.height : doc.w / doc.h;
      let w = x2 - x, hh = y2 - y;
      if (w / hh > aspect) hh = w / aspect; else w = hh * aspect;
      view = { x: (x + x2) / 2 - w / 2, y: (y + y2) / 2 - hh / 2, w, h: hh };
    }
    setViewBox(); render(); paintZoom();
  }

  /* ----- keyboard and paste ----- */
  let spaceDown = false;
  function onKey(e) {
    if (!edit || !root.isConnected) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
    if (typing) return;
    if (document.getElementById('modal')?.open) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === ' ' && e.type === 'keydown') { spaceDown = true; return; }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redoIt(); else undoIt(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redoIt(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
    if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); if (e.shiftKey) ungroupSelected(); else groupSelected(); return; }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); sel = new Set(shapes.map(x => x.id)); render(); paintProps(); return; }
    if (mod && e.key.toLowerCase() === 'c') { if (sel.size) { clipboard = clone(selected()); } return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.size) { e.preventDefault(); remove(); } return; }
    if (e.key === 'Escape') { sel = new Set(); tool = 'select'; paintToolbar(); render(); paintProps(); return; }
    if (e.key === 'Enter' && sel.size === 1) { e.preventDefault(); showTextEdit(selected()[0]); return; }
    if (e.key.startsWith('Arrow') && sel.size) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      update(sh => { if (sh.type === 'line') { if (!sh.from) { sh.x1 += dx; sh.y1 += dy; } if (!sh.to) { sh.x2 += dx; sh.y2 += dy; } if (sh.via) sh.via = sh.via.map(q => ({ x: q.x + dx, y: q.y + dy })); } else { sh.x += dx; sh.y += dy; } });
      return;
    }
    if (!mod && !e.altKey) {
      const map = { v: 'select', h: 'hand', r: 'rect', o: 'ellipse', t: 'text', l: 'line', a: 'arrow' };
      if (map[e.key.toLowerCase()]) { tool = map[e.key.toLowerCase()]; paintToolbar(); }
    }
  }
  const onKeyUp = (e) => { if (e.key === ' ') spaceDown = false; };
  function onPaste(e) {
    if (!edit || !root.isConnected) return;
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '');
    if (typing) return;
    const items = [...(e.clipboardData?.items || [])];
    const img = items.find(i => i.type.startsWith('image/'));
    if (img) { e.preventDefault(); addImage(img.getAsFile()); return; }
    const text = e.clipboardData?.getData('text/plain');
    if (clipboard.length && (!text || !text.trim())) { e.preventDefault(); duplicate(clipboard, 30); return; }
    if (text && text.trim()) { e.preventDefault(); addShape({ type: 'text', text: text.trim().slice(0, 500), w: 220, h: 60, fill: 'none', strokeWidth: 0, stroke: '#141414', fontSize: 16, textColor: '#141414' }); }
  }
  function onWheel(e) {
    if (!edit || opts.overlay) return;
    e.preventDefault();
    const p = toSvg(e);
    if (e.ctrlKey || e.metaKey) zoom(Math.exp(e.deltaY * 0.01), p.x, p.y);
    else { const k = scale(); view = { ...view, x: view.x + e.deltaX * k, y: view.y + e.deltaY * k }; setViewBox(); render(); }
  }

  if (edit) {
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); pinch = null; drag = null; render(); });
    svg.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('paste', onPaste);
  }

  /* ----- toolbar ----- */
  const TOOLS = [
    ['select', 'Select (V)', toolIcon('M5 3l14 8-6 2-3 6z')], ['hand', 'Pan (H, or drag with two fingers)', toolIcon('M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-7a1.5 1.5 0 0 1 3 0V12M14 6.5a1.5 1.5 0 0 1 3 0V13M17 8.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L4 15.5a1.6 1.6 0 0 1 2.6-1.9L8 15.5')],
    ['rect', 'Rectangle (R)', toolIcon('M4 6h16v12H4z')], ['ellipse', 'Circle / ellipse (O)', toolIcon('M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z')],
    ['triangle', 'Triangle', toolIcon('M12 4l9 16H3z')], ['diamond', 'Diamond (decision)', toolIcon('M12 3l9 9-9 9-9-9z')],
    ['hopper', 'Hopper / trapezoid', toolIcon('M3 6h18l-4 12H7z')], ['text', 'Text (T)', toolIcon('M5 6V4h14v2M12 4v16M9 20h6')],
    ['line', 'Line (L): snaps to shapes', toolIcon('M5 19L19 5')], ['arrow', 'Arrow (A): snaps to shapes', toolIcon('M5 19L19 5M10 5h9v9')],
  ];
  function toolIcon(d) { const el = document.createElementNS(NS, 'svg'); el.setAttribute('viewBox', '0 0 24 24'); el.setAttribute('class', 'ico'); el.append(s('path', { d })); return el; }
  const zoomLabel = h('span', { class: 'bd-zoom' });
  function paintZoom() { if (opts.overlay) return; zoomLabel.textContent = `${Math.round((doc.w / view.w) * 100)}%`; }
  function paintToolbar() {
    if (!edit) return;
    svg.dataset.tool = tool;
    clear(toolbar,
      h('div', { class: 'bd-group' }, TOOLS.filter(([k]) => !(opts.overlay && (k === 'hand' || k === 'hopper' || k === 'diamond'))).map(([k, label, ico]) => h('button', {
        type: 'button', class: 'bd-tool' + (tool === k ? ' on' : ''), title: label, 'aria-label': label, 'aria-pressed': String(tool === k),
        onclick: () => { tool = k; paintToolbar(); },
      }, ico.cloneNode(true)))),
      h('div', { class: 'bd-group' },
        h('button', { type: 'button', class: 'bd-tool', title: 'Add an image (or paste one)', 'aria-label': 'Add an image', onclick: pickImage }, icon('upload')),
        (() => { const b = h('button', { type: 'button', class: 'bd-tool', title: 'Add an icon', 'aria-label': 'Add an icon' }, icon('zap')); b.addEventListener('click', () => pickIcon(b)); return b; })(),
        opts.library ? (() => { const b = h('button', { type: 'button', class: 'bd-tool bd-lib-tool', title: 'Shape library: machines and your team’s saved shapes', 'aria-label': 'Shape library' }, icon('shapes'), h('span', { class: 'bd-tool-t', text: 'Library' })); b.addEventListener('click', () => pickLibrary(b)); return b; })() : null),
      h('div', { class: 'bd-group' },
        h('button', { type: 'button', class: 'bd-tool', title: 'Undo (Ctrl/Cmd+Z)', 'aria-label': 'Undo', onclick: undoIt }, toolIcon('M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3')),
        h('button', { type: 'button', class: 'bd-tool', title: 'Redo', 'aria-label': 'Redo', onclick: redoIt }, toolIcon('M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3'))),
      opts.overlay ? null : h('div', { class: 'bd-group' },
        h('button', { type: 'button', class: 'bd-tool', title: 'Zoom out', 'aria-label': 'Zoom out', onclick: () => zoom(1.25) }, icon('minus')),
        zoomLabel,
        h('button', { type: 'button', class: 'bd-tool', title: 'Zoom in', 'aria-label': 'Zoom in', onclick: () => zoom(0.8) }, icon('plus')),
        h('button', { type: 'button', class: 'bd-tool', title: 'Fit to screen', 'aria-label': 'Fit', onclick: fit }, toolIcon('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5')),
        h('button', { type: 'button', class: 'bd-tool' + (grid ? ' on' : ''), title: 'Grid and snapping', 'aria-label': 'Grid', 'aria-pressed': String(grid), onclick: () => { grid = !grid; paintToolbar(); render(); } }, icon('grid'))),
      opts.extraTools ? h('div', { class: 'bd-group bd-extra' }, opts.extraTools) : null);
    paintZoom();
  }

  /* ----- properties ----- */
  function swatchRow(current, onPick, { none = false, auto = false } = {}) {
    const custom = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(current) ? current : '#888888', 'aria-label': 'Custom colour' });
    custom.addEventListener('change', () => onPick(custom.value));
    return h('div', { class: 'bd-swatches' },
      auto ? h('button', { type: 'button', class: 'bd-sw auto' + (current === 'auto' ? ' on' : ''), title: 'Zone colour', 'aria-label': 'Zone colour', onclick: () => onPick('auto') }, 'Z') : null,
      none ? h('button', { type: 'button', class: 'bd-sw none' + (current === 'none' ? ' on' : ''), title: 'None', 'aria-label': 'No colour', onclick: () => onPick('none') }) : null,
      COLOURS.map(c => h('button', { type: 'button', class: 'bd-sw' + (String(current).toLowerCase() === c.toLowerCase() ? ' on' : ''), style: { background: c }, title: c, 'aria-label': c, onclick: () => onPick(c) })),
      h('label', { class: 'bd-sw custom', title: 'Any colour' }, icon('sliders'), custom));
  }
  const seg = (options, current, onPick) => h('div', { class: 'seg small bd-seg' }, options.map(([v, label]) => h('button', { type: 'button', class: 'seg-btn' + (current === v ? ' on' : ''), 'aria-pressed': String(current === v), onclick: () => onPick(v) }, label)));
  const row = (label, ...kids) => h('div', { class: 'bd-row' }, h('span', { class: 'bd-label', text: label }), h('div', { class: 'bd-ctl' }, kids));
  const range = (min, max, step, value, onInput) => { const r = h('input', { type: 'range', min, max, step, value }); r.addEventListener('change', () => onInput(Number(r.value))); return r; };

  function paintProps() {
    if (!edit) return;
    const list = selected();
    if (!list.length) {
      clear(props, h('div', { class: 'bd-props-empty' },
        h('p', { class: 'muted small' }, icon('info'), ' Pick a tool and drag on the canvas. Lines and arrows snap to the dots on a shape and follow it when it moves. Double-tap a shape to type in it. Paste an image or text straight in.'),
        h('p', { class: 'muted small', text: 'Select several shapes and Group them to make one piece, like a machine; save a group to the Library so your team can reuse it. Drag the small square in the middle of a line to bend it.' }),
        h('p', { class: 'muted small', text: 'Two fingers (or the hand tool) to pan; pinch or Ctrl + scroll to zoom. Shift keeps proportions.' })));
      return;
    }
    const sh = list[0];
    const isLine = list.every(x => x.type === 'line');
    const isGroup = list.length === 1 && sh.type === 'group';
    const body = targetsOf(sh, 'body')[0] || sh;
    const label = targetsOf(sh, 'label')[0] || null;
    const hasText = list.some(x => x.type !== 'icon' && x.type !== 'image' && (x.type !== 'group' || labelIndex(x) >= 0));
    // style changes reach inside groups: fill and border to the body, text to the label
    const each = (role, fn) => update(x => targetsOf(x, role).forEach(fn));
    const ta = h('textarea', { rows: '2', class: 'bd-ta', 'aria-label': 'Text' });
    ta.value = (isGroup ? label?.text : sh.text) || '';
    ta.addEventListener('change', () => each('label', x => { if (x.type !== 'icon' && x.type !== 'image') x.text = ta.value; }));
    const zoneSel = opts.zones ? h('select', { 'aria-label': 'Linked zone' },
      h('option', { value: '', text: 'Not linked' }),
      opts.zones.map(z => h('option', { value: z, selected: sh.zone === z, text: z }))) : null;
    zoneSel?.addEventListener('change', () => update(x => { if (zoneSel.value) x.zone = zoneSel.value; else delete x.zone; }));
    const libName = h('input', { type: 'text', class: 'bd-lib-in', placeholder: 'Name, e.g. Filler', 'aria-label': 'Name in the library', maxlength: '60', value: sh.name || sh.zone || '' });
    const canGroup = list.length > 1;
    clear(props,
      h('div', { class: 'bd-props-head' }, h('strong', { text: list.length > 1 ? `${list.length} selected` : labelOf(sh) }),
        h('div', { class: 'row-gap' },
          canGroup ? h('button', { type: 'button', class: 'icon-btn small', title: 'Group (Ctrl/Cmd+G)', 'aria-label': 'Group', onclick: groupSelected }, icon('group')) : null,
          isGroup ? h('button', { type: 'button', class: 'icon-btn small', title: 'Ungroup (Ctrl/Cmd+Shift+G)', 'aria-label': 'Ungroup', onclick: ungroupSelected }, icon('ungroup')) : null,
          h('button', { type: 'button', class: 'icon-btn small', title: 'Duplicate (Ctrl/Cmd+D)', 'aria-label': 'Duplicate', onclick: () => duplicate() }, icon('copy')),
          h('button', { type: 'button', class: 'icon-btn small', title: 'Bring to front', 'aria-label': 'Bring to front', onclick: () => arrange(true) }, toolIcon('M8 8h12v12H8zM4 4h12v2M4 4v12h2')),
          h('button', { type: 'button', class: 'icon-btn small', title: 'Send to back', 'aria-label': 'Send to back', onclick: () => arrange(false) }, toolIcon('M4 4h12v12H4zM20 8v12H8v-2')),
          h('button', { type: 'button', class: 'icon-btn small danger', title: 'Delete', 'aria-label': 'Delete', onclick: remove }, icon('trash')))),
      canGroup ? h('button', { type: 'button', class: 'btn ghost small bd-group-btn', onclick: groupSelected }, icon('group'), `Group these ${list.length} into one piece`) : null,
      list.length > 1 && list.some(x => x.type !== 'line') ? row('Align', h('div', { class: 'row-gap' },
        [['left', 'M4 4v16M8 7h12M8 12h8M8 17h10'], ['center', 'M12 4v16M6 7h12M8 12h8M7 17h10'], ['right', 'M20 4v16M4 7h12M8 12h8M6 17h10'],
          ['top', 'M4 4h16M7 8v12M12 8v8M17 8v10'], ['middle', 'M4 12h16M7 6v12M12 8v8M17 7v10'], ['bottom', 'M4 20h16M7 4v12M12 8v8M17 6v10']]
          .map(([k, d]) => h('button', { type: 'button', class: 'icon-btn small', title: `Align ${k}`, 'aria-label': `Align ${k}`, onclick: () => align(k) }, toolIcon(d))))) : null,
      opts.library && !isLine && (isGroup || list.length > 1 || sh.type !== 'line') ? row('Library', h('div', { class: 'bd-lib-save' }, libName,
        h('button', { type: 'button', class: 'btn small', onclick: () => saveToLibrary(libName.value) }, icon('save'), 'Save')),
        h('span', { class: 'muted small', text: isGroup ? 'Saved shapes appear in the Library for everyone on your team.' : 'Saved as one piece in the Library for everyone on your team.' })) : null,
      !isLine && body.type !== 'icon' && body.type !== 'image' ? row('Fill', swatchRow(body.fill ?? 'none', (v) => { lastFill = v; each('body', x => { if (x.type !== 'line') x.fill = v; }); }, { none: true, auto: !!opts.zones })) : null,
      row(sh.type === 'icon' ? 'Colour' : isLine ? 'Line' : 'Border', swatchRow(body.stroke ?? '#141414', (v) => { lastStroke = v; each('body', x => { x.stroke = v; if (!x.strokeWidth && x.type !== 'text') x.strokeWidth = 2; }); })),
      row('Thickness', seg([[0, '0'], [1, '1'], [2, '2'], [4, '4'], [6, '6'], [10, '10'], ...(isLine ? [[16, '16']] : [])], body.strokeWidth ?? 2, (v) => each('body', x => { x.strokeWidth = v; }))),
      body.type !== 'icon' && body.type !== 'image' ? row('Style', seg([['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ...(isLine ? [['belt', 'Conveyor']] : [])], body.dash || 'solid',
        (v) => each('body', x => { x.dash = v; if (v === 'belt' && x.type === 'line' && (x.strokeWidth ?? 2) < 10) { x.strokeWidth = 16; if (x.stroke === '#141414') x.stroke = '#DCDCD8'; } }))) : null,
      isLine ? [
        row('Ends', seg([['none', 'None'], ['end', '→'], ['both', '↔']], sh.arrowStart && sh.arrowEnd ? 'both' : sh.arrowEnd ? 'end' : 'none', (v) => update(x => { x.arrowEnd = v !== 'none'; x.arrowStart = v === 'both'; }))),
        row('Route', seg([['straight', 'Straight'], ['elbow', 'Elbow']], sh.route || 'straight', (v) => update(x => { x.route = v; if (v === 'elbow') delete x.via; })),
          sh.via?.length ? h('button', { type: 'button', class: 'link-btn small', onclick: () => update(x => { delete x.via; }) }, icon('close'), 'Remove bends') : null),
      ] : null,
      body.type === 'rect' || body.type === 'image' ? row('Corners', range(0, 60, 2, body.radius ?? 0, (v) => each('body', x => { x.radius = v; }))) : null,
      hasText ? [
        row('Text', ta),
        row('Text colour', swatchRow((label || sh).textColor || '#141414', (v) => each('label', x => { x.textColor = v; }))),
        row('Size', range(9, 64, 1, Math.round((label || sh).fontSize || 14), (v) => each('label', x => { x.fontSize = v; })),
          h('button', { type: 'button', class: 'icon-btn small' + ((label || sh).bold ? ' on' : ''), title: 'Bold', 'aria-label': 'Bold', onclick: () => each('label', x => { x.bold = !(label || sh).bold; }) }, h('strong', { text: 'B' }))),
        !isLine ? row('Align', seg([['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], (label || sh).align || 'center', (v) => each('label', x => { x.align = v; })),
          seg([['top', 'Top'], ['middle', 'Mid'], ['bottom', 'Bottom']], (label || sh).valign || 'middle', (v) => each('label', x => { x.valign = v; }))) : null,
      ] : null,
      row('Opacity', range(0.1, 1, 0.05, sh.opacity ?? 1, (v) => update(x => { x.opacity = v; }))),
      zoneSel ? row('Zone link', zoneSel, h('span', { class: 'muted small', text: 'Tapping it in the Guide opens that zone.' })) : null,
      isLine && (sh.from || sh.to) ? h('button', { type: 'button', class: 'link-btn small', onclick: () => update(x => { if (x.type === 'line') { const [a, b] = ends(x, shapes); Object.assign(x, { x1: a.x, y1: a.y, x2: b.x, y2: b.y, from: null, to: null }); } }) }, icon('close'), 'Detach from shapes') : null);
  }
  const labelOf = (sh) => (sh.type === 'group' ? (sh.name || 'Group') : ({ rect: 'Rectangle', ellipse: 'Ellipse', triangle: 'Triangle', diamond: 'Diamond', hopper: 'Hopper', text: 'Text', line: sh.dash === 'belt' ? 'Conveyor' : sh.arrowEnd ? 'Arrow' : 'Line', image: 'Image', icon: 'Icon', path: 'Drawing' })[sh.type]) + (sh.zone && sh.zone !== sh.name ? ` · ${sh.zone}` : '');

  /* ----- export ----- */
  function svgString({ pad = 20 } = {}) {
    const bs = shapes.map(sh => bbox(sh, shapes));
    const x = bs.length ? Math.min(...bs.map(b => b.x)) - pad : 0, y = bs.length ? Math.min(...bs.map(b => b.y)) - pad : 0;
    const w = bs.length ? Math.max(...bs.map(b => b.x + b.w)) + pad - x : doc.w, hh = bs.length ? Math.max(...bs.map(b => b.y + b.h)) + pad - y : doc.h;
    const out = s('svg', { xmlns: NS, viewBox: `${x} ${y} ${w} ${hh}`, width: Math.round(w), height: Math.round(hh), 'font-family': '-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' },
      s('rect', { x, y, width: w, height: hh, fill: '#FFFFFF' }));
    for (const sh of shapes) { const g = drawShape(sh, shapes, { fillFor: opts.fillFor }); g.querySelectorAll('.bd-hit').forEach(n => n.remove()); out.append(g); }
    return { text: new XMLSerializer().serializeToString(out), w, h: hh };
  }
  async function exportPng() {
    const { text, w, h: hh } = svgString();
    const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text));
    const c = document.createElement('canvas');
    const k = 2;
    c.width = Math.round(w * k); c.height = Math.round(hh * k);
    const ctx = c.getContext('2d');
    ctx.scale(k, k); ctx.drawImage(img, 0, 0, w, hh);
    return new Promise(res => c.toBlob(res, 'image/png'));
  }

  paintToolbar(); render(); paintProps();
  if (edit && !opts.overlay) requestAnimationFrame(fit);
  return {
    el: root,
    svg,
    parts: { toolbar, props, stage, root },
    doc: () => ({ ...doc, shapes: clone(shapes) }),
    setShapes(next) { shapes = clone(next); sel = new Set(); render(); paintProps(); undo.length = 0; undo.push(JSON.stringify(shapes)); },
    render, fit, exportPng, svgString,
    destroy() {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('paste', onPaste);
      cancelAnimationFrame(raf);
    },
  };
}

/* ---------- images ---------- */
export function loadImage(src) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src; });
}
/** Read an image file, scaled to at most 1200 px so the team's setup stays small. */
export async function fileToDataUrl(file, max = 1200) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const png = /png|svg|gif|webp/.test(file.type);
    return c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}
