// Everything lives in this browser's localStorage, one key, saved on every change.
import { FRAMEWORK, DEFAULT_INFO } from './framework.js';
import { blankTouch, uid } from './model.js';

const KEY = 'touchmap:v1';

function blankTimer() {
  return { accMs: 0, runningSince: null, firstStart: null, lastStop: null };
}

function newRunObj(name, info = {}) {
  return { id: uid(), name, createdAt: new Date().toISOString(), info: { ...DEFAULT_INFO, ...info }, touches: [], lastExport: null };
}

function fresh() {
  const run = newRunObj('Observation 1');
  return {
    format: 1,
    observer: '',
    activeRunId: run.id,
    runs: { [run.id]: run },
    lists: { zones: [...FRAMEWORK.zones], people: [...FRAMEWORK.people] },
    draft: blankTouch(),
    timer: blankTimer(),
    lastSavedId: null,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.format !== 1 || !s.runs || !Object.keys(s.runs).length) return null;
    if (!s.runs[s.activeRunId]) s.activeRunId = Object.keys(s.runs)[0];
    s.lists ??= { zones: [...FRAMEWORK.zones], people: [...FRAMEWORK.people] };
    s.draft ??= blankTouch();
    s.timer ??= blankTimer();
    for (const r of Object.values(s.runs)) r.info = { ...DEFAULT_INFO, ...r.info };
    return s;
  } catch { return null; }
}

export const state = load() || fresh();

let storageOk = true;
export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOk = true;
  } catch {
    storageOk = false;
  }
  return storageOk;
}
export const storageHealthy = () => storageOk;

let persistAsked = false;
export async function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
}

export const activeRun = () => state.runs[state.activeRunId];
export const runsList = () => Object.values(state.runs).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

export function createRun(name, info) {
  const prev = activeRun();
  const run = newRunObj(name, info ?? { ...prev?.info, from: '', to: '', skus: '', changeovers: '', cips: '' });
  state.runs[run.id] = run;
  state.activeRunId = run.id;
  save();
  return run;
}

export function deleteRun(id) {
  delete state.runs[id];
  if (!Object.keys(state.runs).length) {
    const run = newRunObj('Observation 1');
    state.runs[run.id] = run;
  }
  if (!state.runs[state.activeRunId]) state.activeRunId = runsList()[0].id;
  save();
}

export function nextRunName() {
  const n = Object.keys(state.runs).length + 1;
  return `Observation ${n}`;
}

/* ---------- timer ---------- */
export const timer = {
  elapsed(now = Date.now()) {
    const t = state.timer;
    return t.accMs + (t.runningSince ? now - t.runningSince : 0);
  },
  running: () => !!state.timer.runningSince,
  start(now = Date.now()) {
    const t = state.timer;
    if (t.runningSince) return;
    t.runningSince = now;
    t.firstStart ??= now;
    save();
  },
  stop(now = Date.now()) {
    const t = state.timer;
    if (!t.runningSince) return;
    t.accMs += now - t.runningSince;
    t.runningSince = null;
    t.lastStop = now;
    save();
  },
  reset() { state.timer = blankTimer(); save(); },
  /** Copy the stopwatch into a draft: seconds, first start and last stop. */
  stampInto(draft, now = Date.now()) {
    const ms = this.elapsed(now);
    const t = state.timer;
    draft.timedSec = ms > 0 ? ms / 1000 : null;
    draft.start = t.firstStart ? new Date(t.firstStart).toISOString() : null;
    draft.end = t.runningSince ? new Date(now).toISOString() : (t.lastStop ? new Date(t.lastStop).toISOString() : null);
    return draft;
  },
};
