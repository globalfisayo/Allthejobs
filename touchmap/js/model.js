// Pure data rules for a touch. No DOM, no storage: imported by the app and the tests.
import { CAT_BY_CODE, DEFAULT_ROUTE, typeInfo } from './framework.js';

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** A blank touch, optionally carrying context (zone, person) over from the last one. */
export function blankTouch(carry = {}) {
  return {
    id: uid(),
    zone: carry.zone ?? '',
    who: carry.who ?? '',
    planned: '',
    category: '',
    type: '',
    touchType: '',
    count: 1,
    countMode: 'all',      // the timed span covers 'all' occurrences, or just 'one'
    perOccMin: null,       // typed duration per occurrence (used when durManual or not timed)
    durManual: false,
    timedSec: null,        // stopwatch result in seconds
    start: null,           // ISO timestamp of first start
    end: null,             // ISO timestamp of last stop
    description: '',
    route: DEFAULT_ROUTE,
    observer: '',
    createdAt: null,
    updatedAt: null,
    incomplete: false,
  };
}

export function round(n, dp = 2) {
  if (n == null || !isFinite(n)) return n;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Duration per occurrence in minutes, following the timer unless the observer typed one. */
export function perOccurrence(t) {
  const count = Math.max(0, Number(t.count) || 0);
  if (!t.durManual && t.timedSec != null) {
    const mins = t.timedSec / 60;
    if (t.countMode === 'one') return mins;
    return count > 0 ? mins / count : mins;
  }
  const v = Number(t.perOccMin);
  return isFinite(v) && t.perOccMin !== '' && t.perOccMin != null ? v : null;
}

/** Count × Duration per occurrence, as the template's Total minutes column. */
export function totalMinutes(t) {
  const count = Number(t.count) || 0;
  const per = perOccurrence(t);
  if (!count) return 0;
  return count * (per ?? 0);
}

export function missingFields(t) {
  const miss = [];
  if (!t.zone) miss.push('zone');
  if (!t.planned) miss.push('planned');
  if (!t.category) miss.push('category');
  if (!t.type) miss.push('type');
  if (!t.touchType) miss.push('touchType');
  if (!(Number(t.count) >= 1)) miss.push('count');
  return miss;
}

export const FIELD_LABEL = {
  zone: 'Zone / equipment', planned: 'Planned / Unplanned', category: 'Category',
  type: 'Type of touch', touchType: 'Touch type', count: 'Count', duration: 'Duration',
};

/** Freeze a draft into a stored touch: computed duration fixed, flags set. */
export function finalise(draft, { observer = '', now = new Date() } = {}) {
  const t = { ...draft };
  const per = perOccurrence(t);
  t.perOccMin = per == null ? null : round(per, 4);
  t.count = Math.max(0, Math.round(Number(t.count) || 0));
  t.observer = t.observer || observer;
  t.createdAt = t.createdAt || now.toISOString();
  t.updatedAt = now.toISOString();
  t.incomplete = missingFields(t).length > 0;
  return t;
}

/** Keep the Planned/Unplanned, category, type and touch-type answers consistent. */
export function setPlanned(t, planned) {
  t.planned = planned;
  const cat = CAT_BY_CODE[t.category];
  if (cat && cat.planned !== (planned === 'Planned')) { t.category = ''; t.type = ''; }
  return t;
}

export function setCategory(t, code) {
  t.category = code;
  const cat = CAT_BY_CODE[code];
  if (cat) t.planned = cat.planned ? 'Planned' : 'Unplanned';
  if (!typeInfo(code, t.type)) t.type = '';
  return t;
}

export function setType(t, name) {
  t.type = name;
  const info = typeInfo(t.category, name);
  if (info?.touchType) t.touchType = info.touchType;
  return t;
}

/** Chronological order for numbering: by start time, else by when it was logged. */
export function sortKey(t) {
  return t.start || t.createdAt || '';
}

export function ordered(touches) {
  return [...touches].sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || (a.createdAt || '').localeCompare(b.createdAt || ''));
}

/** Merge touches from another device: union by id, the newer edit wins. */
export function mergeTouches(mine, theirs) {
  const map = new Map(mine.map(t => [t.id, t]));
  let added = 0, updated = 0;
  for (const t of theirs) {
    const cur = map.get(t.id);
    if (!cur) { map.set(t.id, t); added++; }
    else if ((t.updatedAt || '') > (cur.updatedAt || '')) { map.set(t.id, t); updated++; }
  }
  return { touches: [...map.values()], added, updated };
}

export function referenceCapacity(info) {
  const ops = Number(info.operators) || 0;
  const avail = (Number(info.shiftHours) || 0) - (Number(info.breakHours) || 0);
  const shifts = Number(info.shifts) || 1;
  return { available: avail, capacity: ops * avail * shifts };
}

export function fmtClock(ms, tenths = true) {
  const neg = ms < 0; ms = Math.abs(ms);
  const totalTenths = Math.floor(ms / 100);
  const t = totalTenths % 10;
  const s = Math.floor(totalTenths / 10) % 60;
  const m = Math.floor(totalTenths / 600) % 60;
  const h = Math.floor(totalTenths / 36000);
  const pad = n => String(n).padStart(2, '0');
  const core = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return (neg ? '-' : '') + core + (tenths ? `.${t}` : '');
}

export function fmtMin(min) {
  if (min == null || !isFinite(min)) return '–';
  if (min === 0) return '0';
  if (Math.abs(min) < 10) return round(min, 2).toString();
  if (Math.abs(min) < 100) return round(min, 1).toString();
  return Math.round(min).toLocaleString('en-GB');
}

/** "2 min 34 s" style helper for a decimal-minute value. */
export function minSec(min) {
  if (min == null || !isFinite(min)) return '';
  const secs = Math.round(min * 60);
  const m = Math.floor(secs / 60), s = secs % 60;
  if (m === 0) return `${s} s`;
  return s ? `${m} min ${s} s` : `${m} min`;
}
