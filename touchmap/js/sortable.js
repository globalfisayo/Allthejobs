// Drag to reorder, by finger or mouse: pick an item up by its handle and move it past its
// neighbours along one axis. The DOM order changes as you drag; `onDrop` gets the new order of
// the items' data-key values. Arrow keys on a focused handle move it one place.
export function sortable(container, { items = '[data-key]', handle = null, axis = 'y', onDrop } = {}) {
  const list = () => [...container.querySelectorAll(`:scope > ${items}`)];
  const order = () => list().map(el => el.dataset.key);
  let drag = null;

  container.addEventListener('pointerdown', (e) => {
    const item = e.target.closest(items);
    if (!item || item.parentElement !== container) return;
    if (e.target.closest('button, input, select, a') && !(handle && e.target.closest(handle))) return;
    if (handle && !e.target.closest(handle)) return;
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    drag = { item, start: axis === 'y' ? e.clientY : e.clientX, before: order().join('|'), id: e.pointerId };
    item.classList.add('dragging');
    container.classList.add('sorting');
    try { item.setPointerCapture(e.pointerId); } catch { /* not every element can capture */ }
  });

  container.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const pos = axis === 'y' ? e.clientY : e.clientX;
    drag.item.style.transform = axis === 'y' ? `translateY(${pos - drag.start}px)` : `translateX(${pos - drag.start}px)`;
    // past a neighbour's middle: swap places, and keep the item under the pointer
    for (const other of list()) {
      if (other === drag.item) continue;
      const r = other.getBoundingClientRect();
      const mid = axis === 'y' ? r.top + r.height / 2 : r.left + r.width / 2;
      const mine = drag.item.getBoundingClientRect();
      const myMid = (axis === 'y' ? mine.top + mine.height / 2 : mine.left + mine.width / 2);
      const isAfter = list().indexOf(other) > list().indexOf(drag.item);
      if ((isAfter && myMid > mid) || (!isAfter && myMid < mid)) {
        const before = drag.item.getBoundingClientRect();
        if (isAfter) other.after(drag.item); else other.before(drag.item);
        const after = drag.item.getBoundingClientRect();
        drag.start += axis === 'y' ? after.top - before.top : after.left - before.left;
        drag.item.style.transform = axis === 'y' ? `translateY(${pos - drag.start}px)` : `translateX(${pos - drag.start}px)`;
      }
    }
  });

  const end = (e) => {
    if (!drag || (e.pointerId != null && e.pointerId !== drag.id)) return;
    const { item, before } = drag;
    drag = null;
    item.classList.remove('dragging');
    item.style.transform = '';
    container.classList.remove('sorting');
    const now = order();
    if (now.join('|') !== before) onDrop?.(now);
  };
  container.addEventListener('pointerup', end);
  container.addEventListener('pointercancel', end);

  container.addEventListener('keydown', (e) => {
    const keys = axis === 'y' ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
    if (!keys.includes(e.key)) return;
    const item = e.target.closest(items);
    if (!item || (handle && !e.target.closest(handle))) return;
    const els = list();
    const i = els.indexOf(item);
    const j = e.key === keys[0] ? i - 1 : i + 1;
    if (j < 0 || j >= els.length) return;
    e.preventDefault();
    const now = order();
    [now[i], now[j]] = [now[j], now[i]];
    onDrop?.(now, now[j]);
  });
}
