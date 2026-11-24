// Capture: the full stopwatch dock and the live context form.
import { CAT_BY_CODE } from './framework.js';
import { missingFields, totalMinutes, perOccurrence, fmtClock, fmtMin, minSec, FIELD_LABEL } from './model.js';
import { state, save, activeRun, timer, peopleFor } from './store.js';
import { touchForm } from './form.js';
import { watch, onWatch, takePendingMissing } from './stopwatch.js';
import { h, clear, icon, toast, fmt } from './ui.js';

/** Renders Capture; returns a cleanup for when the view is left. */
export function renderCapture(root) {
  let tick = null;
  const run = activeRun();
  const draft = state.draft;

  const timeEl = h('div', { class: 'clock', role: 'timer', 'aria-live': 'off' });
  const statusEl = h('div', { class: 'dock-status' });
  const metaEl = h('div', { class: 'dock-meta' });
  const btnRow = h('div', { class: 'dock-btns' });
  const summaryEl = h('div', { class: 'dock-summary' });
  const lastEl = h('div', { class: 'dock-last' });
  const dock = h('aside', { class: 'dock', 'aria-label': 'Stopwatch' },
    h('div', { class: 'dock-card' },
      h('div', { class: 'dock-top' }, statusEl, metaEl),
      timeEl,
      btnRow),
    summaryEl, lastEl);

  const form = touchForm(draft, {
    lists: state.lists,
    people: peopleFor(run),
    live: () => { const ms = timer.elapsed(); return ms > 0 ? ms / 1000 : null; },
    onChange: () => { save(); paintSummary(); },
  });

  const formHead = h('div', { class: 'form-head' },
    h('h1', { class: 'view-title' }, icon('hand', 'title-ico'), 'Log a touch'),
    h('div', { class: 'row-gap' },
      lastTouch() ? h('button', { type: 'button', class: 'btn ghost small', onclick: sameAsLast }, icon('copy'), 'Same as last') : null,
      h('button', { type: 'button', class: 'btn ghost small', onclick: clearForm }, icon('reset'), 'Clear')));

  clear(root, h('section', { class: 'capture' }, dock, h('div', { class: 'capture-form' }, formHead, form.el)));

  const pending = takePendingMissing();
  if (pending) setTimeout(() => form.markMissing(pending), 50);

  function lastTouch() {
    return run.touches.find(t => t.id === state.lastSavedId) || run.touches[run.touches.length - 1] || null;
  }

  function sameAsLast() {
    const l = lastTouch(); if (!l) return;
    Object.assign(draft, { zone: l.zone, who: l.who, planned: l.planned, category: l.category, type: l.type, touchType: l.touchType });
    form.refreshAll(); save(); paintSummary();
    toast('Copied the answers from the last touch.');
  }

  function clearForm() {
    Object.assign(draft, { planned: '', category: '', type: '', touchType: '', count: 1, countMode: 'all', perOccMin: null, durManual: false, description: '' });
    form.refreshAll(); save(); paintSummary();
  }

  let lastSecond = -1;
  function paintClock() {
    const ms = timer.elapsed();
    timeEl.textContent = fmtClock(ms);
    form.sync();
    const sec = Math.floor(ms / 1000);
    if (sec !== lastSecond) { lastSecond = sec; paintSummary(); }
  }

  function paintSummary() {
    const cat = CAT_BY_CODE[draft.category];
    const probe = timer.stampInto({ ...draft });
    const total = totalMinutes(probe);
    const per = perOccurrence(probe);
    const miss = missingFields(draft);
    clear(summaryEl,
      h('div', { class: 'sum-h', text: 'This touch' }),
      h('dl', { class: 'sum-list' },
        row('pin', draft.zone), row('tag', cat ? cat.name : ''), row('hand', draft.type),
        row('layers', draft.touchType),
        row('clock', per == null ? (draft.count ? `${draft.count} counted, not timed` : '') : `${fmtMin(total)} min (${draft.count} × ${minSec(per)})`)),
      miss.length ? h('p', { class: 'sum-miss', text: 'To answer: ' + miss.map(m => FIELD_LABEL[m]).join(', ') }) : h('p', { class: 'sum-ok' }, icon('check'), 'Ready to save'));
  }

  function row(ico, v) {
    return [h('dt', {}, icon(ico)), h('dd', { class: v ? '' : 'nil', text: v || '–' })];
  }

  function paintLast() {
    const l = run.touches.find(t => t.id === state.lastSavedId);
    if (!l) { clear(lastEl); return; }
    clear(lastEl,
      h('div', { class: 'sum-h', text: 'Last saved' }),
      h('p', {}, h('span', { class: 'code ' + (CAT_BY_CODE[l.category]?.planned === false ? 'code-u' : 'code-p'), text: l.category || '?' }), ' ', l.type || 'needs details',
        h('span', { class: 'muted', text: ` · ${fmtMin(totalMinutes(l))} min · ${fmt.time(l.start || l.createdAt)}` })));
  }

  function paintButtons() {
    const running = timer.running();
    const ms = timer.elapsed();
    dock.classList.toggle('running', running);
    dock.classList.toggle('stopped', !running && ms > 0);
    clear(statusEl, running ? h('span', { class: 'rec' }) : null, running ? 'Timing' : (ms > 0 ? 'Stopped' : 'Ready'));
    clear(metaEl, h('span', { text: `Touch #${watch.nextNumber()}` }),
      state.timer.firstStart ? h('span', { text: ` · ${fmt.timeSec(new Date(state.timer.firstStart).toISOString())}` }) : null);

    let btns;
    if (running) {
      btns = [
        h('button', { type: 'button', class: 'btn stop xl', onclick: () => watch.stop() }, icon('stop'), 'Stop'),
        h('button', { type: 'button', class: 'btn tally', onclick: () => watch.plusOne(), 'aria-label': `Add one to the count, now ${state.draft.count}` }, icon('plus'), h('span', { text: '1' }), h('span', { class: 'tally-n', text: `count ${state.draft.count}` })),
        h('button', { type: 'button', class: 'btn next', onclick: () => watch.next(), title: 'Save this touch and start timing the next one now' }, icon('next'), 'Next touch'),
      ];
    } else if (ms > 0) {
      btns = [
        h('button', { type: 'button', class: 'btn primary xl', onclick: saveNow }, icon('check'), 'Save touch'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => watch.resume() }, icon('play'), 'Resume'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => watch.reset() }, icon('reset'), 'Reset'),
      ];
    } else {
      btns = [
        h('button', { type: 'button', class: 'btn start xl', onclick: () => watch.start() }, icon('play'), 'Start touch'),
        h('button', { type: 'button', class: 'btn ghost', onclick: saveNow, title: 'Save without the stopwatch: type the duration, or count only' }, icon('check'), 'Save untimed'),
      ];
    }
    clear(btnRow, btns);
    paintClock();
  }

  function saveNow() {
    const r = watch.save();
    if (!r.ok) form.markMissing(r.missing);
  }

  function startTicking() {
    clearInterval(tick); tick = null;
    if (timer.running()) tick = setInterval(paintClock, 100);
  }

  const off = onWatch((evt) => {
    if (evt === 'saved' || evt === 'undo' || evt === 'changed') { cleanup(); renderAgain(); return; }
    paintButtons(); paintSummary(); startTicking();
  });

  function cleanup() { clearInterval(tick); tick = null; off(); }
  function renderAgain() { currentCleanup = renderCapture(root); }
  let currentCleanup = null;

  paintButtons(); paintSummary(); paintLast(); startTicking();
  return () => { if (currentCleanup) currentCleanup(); else cleanup(); };
}
