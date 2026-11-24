// Demo data for the plants that are not live yet, so the Admin view can be presented with a
// believable picture of the whole business unit. Generated from the demo shift template with
// a fixed seed per line (the same numbers every time), and kept on this device only: it never
// reaches the team sheet, and Clear removes all of it.
import { finalise, blankTouch } from './model.js';
import { CATEGORIES, DEFAULT_INFO, typeInfo } from './framework.js';
import { ROWS } from './demo.js';
import { ORG } from './org.js';

const KEY = 'touchmap:admin-demo';

// How each line differs, so the comparison tells a story: one line fights breakdowns,
// one is changeover-heavy, the water lines have no syrup room.
const PROFILE = {
  K3: { days: 3, ops: 4, planned: 1.0, unplanned: 1.0 },
  'TIM-P1': { days: 5, ops: 4, planned: 1.0, unplanned: 0.9 },
  'TIM-P2': { days: 4, ops: 4, planned: 0.85, unplanned: 1.7 },
  'TIM-C1': { days: 4, ops: 3, planned: 1.35, unplanned: 0.8 },
  'PNG-W1': { days: 5, ops: 3, planned: 1.1, unplanned: 0.7, water: true },
  'PNG-W2': { days: 3, ops: 3, planned: 0.8, unplanned: 1.25, water: true },
};

function rng(seed) {
  let a = 0;
  for (const ch of String(seed)) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 0x9e3779b9) | 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Weekday dates going back from today, `n` of them, spread over about three weeks. */
function observationDays(n, rand) {
  const out = [];
  const d = new Date(); d.setHours(6, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  while (out.length < n) {
    d.setDate(d.getDate() - (1 + Math.floor(rand() * 3)));
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    out.push(new Date(d));
  }
  return out.reverse();
}

/** A few extra touch types per shift, from the framework, at a zone they belong to. */
function extras(rand, water) {
  const out = [];
  const pool = CATEGORIES.flatMap(c => c.types.filter(t => !t.hidden).map(t => ({ c, t })));
  for (let i = 0; i < 4; i++) {
    const { c, t } = pool[Math.floor(rand() * pool.length)];
    const zones = (t.zones || []).filter(z => !(water && z === 'Mixer / carbo'));
    const zone = zones.length ? zones[Math.floor(rand() * zones.length)] : (t.everywhere ? ['Filler', 'Labeller', 'Packer / shrink', 'Palletiser'][Math.floor(rand() * 4)] : 'Other');
    out.push([60 + Math.floor(rand() * 600), zone, c.code, t.name, 1 + Math.floor(rand() * 6), 1 + rand() * 6, ['Op 1', 'Op 2', 'Op 3', 'Op 4'][Math.floor(rand() * 4)], '']);
  }
  return out;
}

function shift({ plant, line, day, index, profile, rand, observer }) {
  const rows = [...ROWS, ...extras(rand, profile.water)]
    .filter(r => !(profile.water && r[1] === 'Mixer / carbo'))
    .filter(() => rand() > 0.12);
  const touches = rows.map(([offset, zone, category, type, count, per, who, description]) => {
    const unplanned = category.startsWith('U');
    const k = (unplanned ? profile.unplanned : profile.planned) * (0.6 + rand() * 0.8);
    const n = Math.max(1, Math.round(count * k));
    const perMin = per * (0.75 + rand() * 0.55);
    const start = new Date(day.getTime() + (offset + Math.floor(rand() * 25)) * 60000);
    const timed = Math.round(n * perMin * 60);
    const info = typeInfo(category, type);
    return finalise({
      ...blankTouch(), zone, who, category, type, touchType: info?.touchType || 'Physical',
      planned: unplanned ? 'Unplanned' : 'Planned', count: n, countMode: 'all', timedSec: timed, durManual: false,
      start: start.toISOString(), end: new Date(start.getTime() + timed * 1000).toISOString(),
      description, observer,
    }, { now: start });
  });
  const created = new Date(day.getTime() - 15 * 60000).toISOString();
  const iso = dayKey(day);
  return {
    id: `demo-${line.id}-${index + 1}`, name: `Observation ${index + 1}`, createdAt: created, updatedAt: created,
    info: { ...DEFAULT_INFO, operatorNames: [], bu: 'Romania', plant: plant.name, line: line.full, from: iso, to: iso,
      operators: profile.ops, shiftHours: 12, breakHours: 0.5, shifts: 1, observers: observer, finishedAt: new Date(day.getTime() + 12 * 3600e3).toISOString() },
    touches, lastExport: null, localOnly: true, demo: true,
  };
}

/**
 * Runs for every line of the plants that are not live yet; with `includeLive`, also the live
 * lines (for a preview before the first real observation is synced).
 */
export function buildOrgDemo({ includeLive = false } = {}) {
  const runs = [];
  for (const unit of ORG.units) for (const plant of unit.plants) {
    if (plant.live && !includeLive) continue;
    plant.lines.forEach((line, li) => {
      const profile = PROFILE[line.id] || { days: 3, ops: 4, planned: 1, unplanned: 1 };
      const rand = rng(`${plant.id}/${line.id}`);
      const observer = `${plant.name} CI lead${li % 2 ? ' (night)' : ''}`;
      observationDays(profile.days, rand).forEach((day, i) => runs.push(shift({ plant, line, day, index: i, profile, rand, observer })));
    });
  }
  return runs;
}

export function demoRuns() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null')?.runs || []; } catch { return []; }
}
export function demoLoadedAt() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null')?.at || null; } catch { return null; }
}
export function loadOrgDemo(opts) {
  const runs = buildOrgDemo(opts);
  localStorage.setItem(KEY, JSON.stringify({ at: new Date().toISOString(), runs }));
  return runs;
}
export function clearOrgDemo() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
