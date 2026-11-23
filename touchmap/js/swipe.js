// Swipe a row: left to delete, right to edit (iOS Mail style).
// Horizontal drags are claimed by the row; vertical drags still scroll the page.
import { h, icon } from './ui.js';

export function swipeable(row, { onLeft, onRight, leftLabel = 'Delete', rightLabel = 'Edit' }) {
  const wrap = h('div', { class: 'swipe' },
    h('div', { class: 'swipe-bg', 'aria-hidden': 'true' },
      h('span', { class: 'sw sw-right' }, icon('edit'), rightLabel),
      h('span', { class: 'sw sw-left' }, leftLabel, icon('trash'))),
    row);

  let x0 = null, y0 = 0, dx = 0, pid = null, mode = null, armed = false, swallowClick = false;
  const limit = () => Math.min(140, wrap.offsetWidth * 0.32);
  const set = (x, animate) => {
    row.style.transition = animate ? 'transform .22s ease' : 'none';
    row.style.transform = x ? `translateX(${x}px)` : '';
  };
  const reset = () => { set(0, true); wrap.classList.remove('to-left', 'to-right', 'armed'); armed = false; };

  row.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; pid = e.pointerId; mode = null;
  });
  row.addEventListener('pointermove', (e) => {
    if (x0 == null || e.pointerId !== pid) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!mode) {
      if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
      mode = Math.abs(mx) > Math.abs(my) * 1.2 ? 'h' : 'v';
      if (mode === 'v') { x0 = null; return; }
      try { row.setPointerCapture(pid); } catch { /* fine */ }
      wrap.classList.add('dragging');
    }
    dx = mx;
    // Resist beyond the threshold, so it feels like a commit point.
    const L = limit();
    const shown = Math.abs(dx) > L ? Math.sign(dx) * (L + (Math.abs(dx) - L) * 0.35) : dx;
    set(shown, false);
    wrap.classList.toggle('to-left', dx < 0);
    wrap.classList.toggle('to-right', dx > 0);
    const nowArmed = Math.abs(dx) >= L;
    if (nowArmed !== armed) { armed = nowArmed; wrap.classList.toggle('armed', armed); if (armed) navigator.vibrate?.(8); }
  });
  const end = () => {
    if (x0 == null) return;
    x0 = null;
    if (mode !== 'h') return;
    wrap.classList.remove('dragging');
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 350);
    if (armed && dx < 0) {
      set(-wrap.offsetWidth, true);
      setTimeout(() => onLeft?.(), 180);
    } else if (armed && dx > 0) {
      reset();
      setTimeout(() => onRight?.(), 120);
    } else reset();
  };
  row.addEventListener('pointerup', end);
  row.addEventListener('pointercancel', () => { if (mode === 'h') { x0 = null; wrap.classList.remove('dragging'); reset(); } else x0 = null; });
  // A swipe must not also count as a tap.
  wrap.addEventListener('click', (e) => { if (swallowClick) { e.preventDefault(); e.stopPropagation(); } }, true);
  return wrap;
}
