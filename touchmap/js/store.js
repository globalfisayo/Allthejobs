// Everything lives in this browser's localStorage, one key, saved on every change.
// With Team sync on, changed touches and runs are also queued for the team's Google Sheet.
import { FRAMEWORK, DEFAULT_INFO, applyFramework } from './framework.js';
import { applyColors } from './colors.js';
import { blankTouch, uid } from './model.js';

const KEY = 'touchmap:v1';

function blankTimer() {
  return { accMs: 0, runningSince: null, firstStart: null, lastStop: null };
}

function blankSync() {
  return { url: '', key: '', since: 0, dirtyTouches: {}, dirtyRuns: {}, tombstones: [], lastOk: null, error: null, dirtySetup: false, serverV: 0 };
}

function newRunObj(name, info = {}, { localOnly = false, pristine = false } = {}) {
  const now = new Date().toISOString();
  return {
    id: uid(), name, createdAt: now, updatedAt: pristine ? null : now,
    info: { ...DEFAULT_INFO, ...info, operatorNames: [...(info.operatorNames || [])] }, touches: [], lastExport: null, localOnly,
  };
}

function fresh() {
  const run = newRunObj('Observation 1', {}, { pristine: true });
  return {
    format: 1,
    observer: '',
    activeRunId: run.id,
    runs: { [run.id]: run },
    lists: { zones: [...FRAMEWORK.zones], people: [...FRAMEWORK.people] },
    draft: blankTouch(),
    timer: blankTimer(),
    lastSavedId: null,
    sync: blankSync(),
    framework: null,        // null = the template's framework; else { categories } edited in Setup
    setupUpdatedAt: null,   // when framework or lists last changed (for sync)
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
    s.sync = { ...blankSync(), ...s.sync };
    for (const r of Object.values(s.runs)) {
      r.info = { ...DEFAULT_INFO, ...r.info, operatorNames: [...(r.info?.operatorNames || [])] };
      if (r.updatedAt === undefined) r.updatedAt = r.touches.length ? r.createdAt : null;
      // Demo runs stay on the device, never in the team's sheet.
      if (/^Demo shift/.test(r.name)) r.localOnly = true;
    }
    return s;
  } catch { return null; }
}

export const state = load() || fresh();
state.framework ??= null;
state.setupUpdatedAt ??= null;
state.colors ??= null;       // null = the default colours
state.diagram ??= null;      // null = the default Guide diagram
state.annotations ??= {};    // chart id → annotation shapes
state.chartKinds ??= {};     // chart id → chosen chart type
state.library ??= [];        // the team's saved diagram shapes (groups), shared through Setup sync
state.profile ??= null;      // this device's user: { name, bu, plant, line, at } from onboarding
applyFramework(state.framework);
applyColors(state.colors);

/** The touch framework or the lists changed in Setup: save, and share with the team. */
export function markSetup() {
  state.setupUpdatedAt = new Date().toISOString();
  state.sync.dirtySetup = true;
  save();
  hooks.dirty?.();
}

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

/* ---------- change tracking for Team sync ---------- */
export const hooks = { dirty: null };
const nowIso = () => new Date().toISOString();

/** A touch was added or edited in this run. */
export function markTouch(run, id) {
  if (!run || run.localOnly) return;
  state.sync.dirtyTouches[id] = run.id;
  if (!run.updatedAt) markRun(run, { quiet: true });
  hooks.dirty?.();
}

/** The run's name or Run Info changed. */
export function markRun(run, { quiet = false } = {}) {
  if (!run) return;
  run.updatedAt = nowIso();
  if (!run.localOnly) state.sync.dirtyRuns[run.id] = 1;
  if (!quiet) hooks.dirty?.();
}

/** Delete a touch and leave a marker so the deletion reaches other devices. */
export function removeTouch(run, id) {
  const i = run.touches.findIndex(t => t.id === id);
  if (i < 0) return null;
  const [gone] = run.touches.splice(i, 1);
  if (!run.localOnly) {
    delete state.sync.dirtyTouches[id];
    state.sync.tombstones.push({ kind: 'touch', id, runId: run.id, deletedAt: nowIso() });
    hooks.dirty?.();
  }
  return gone;
}

/** Undo a delete: the touch comes back newer than its delete marker, so it wins everywhere. */
export function restoreTouch(run, t) {
  t.updatedAt = nowIso();
  run.touches.push(t);
  state.sync.tombstones = state.sync.tombstones.filter(x => x.id !== t.id);
  markTouch(run, t.id);
}

/** Queue every run and touch on this device: used when a device first connects. */
export function markEverything() {
  if (state.setupUpdatedAt) state.sync.dirtySetup = true;
  for (const run of Object.values(state.runs)) {
    if (run.localOnly) continue;
    if (run.updatedAt || run.touches.length) state.sync.dirtyRuns[run.id] = 1;
    for (const t of run.touches) state.sync.dirtyTouches[t.id] = run.id;
  }
}

export const pendingCount = () =>
  Object.keys(state.sync.dirtyTouches).length + Object.keys(state.sync.dirtyRuns).length + state.sync.tombstones.length + (state.sync.dirtySetup && state.sync.serverV !== 1 ? 1 : 0);

/** Person chips for a run: its operator names first, then roles (generic "Op n" hidden when names exist). */
export function peopleFor(run) {
  const names = (run?.info?.operatorNames || []).filter(Boolean);
  const roles = names.length ? state.lists.people.filter(p => !/^Op \d+$/.test(p)) : state.lists.people;
  return [...new Set([...names, ...roles])];
}

/* ---------- runs ---------- */
export const activeRun = () => state.runs[state.activeRunId];
export const runsList = () => Object.values(state.runs).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

export function createRun(name, info, { localOnly = false } = {}) {
  const prev = activeRun();
  // A new run keeps the line, crew and reference frame, but not the dates, SKUs, times or finish.
  const run = newRunObj(name, info ?? { ...prev?.info, from: '', to: '', skus: '', changeovers: '', cips: '', obsStart: '', obsEnd: '', finishedAt: '' }, { localOnly });
  state.runs[run.id] = run;
  state.activeRunId = run.id;
  if (!localOnly) markRun(run);
  save();
  return run;
}

export function deleteRun(id) {
  const run = state.runs[id];
  if (run && !run.localOnly) {
    for (const t of run.touches) delete state.sync.dirtyTouches[t.id];
    delete state.sync.dirtyRuns[id];
    state.sync.tombstones.push({ kind: 'run', id, deletedAt: nowIso() });
    hooks.dirty?.();
  }
  delete state.runs[id];
  ensureRun();
  save();
}

/** Always keep at least one run, and an active one. */
export function ensureRun() {
  if (!Object.keys(state.runs).length) {
    const run = newRunObj('Observation 1', {}, { pristine: true });
    state.runs[run.id] = run;
  }
  if (!state.runs[state.activeRunId]) state.activeRunId = runsList()[runsList().length - 1].id;
}

export function nextRunName() {
  const n = Object.values(state.runs).filter(r => !r.localOnly).length + 1;
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

/* ---------- this device's user ---------- */
export const profileName = () => state.profile?.name || state.observer || '';
