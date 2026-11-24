// The stopwatch bar on every screen except Capture: start, stop, count, next touch and save
// from anywhere; the answers stay one tap away on Capture.
import { CAT_BY_CODE } from './framework.js';
import { fmtClock, missingFields } from './model.js';
import { state, timer } from './store.js';
import { watch, onWatch } from './stopwatch.js';
import { h, clear, icon } from './ui.js';

let el = null;
let tick = null;
let visible = false;

function summary() {
  const d = state.draft;
  const parts = [d.zone, CAT_BY_CODE[d.category]?.code, d.type].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No answers yet';
}

const btn = (cls, ico, label, onclick, text) =>
  h('button', { type: 'button', class: 'mb-btn ' + cls, 'aria-label': label, title: label, onclick }, icon(ico), text ? h('span', { class: 'mb-txt', text }) : null);

function paint() {
  if (!el) return;
  const running = timer.running();
  const ms = timer.elapsed();
  const stopped = !running && ms > 0;
  el.classList.toggle('running', running);
  el.classList.toggle('stopped', stopped);
  const miss = missingFields(state.draft).length;
  let actions;
  if (running) {
    actions = [
      btn('mb-stop', 'stop', 'Stop', () => watch.stop(), 'Stop'),
      btn('mb-ghost', 'plus', `Add one to the count (now ${state.draft.count})`, () => watch.plusOne(), `${state.draft.count}`),
      btn('mb-ghost', 'next', 'Save this touch and start the next one', () => watch.next(), 'Next'),
    ];
  } else if (stopped) {
    actions = [
      btn('mb-primary', 'check', miss ? 'Answer the questions, then save' : 'Save touch', () => watch.save({ fromElsewhere: true }), 'Save'),
      btn('mb-ghost', 'play', 'Resume', () => watch.resume()),
      btn('mb-ghost', 'reset', 'Reset the stopwatch', () => watch.reset()),
    ];
  } else {
    actions = [btn('mb-start', 'play', 'Start a touch', () => watch.start(), 'Start')];
  }
  clear(el,
    h('a', { class: 'mb-main', href: '#capture', 'aria-label': 'Open Capture to answer the questions' },
      h('span', { class: 'mb-state' }, running ? h('span', { class: 'rec' }) : icon('timer')),
      h('span', { class: 'mb-col' },
        h('span', { class: 'mb-clock', text: fmtClock(ms) }),
        h('span', { class: 'mb-sum', text: `#${watch.nextNumber()} · ${summary()}` })),
      miss && (running || stopped) ? h('span', { class: 'mb-miss', title: `${miss} answers missing` }, icon('edit')) : null),
    h('div', { class: 'mb-actions' }, actions));
}

function paintClock() {
  const c = el?.querySelector('.mb-clock');
  if (c) c.textContent = fmtClock(timer.elapsed());
}

function syncTick() {
  clearInterval(tick); tick = null;
  if (visible && timer.running()) tick = setInterval(paintClock, 100);
}

export function initMinibar() {
  el = document.getElementById('minibar');
  onWatch(() => { if (visible) { paint(); syncTick(); } });
}

/** Show on every route except Capture (which has the full dock) and Present mode. */
export function showMinibar(show) {
  visible = show && !document.body.classList.contains('present');
  if (!el) return;
  el.hidden = !visible;
  document.body.classList.toggle('has-minibar', visible);
  if (visible) paint();
  syncTick();
}
