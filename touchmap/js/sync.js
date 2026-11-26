// Team sync: one shared log across phones and tablets, kept in the team's Google Sheet.
// Every change is queued on the device first, so logging never waits for the network;
// a sync sends the queue and brings back what the other devices changed since last time.
import { DEFAULT_INFO, applyFramework } from './framework.js';
import { applyColors } from './colors.js';
import { state, save, hooks, markEverything, pendingCount, ensureRun, isPassiveCopy } from './store.js';
import { syncCells, runCells, cleanTouch, cleanInfo } from './export.js';

const APPS_SCRIPT = /^https:\/\/script\.google\.com\/(a\/[A-Za-z0-9.-]+\/)?macros\/s\/[A-Za-z0-9_-]+\/exec$/;
const LOCAL_TEST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^\s]*$/;

/** Only a Google Apps Script web app (or a local test server) may receive the team's touches. */
export function validSyncUrl(url) {
  const u = String(url || '').trim();
  return APPS_SCRIPT.test(u) || (LOCAL_TEST.test(u) && LOCAL_TEST.test(location.href));
}

const newer = (a, b) => String(a || '') > String(b || '');
const listeners = new Set();
export const onSync = (fn) => listeners.add(fn);
const emit = (changed) => [...listeners].forEach(fn => { try { fn(changed); } catch { /* a view failing must not stop sync */ } });

let inflight = null;
let again = false;
let debounce = null;
let busy = false;

export const isConnected = () => !!state.sync.url;

export function status() {
  const s = state.sync;
  if (!s.url) return { kind: 'off', label: 'Not connected' };
  const pending = pendingCount();
  if (busy) return { kind: 'busy', label: 'Syncing…', pending };
  if (s.error === 'offline' || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return { kind: 'offline', label: pending ? `Offline · ${pending} waiting` : 'Offline', pending };
  }
  if (s.error) return { kind: 'error', label: 'Sync problem', pending, error: s.error };
  if (pending) return { kind: 'pending', label: `${pending} waiting`, pending };
  return { kind: 'ok', label: 'Synced', pending: 0 };
}

export function requestSync(delay = 1200) {
  if (!state.sync.url) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => { syncNow(); }, delay);
}

export async function connect(url, key = '') {
  const u = String(url || '').trim();
  if (!validSyncUrl(u)) throw new Error('That is not an Apps Script web app URL. It starts with https://script.google.com/macros/s/ and ends with /exec.');
  state.sync.url = u;
  state.sync.key = String(key || '').trim();
  state.sync.since = 0;
  state.sync.error = null;
  markEverything();
  save();
  const ok = await syncNow();
  if (!ok) throw new Error(state.sync.error || 'Could not reach the sync script.');
  return true;
}

export function disconnect() {
  Object.assign(state.sync, { url: '', key: '', since: 0, error: null, lastOk: null });
  save();
  emit(false);
}

function buildBody() {
  const s = state.sync;
  const runIds = new Set(Object.keys(s.dirtyRuns));
  const touches = [];
  const sentT = {};
  for (const [id, runId] of Object.entries(s.dirtyTouches)) {
    const run = state.runs[runId];
    const t = run?.touches.find(x => x.id === id);
    if (!t || run.localOnly) { delete s.dirtyTouches[id]; continue; }
    touches.push({ ...t, runId, cells: syncCells(t, run) });
    sentT[id] = t.updatedAt;
    runIds.add(runId);
  }
  const runs = [];
  const sentR = {};
  for (const id of runIds) {
    const run = state.runs[id];
    if (!run || run.localOnly) { delete s.dirtyRuns[id]; continue; }
    if (!run.updatedAt) run.updatedAt = run.createdAt;
    runs.push({ id, name: run.name, createdAt: run.createdAt, updatedAt: run.updatedAt, info: cleanInfo(run.info), cells: runCells(run) });
    sentR[id] = run.updatedAt;
  }
  const tombstones = [...s.tombstones];
  const settings = s.dirtySetup && state.setupUpdatedAt
    ? { updatedAt: state.setupUpdatedAt, data: { framework: state.framework, lists: state.lists, colors: state.colors, diagram: state.diagram, annotations: state.annotations, chartKinds: state.chartKinds, chartCols: state.chartCols, tiles: state.tiles, library: state.library, icons: state.icons, lineDrawings: state.lineDrawings } } : undefined;
  return { body: { app: 'touchmap', v: 2, key: s.key || undefined, since: s.since || 0, runs, touches, tombstones, settings }, sentT, sentR, tombstones, sentSetupAt: settings?.updatedAt };
}

