// One stopwatch for the whole app: the Capture dock and the bar on every other screen
// both drive it, and both repaint when it changes.
import { blankTouch, finalise, missingFields, totalMinutes, fmtMin, FIELD_LABEL } from './model.js';
import { state, save, activeRun, timer, askPersist, markTouch, removeTouch } from './store.js';
import { toast } from './ui.js';

const listeners = new Set();
/** Subscribe to stopwatch events ('start', 'stop', 'reset', 'count', 'saved', 'undo', 'changed'). Returns an unsubscribe. */
export function onWatch(fn) { listeners.add(fn); return () => listeners.delete(fn); }
// Deliver to a snapshot: a listener that re-renders may subscribe again, and must not get this event twice.
const emit = (evt) => [...listeners].forEach(fn => { if (listeners.has(fn)) { try { fn(evt); } catch (e) { console.error(e); } } });

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

/** Missing answers to highlight the next time Capture renders (set when saving from elsewhere). */
let pendingMissing = null;
export const takePendingMissing = () => { const m = pendingMissing; pendingMissing = null; return m; };

let openEditorFn = null;
/** log.js registers its editor here, so the stopwatch can offer "Edit #n" without a circular import. */
export const registerEditor = (fn) => { openEditorFn = fn; };

export const watch = {
  running: () => timer.running(),
  elapsed: () => timer.elapsed(),
  draft: () => state.draft,
  nextNumber: () => activeRun().touches.length + 1,

  start() { timer.start(); askPersist(); keepAwake(true); emit('start'); },
  stop() { timer.stop(); keepAwake(false); timer.stampInto(state.draft); save(); emit('stop'); },
  resume() { this.start(); },
  reset() {
    const d = state.draft;
    timer.reset(); d.timedSec = null; d.start = null; d.end = null;
    keepAwake(false); save(); emit('reset');
  },
  plusOne() { const d = state.draft; d.count = (Number(d.count) || 0) + 1; save(); emit('count'); },

  /**
   * Save the draft as a touch. Unless allowIncomplete, refuses when answers are missing and
   * returns them, so the caller can show the form. Returns { ok, touch?, num?, missing? }.
   */
  save({ allowIncomplete = false, now = Date.now(), quiet = false, fromElsewhere = false } = {}) {
    const run = activeRun();
    const draft = state.draft;
    if (timer.running()) timer.stop(now);
    timer.stampInto(draft, now);
    const missing = missingFields(draft);
    if (missing.length && !allowIncomplete) {
      save(); keepAwake(false); emit('stop');
      if (fromElsewhere) { pendingMissing = missing; location.hash = '#capture'; }
      toast('Answer ' + missing.map(m => FIELD_LABEL[m]).join(', ') + ' to save.', { tone: 'bad' });
      return { ok: false, missing };
    }
    const t = finalise({ ...draft, device: state.deviceId }, { observer: state.observer, now: new Date(now) });
    run.touches.push(t);
    markTouch(run, t.id);
    state.lastSavedId = t.id;
    state.draft = blankTouch({ zone: draft.zone, who: draft.who });
    timer.reset();
    save(); askPersist(); keepAwake(false);
    const num = run.touches.length;
    if (!quiet) {
      toast(t.incomplete ? `Touch #${num} saved. It still needs details.` : `Touch #${num} saved · ${fmtMin(totalMinutes(t))} min`,
        { action: { label: 'Undo', fn: () => this.undo(t.id) } });
    }
    emit('saved');
    return { ok: true, touch: t, num };
  },

  /** A change of reason is a new touch, even without a pause: save this one, start the next now. */
  next() {
    const now = Date.now();
    const r = this.save({ allowIncomplete: true, now, quiet: true });
    if (!r.ok) return r;
    timer.start(now);
    keepAwake(true);
    toast(r.touch.incomplete ? `#${r.num} saved, needs details · now timing #${r.num + 1}` : `#${r.num} saved · now timing #${r.num + 1}`,
      { action: openEditorFn ? { label: `Edit #${r.num}`, fn: () => openEditorFn(r.touch.id, () => emit('changed')) } : null, timeout: 6000 });
    emit('start');
    return r;
  },

  undo(id) {
    const run = activeRun();
    const t = removeTouch(run, id);
    if (!t) return;
    if (!timer.running() && timer.elapsed() === 0) {
      // Bring it back into the form, with its stopwatch, so nothing is lost.
      state.draft = { ...t, createdAt: null, updatedAt: null, incomplete: false };
      if (t.timedSec) state.timer = { accMs: t.timedSec * 1000, runningSince: null, firstStart: t.start ? Date.parse(t.start) : null, lastStop: t.end ? Date.parse(t.end) : null };
    }
    state.lastSavedId = null;
    save();
    toast('Touch removed from the log and put back in the form.');
    emit('undo');
  },

  changed() { emit('changed'); },
  keepAwake,
};
