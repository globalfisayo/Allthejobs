/* panzoom.js — drag / wheel / pinch pan-zoom for an <svg> with a world <g> */

export function makePanZoom(stage, svg, world, opts = {}) {
  let s = 1, tx = 0, ty = 0;
  const minS = opts.min || 0.35, maxS = opts.max || 4;
  const onZoom = opts.onZoom || (() => {});
  const pointers = new Map();
  let lastPinch = null, moved = false;

  function apply() {
    world.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(3)})`);
    onZoom(s);
  }
  function clientToLocal(cx, cy) {
    const r = stage.getBoundingClientRect();
    return [cx - r.left, cy - r.top];
  }
  function zoomAt(cx, cy, factor) {
    const ns = Math.min(maxS, Math.max(minS, s * factor));
    const [lx, ly] = clientToLocal(cx, cy);
    // scale the SVG viewport coords: local px map 1:1 because svg has no viewBox scaling? we set viewBox = stage size externally
    const k = ns / s;
    tx = lx - k * (lx - tx);
    ty = ly - k * (ly - ty);
    s = ns;
    apply();
  }

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.008 : 0.0016));
    zoomAt(e.clientX, e.clientY, factor);
  }, { passive: false });

  let captured = false;
  stage.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    moved = false;
  });
  stage.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
      if (Math.abs(dx) + Math.abs(dy) > 2 && !moved) {
        moved = true;
        if (!captured) { try { stage.setPointerCapture(e.pointerId); captured = true; } catch { /* ok */ } }
      }
      if (!moved) return;
      tx += dx; ty += dy;
      apply();
    } else if (pointers.size === 2) {
      if (!captured) { try { stage.setPointerCapture(e.pointerId); captured = true; } catch { /* ok */ } }
      const pts = [...pointers.values()];
      const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      const cx = (pts[0][0] + pts[1][0]) / 2, cy = (pts[0][1] + pts[1][1]) / 2;
      if (lastPinch) zoomAt(cx, cy, d / lastPinch);
      lastPinch = d;
      moved = true;
    }
  });
  const up = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinch = null;
    if (!pointers.size) captured = false;
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);

  return {
    apply,
    zoomIn: () => zoomAt(stage.clientWidth / 2 + stage.getBoundingClientRect().left, stage.clientHeight / 2 + stage.getBoundingClientRect().top, 1.35),
    zoomOut: () => zoomAt(stage.clientWidth / 2 + stage.getBoundingClientRect().left, stage.clientHeight / 2 + stage.getBoundingClientRect().top, 1 / 1.35),
    /* fit a world-space box into the viewport */
    fit(box, pad = 40, o = {}) {
      const W = stage.clientWidth, H = stage.clientHeight;
      const bw = box.w + pad * 2, bh = box.h + pad * 2;
      s = Math.min(maxS, Math.max(minS, Math.min(W / bw, H / bh)));
      if (o.minReadable && s < o.minReadable) s = o.minReadable;
      tx = (W - s * box.w) / 2 - s * box.x;
      ty = o.alignTop ? 18 - s * box.y : (H - s * box.h) / 2 - s * box.y;
      apply();
    },
    center(x, y, targetS) {
      if (targetS) s = Math.min(maxS, Math.max(minS, targetS));
      tx = stage.clientWidth / 2 - s * x;
      ty = stage.clientHeight / 2 - s * y;
      apply();
    },
    get scale() { return s; },
    get didMove() { return moved; },
  };
}