/** Apply what the server sent back. Returns true if anything on this device changed. */
export function applyRemote(data, { firstSync = false } = {}) {
  let changed = false;
  const s = state.sync;
  if (data.settings?.updatedAt && newer(data.settings.updatedAt, state.setupUpdatedAt)) {
    const d = data.settings.data || {};
    if (d.framework === null || Array.isArray(d.framework?.categories)) state.framework = d.framework ?? null;
    if (d.lists && Array.isArray(d.lists.zones) && Array.isArray(d.lists.people)) {
      state.lists = { zones: d.lists.zones.filter(x => typeof x === 'string').slice(0, 200), people: d.lists.people.filter(x => typeof x === 'string').slice(0, 200) };
    }
    if ('colors' in d) state.colors = d.colors && typeof d.colors === 'object' ? d.colors : null;
    if ('diagram' in d) state.diagram = d.diagram && Array.isArray(d.diagram.shapes) ? d.diagram : null;
    if ('annotations' in d) state.annotations = d.annotations && typeof d.annotations === 'object' ? d.annotations : {};
    if ('chartKinds' in d) state.chartKinds = d.chartKinds && typeof d.chartKinds === 'object' ? d.chartKinds : {};
    if ('chartCols' in d) state.chartCols = d.chartCols && typeof d.chartCols === 'object' && !Array.isArray(d.chartCols) ? d.chartCols : {};
    if ('tiles' in d) state.tiles = Array.isArray(d.tiles) && d.tiles.length === 3 && d.tiles.every(x => typeof x === 'string') ? d.tiles : null;
    if ('icons' in d) state.icons = d.icons && typeof d.icons === 'object' && d.icons.zones && typeof d.icons.zones === 'object' ? { zones: Object.fromEntries(Object.entries(d.icons.zones).filter(([k, v]) => typeof v === 'string')) } : { zones: {} };
    if ('lineDrawings' in d) state.lineDrawings = Array.isArray(d.lineDrawings) ? d.lineDrawings.filter(x => x && typeof x.id === 'string' && typeof x.name === 'string' && Array.isArray(x.shapes)).slice(0, 60) : [];
    if ('library' in d) state.library = Array.isArray(d.library) ? d.library.filter(x => x && typeof x.name === 'string' && Array.isArray(x.children)).slice(0, 80) : [];
    state.setupUpdatedAt = data.settings.updatedAt;
    s.dirtySetup = false;
    applyFramework(state.framework);
    applyColors(state.colors);
    changed = true;
  }
  const serverRunIds = new Set((data.runs || []).map(r => r.id));

  for (const r of data.runs || []) {
    if (!r?.id) continue;
    const local = state.runs[r.id];
    if (!local) {
      state.runs[r.id] = { id: r.id, name: String(r.name || 'Run').slice(0, 200), createdAt: r.createdAt || null, updatedAt: r.updatedAt || null,
        info: { ...DEFAULT_INFO, ...cleanInfo(r.info) }, touches: [], lastExport: null, localOnly: false };
      changed = true;
    } else if (!newer(local.updatedAt, r.updatedAt) && (local.name !== r.name || JSON.stringify(local.info) !== JSON.stringify({ ...DEFAULT_INFO, ...cleanInfo(r.info) }))) {
      local.name = String(r.name || local.name).slice(0, 200);
      local.info = { ...DEFAULT_INFO, ...cleanInfo(r.info) };
      local.updatedAt = r.updatedAt;
      delete s.dirtyRuns[r.id];
      changed = true;
    }
  }

  for (const raw of data.touches || []) {
    if (!raw?.id || !raw.runId) continue;
    let run = state.runs[raw.runId];
    if (!run) {
      run = state.runs[raw.runId] = { id: raw.runId, name: 'Synced run', createdAt: raw.createdAt, updatedAt: null, info: { ...DEFAULT_INFO }, touches: [], lastExport: null, localOnly: false };
    }
    const t = cleanTouch(raw);
    const i = run.touches.findIndex(x => x.id === t.id);
    if (i < 0) { run.touches.push(t); changed = true; }
    else if (!newer(run.touches[i].updatedAt, t.updatedAt) && JSON.stringify(run.touches[i]) !== JSON.stringify(t)) {
      run.touches[i] = t; delete s.dirtyTouches[t.id]; changed = true;
    }
  }

  for (const tb of data.tombstones || []) {
    if (tb.kind === 'run') {
      const run = state.runs[tb.id];
      if (run && !newer(run.updatedAt, tb.deletedAt) && !run.touches.some(t => newer(t.updatedAt, tb.deletedAt))) {
        delete state.runs[tb.id]; delete s.dirtyRuns[tb.id]; changed = true;
      }
    } else {
      for (const run of Object.values(state.runs)) {
        const i = run.touches.findIndex(x => x.id === tb.id);
        if (i >= 0 && !newer(run.touches[i].updatedAt, tb.deletedAt)) {
          run.touches.splice(i, 1); delete s.dirtyTouches[tb.id]; changed = true;
        }
      }
    }
  }

  // First connection: drop this device's untouched starter run if the team already has runs,
  // so every tablet does not add its own empty "Observation 1".
  if (firstSync && serverRunIds.size) {
    for (const run of Object.values(state.runs)) {
      if (!serverRunIds.has(run.id) && !run.localOnly && !run.touches.length && !run.updatedAt) {
        delete state.runs[run.id]; delete s.dirtyRuns[run.id];
        if (state.activeRunId === run.id) state.activeRunId = null;
        changed = true;
      }
    }
    if (!state.activeRunId || !state.runs[state.activeRunId]) {
      const latest = [...serverRunIds].map(id => state.runs[id]).filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
      if (latest) state.activeRunId = latest.id;
    }
  }
  ensureRun();
  return changed;
}

