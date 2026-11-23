// Capture: the stopwatch dock and the live context form.
import { CAT_BY_CODE } from './framework.js';
import { blankTouch, finalise, missingFields, totalMinutes, perOccurrence, fmtClock, fmtMin, minSec, FIELD_LABEL } from './model.js';
import { state, save, activeRun, timer, askPersist } from './store.js';
import { touchForm } from './form.js';
import { openEditor } from './log.js';
import { h, clear, icon, toast, fmt } from './ui.js';

let tick = null;
let wakeLock = null;

async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release(); wakeLock = null;
    }
  } catch { /* the screen may simply sleep */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && timer.running()) keepAwake(true);
});

export function stopTicking() { clearInterval(tick); tick = null; }

export function renderCapture(root, { onSaved } = {}) {
  stopTicking();
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
    live: () => { const ms = timer.elapsed(); return ms > 0 ? ms / 1000 : null; },
    onChange: () => { save(); paintSummary(); },
  });

  const formHead = h('div', { class: 'form-head' },
    h('h1', { class: 'view-title', text: 'Log a touch' }),
    h('div', { class: 'row-gap' },
      lastTouch() ? h('button', { type: 'button', class: 'btn ghost small', onclick: sameAsLast }, icon('copy'), 'Same as last') : null,
      h('button', { type: 'button', class: 'btn ghost small', onclick: clearForm }, icon('reset'), 'Clear answers')));

  clear(root, h('section', { class: 'capture' }, dock, h('div', { class: 'capture-form' }, formHead, form.el)));

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
        row('Zone', draft.zone), row('Category', cat ? cat.name : ''), row('Type', draft.type),
        row('Touch type', draft.touchType),
        row('Total', per == null ? (draft.count ? `${draft.count} counted, not timed` : '') : `${fmtMin(total)} min (${draft.count} × ${minSec(per)})`)),
      miss.length ? h('p', { class: 'sum-miss', text: 'Still to answer: ' + miss.map(m => FIELD_LABEL[m]).join(', ') }) : h('p', { class: 'sum-ok' }, icon('check'), 'Ready to save'));
  }

  function row(k, v) {
    return [h('dt', { text: k }), h('dd', { class: v ? '' : 'nil', text: v || '–' })];
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
    const n = run.touches.length + 1;
    clear(statusEl, running ? h('span', { class: 'rec' }) : null, running ? 'Timing' : (ms > 0 ? 'Stopped' : 'Ready'));
    clear(metaEl, h('span', { text: `Touch #${n}` }),
      state.timer.firstStart ? h('span', { text: ` · started ${fmt.timeSec(new Date(state.timer.firstStart).toISOString())}` }) : null);

    let btns;
    if (running) {
      btns = [
        h('button', { type: 'button', class: 'btn stop xl', onclick: stop }, icon('stop'), 'Stop'),
        h('button', { type: 'button', class: 'btn tally', onclick: plusOne, 'aria-label': `Add one to the count, now ${draft.count}` }, icon('plus'), h('span', { text: '1' }), h('span', { class: 'tally-n', text: `count ${draft.count}` })),
        h('button', { type: 'button', class: 'btn next', onclick: nextTouch, title: 'Save this touch and start timing the next one now' }, icon('next'), 'Next touch'),
      ];
    } else if (ms > 0) {
      btns = [
        h('button', { type: 'button', class: 'btn primary xl', onclick: () => saveTouch() }, icon('check'), 'Save touch'),
        h('button', { type: 'button', class: 'btn ghost', onclick: resume }, icon('play'), 'Resume'),
        h('button', { type: 'button', class: 'btn ghost', onclick: resetTimer }, icon('reset'), 'Reset'),
      ];
    } else {
      btns = [
        h('button', { type: 'button', class: 'btn start xl', onclick: start }, icon('play'), 'Start touch'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => saveTouch(), title: 'Save without the stopwatch: type the duration, or count only' }, icon('check'), 'Save untimed'),
      ];
    }
    clear(btnRow, btns);
    paintClock();
  }

  function startTicking() {
    stopTicking();
    if (timer.running()) tick = setInterval(paintClock, 100);
  }

  function start() {
    timer.start(); askPersist(); keepAwake(true);
    paintButtons(); startTicking(); paintSummary();
  }
  function stop() {
    timer.stop(); keepAwake(false); stopTicking();
    timer.stampInto(draft); save();
    paintButtons(); paintSummary();
  }
  function resume() { start(); }
  function plusOne() {
    draft.count = (Number(draft.count) || 0) + 1;
    save(); form.sync(); paintButtons(); paintSummary();
  }

  function resetTimer() {
    timer.reset(); draft.timedSec = null; draft.start = null; draft.end = null;
    save(); paintButtons(); paintSummary();
  }

  /** Save the draft as a touch. Returns true when it was stored. */
  function saveTouch({ allowIncomplete = false, now = Date.now(), quiet = false } = {}) {
    if (timer.running()) timer.stop(now);
    timer.stampInto(draft, now);
    const miss = missingFields(draft);
    if (miss.length && !allowIncomplete) {
      form.markMissing(miss);
      toast('Answer ' + miss.map(m => FIELD_LABEL[m]).join(', ') + ' to save.', { tone: 'bad' });
      paintButtons();
      return false;
    }
    const t = finalise(draft, { observer: state.observer, now: new Date(now) });
    run.touches.push(t);
    state.lastSavedId = t.id;
    const carry = { zone: draft.zone, who: draft.who };
    state.draft = blankTouch(carry);
    timer.reset();
    save(); askPersist();
    const num = run.touches.length;
    if (!quiet) toast(t.incomplete ? `Touch #${num} saved. It still needs details.` : `Touch #${num} saved · ${fmtMin(totalMinutes(t))} min`,
      { action: { label: 'Undo', fn: () => undo(t.id) } });
    onSaved?.();
    if (!quiet) renderCapture(root, { onSaved });
    return true;
  }

  /** A change of reason is a new touch, even without a pause. */
  function nextTouch() {
    const now = Date.now();
    const ok = saveTouch({ allowIncomplete: true, now, quiet: true });
    if (!ok) return;
    const saved = run.touches[run.touches.length - 1];
    timer.start(now);
    keepAwake(true);
    renderCapture(root, { onSaved });
    const num = run.touches.length;
    toast(saved.incomplete ? `#${num} saved, needs details · now timing #${num + 1}` : `#${num} saved · now timing #${num + 1}`,
      { action: { label: `Edit #${num}`, fn: () => openEditor(saved.id, () => renderCapture(root, { onSaved })) }, timeout: 6000 });
  }

  function undo(id) {
    const i = run.touches.findIndex(t => t.id === id);
    if (i < 0) return;
    const [t] = run.touches.splice(i, 1);
    if (!timer.running() && timer.elapsed() === 0) {
      // Bring it back into the form, with its stopwatch, so nothing is lost.
      state.draft = { ...t, createdAt: null, updatedAt: null, incomplete: false };
      if (t.timedSec) state.timer = { accMs: t.timedSec * 1000, runningSince: null, firstStart: t.start ? Date.parse(t.start) : null, lastStop: t.end ? Date.parse(t.end) : null };
    }
    state.lastSavedId = null;
    save();
    toast(`Touch removed from the log.`);
    renderCapture(root, { onSaved });
  }

  paintButtons(); paintSummary(); paintLast();
  if (timer.running()) { startTicking(); keepAwake(true); }
}