/** Send queued changes and fetch the team's. Resolves true on success. */
export function syncNow() {
  const s = state.sync;
  if (!s.url || isPassiveCopy()) return Promise.resolve(false);
  if (inflight) { again = true; return inflight; }
  busy = true;
  emit(false);
  inflight = (async () => {
    const { body, sentT, sentR, tombstones, sentSetupAt } = buildBody();
    const firstSync = !s.since;
    let res;
    try {
      res = await fetch(s.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow', cache: 'no-store' });
    } catch {
      throw new Error(navigator.onLine === false ? 'offline' : 'Could not reach the sync script. Check the connection, then try again.');
    }
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch {
      throw new Error("The sync script didn't answer with data. In Apps Script, check the deployment is a Web app with access “Anyone”.");
    }
    if (!data.ok) throw new Error(data.error || 'The sync script refused the request.');

    // What was sent is now on the server, unless it was edited again while in flight.
    for (const [id, at] of Object.entries(sentT)) {
      const run = state.runs[s.dirtyTouches[id]];
      const cur = run?.touches.find(x => x.id === id);
      if (!cur || cur.updatedAt === at) delete s.dirtyTouches[id];
    }
    for (const [id, at] of Object.entries(sentR)) if (!state.runs[id] || state.runs[id].updatedAt === at) delete s.dirtyRuns[id];
    s.tombstones = s.tombstones.filter(t => !tombstones.includes(t));
    s.serverV = Number(data.v) || 1;
    // An old script ignores Setup; keep it queued until the script is updated.
    if (sentSetupAt && s.serverV >= 2 && state.setupUpdatedAt === sentSetupAt) s.dirtySetup = false;

    const changed = applyRemote(data, { firstSync });
    s.since = Number(data.rev) || s.since;
    s.lastOk = new Date().toISOString();
    s.error = null;
    save();
    return changed;
  })().then((changed) => {
    busy = false; inflight = null; emit(changed);
    if (again || pendingCount()) { again = false; if (pendingCount()) requestSync(800); }
    return true;
  }, (err) => {
    busy = false; inflight = null;
    s.error = err.message === 'offline' ? 'offline' : err.message;
    save(); emit(false);
    return false;
  });
  return inflight;
}

/** Wire sync into the app: on change, on reconnect, on return to the app, and every 15 s. */
export function startSync() {
  hooks.dirty = () => requestSync();
  window.addEventListener('online', () => { if (state.sync.error === 'offline') state.sync.error = null; syncNow(); });
  window.addEventListener('offline', () => emit(false));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 15000);
  if (state.sync.url) syncNow();
}

/** A link that connects another device: it opens the app and offers to join. */
export function joinLink() {
  const p = new URLSearchParams({ join: state.sync.url });
  if (state.sync.key) p.set('key', state.sync.key);
  return `${location.origin}${location.pathname}#${p.toString()}`;
}
