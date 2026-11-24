// Builds the workbook, CSV and JSON backup from a run. No DOM: shared with the tests.
import { CAT_BY_CODE, LOG_COLUMNS, CATEGORIES } from './framework.js';
import { ordered, perOccurrence, totalMinutes, round, referenceCapacity, runCapacity, observedMinutes } from './model.js';
import { analyse } from './analysis.js';
import { buildXlsx, S } from './xlsx.js';

export const EXTRA_COLUMNS = ['Person observed', 'Observer', 'Status', 'Logged at', 'Touch ID'];

/** One Observation Log row per touch, columns A to O as in the template, then extras. */
export function logRows(touches) {
  return ordered(touches).map((t, i) => {
    const per = perOccurrence(t);
    return {
      n: i + 1,
      zone: t.zone || '',
      planned: t.planned || '',
      category: CAT_BY_CODE[t.category]?.name || '',
      type: t.type || '',
      touchType: t.touchType || '',
      start: t.start ? new Date(t.start) : null,
      end: t.end ? new Date(t.end) : null,
      seconds: t.timedSec != null ? Math.round(t.timedSec) : null,
      minutes: t.timedSec != null ? round(Math.round(t.timedSec) / 60, 2) : null,
      count: Number(t.count) || 0,
      perOcc: per == null ? null : round(per, 4),
      total: round(totalMinutes(t), 4),
      description: t.description || '',
      route: t.route || 'To be decided',
      who: t.who || '',
      observer: t.observer || '',
      status: t.incomplete ? 'Needs details' : 'Complete',
      logged: t.createdAt ? new Date(t.createdAt) : null,
      id: t.id,
    };
  });
}

const n = (v, s) => (v == null ? null : { v, s });

export function workbookSheets(run, lists) {
  const rows = logRows(run.touches);
  const log = [
    [...LOG_COLUMNS, ...EXTRA_COLUMNS].map(h => ({ v: h, s: S.header })),
    ...rows.map(r => [
      r.n, r.zone, r.planned, r.category, r.type, r.touchType,
      r.start ? { v: r.start, s: S.datetime } : null,
      r.end ? { v: r.end, s: S.datetime } : null,
      n(r.seconds, S.int), n(r.minutes, S.dec2), r.count, n(r.perOcc, S.dec2), n(r.total, S.calc),
      { v: r.description, s: S.wrap }, r.route, r.who, r.observer, r.status,
      r.logged ? { v: r.logged, s: S.datetime } : null, r.id,
    ]),
  ];

  const info = run.info;
  const { available } = referenceCapacity(info);
  const capacity = runCapacity(run);
  const obs = observedMinutes(run);
  const runInfo = [
    [{ v: 'Run Info & Reference Frame', s: S.title }],
    [{ v: run.name, s: S.bold }],
    [],
    ['Line', info.line], ['Plant', info.plant],
    ['Observation window (from)', info.from], ['Observation window (to)', info.to],
    ['Formats / SKUs observed', info.skus], ['Changeovers included', info.changeovers],
    ['CIPs included', info.cips], ['Observers', info.observers],
    ['Operators observed', (info.operatorNames || []).join(', ')],
    ['Observed time (hours)', { v: obs.minutes / 60, s: S.dec2 }, obs.source === 'manual' ? 'set manually' : 'from the logged touches, per day'],
    ['Finished', info.finishedAt ? new Date(info.finishedAt) : 'in progress'],
    [],
    [{ v: 'Reference frame', s: S.bold }],
    ['Operators on the line per shift', Number(info.operators) || 0],
    ['Shift length (hours)', Number(info.shiftHours) || 0],
    ['Break / non-available time per operator (hours)', Number(info.breakHours) || 0],
    ['Shifts covered by this map', Number(info.shifts) || 1],
    ['Available activity per operator (hours)', { v: available, s: S.calc }],
    ['Capacity based on', info.capacityMode === 'observed' ? 'observed time' : 'full shift(s), as in the template'],
    [{ v: 'REFERENCE CAPACITY (operator-hours)', s: S.bold }, { v: capacity, s: S.calc }],
  ];

  const a = analyse(run.touches, info, lists, { capacity });
  const h = a.headline;
  const head = ['Touches', 'Minutes', 'Op-hours', '% of minutes'].map(x => ({ v: x, s: S.header }));
  const blockRows = (title, label, blk, nameOf = i => i.key, note = '') => [
    [{ v: title, s: S.bold }],
    [{ v: label, s: S.header }, ...head],
    ...blk.items.map(i => [nameOf(i), i.touches, n(i.minutes, S.dec2), n(i.opHours, S.dec2), n(i.pct, S.pct)]),
    [{ v: 'Total', s: S.bold }, { v: blk.total.touches, s: S.boldInt }, { v: blk.total.minutes, s: S.boldDec2 }, { v: blk.total.opHours, s: S.boldDec2 }],
    note ? [{ v: note, s: S.note }] : [],
    [],
  ];
  const catName = i => CAT_BY_CODE[i.key]?.name || i.key;
  const analysis = [
    [{ v: 'Analysis', s: S.title }],
    [{ v: `${run.name} · ${a.rows} rows logged` + (a.incomplete ? ` · ${a.incomplete} need details` : ''), s: S.note }],
    [],
    [{ v: 'Headline', s: S.bold }],
    ['Touches logged (occurrences)', h.touchesLogged],
    ['Total mapped minutes', n(h.minutes, S.dec2)],
    ['Total mapped operator-hours', n(h.opHours, S.dec2)],
    ['Reference capacity (operator-hours)', n(h.capacity, S.dec2)],
    ['Coverage vs reference frame', n(h.coverage, S.pct)],
    ['Unexplained gap (operator-hours)', n(h.gap, S.dec2)],
    [],
    ...blockRows('Planned vs unplanned', 'Split', a.byPlanned, undefined, 'Planned touches are attacked by design and automation; unplanned by reliability.'),
    ...blockRows('By category', 'Category', a.byCategory, catName),
    [{ v: 'By category, Pareto order', s: S.bold }],
    [{ v: 'Rank', s: S.header }, { v: 'Category', s: S.header }, { v: 'Minutes', s: S.header }, { v: '% of minutes', s: S.header }, { v: 'Cumulative %', s: S.header }],
    ...a.catPareto.map(i => [i.rank, catName(i), n(i.minutes, S.dec2), n(i.pct, S.pct), n(i.cum, S.pct)]),
    [{ v: 'The top three categories are the project list.', s: S.note }],
    [],
    ...blockRows('By touch type: which lever applies', 'Touch type', a.byTouchType, undefined, 'Physical → automation; Information → digitalisation; what neither removes → optimisation.'),
    ...blockRows('By zone / equipment', 'Zone / equipment', a.byZone),
    ...blockRows('By elimination route (filled in the workshop)', 'Route', a.byRoute),
  ];
  if (a.byPerson.items.some(i => i.rows)) analysis.push(...blockRows('By person observed', 'Person', a.byPerson));

  return [
    { name: 'Observation Log', rows: log, freeze: 1, cols: [5, 20, 12, 40, 36, 12, 19, 19, 10, 10, 8, 12, 10, 60, 16, 16, 16, 14, 19, 38] },
    { name: 'Run Info', rows: runInfo, cols: [46, 36] },
    { name: 'Analysis', rows: analysis, cols: [46, 12, 12, 12, 14] },
  ];
}

export function buildWorkbook(run, lists, now = new Date()) {
  return buildXlsx(workbookSheets(run, lists), { title: run.name, now });
}

function csvCell(v) {
  if (v == null) return '';
  if (v instanceof Date) {
    const p = x => String(x).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())} ${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}`;
  }
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(run) {
  const rows = logRows(run.touches).map(r => [
    r.n, r.zone, r.planned, r.category, r.type, r.touchType, r.start, r.end, r.seconds, r.minutes,
    r.count, r.perOcc, r.total, r.description, r.route, r.who, r.observer, r.status, r.logged, r.id,
  ]);
  const lines = [[...LOG_COLUMNS, ...EXTRA_COLUMNS], ...rows].map(r => r.map(csvCell).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function buildBackup(run, lists, now = new Date()) {
  return JSON.stringify({ app: 'touchmap', format: 1, exportedAt: now.toISOString(), lists, run }, null, 1);
}

const str = v => (typeof v === 'string' ? v.slice(0, 2000) : '');
const num = v => (typeof v === 'number' && isFinite(v) ? v : null);

/** Keep only known fields with sane types: used for backups and for touches arriving by sync. */
export function cleanTouch(t) {
  return {
    id: String(t.id).slice(0, 80), zone: str(t.zone), who: str(t.who), planned: ['Planned', 'Unplanned'].includes(t.planned) ? t.planned : '',
    category: /^[PU]\d{1,2}$/.test(t.category || '') ? t.category : '', type: str(t.type), touchType: ['Physical', 'Information'].includes(t.touchType) ? t.touchType : '',
    count: num(t.count) ?? 1, countMode: t.countMode === 'one' ? 'one' : 'all', perOccMin: num(t.perOccMin), durManual: !!t.durManual,
    timedSec: num(t.timedSec), start: str(t.start) || null, end: str(t.end) || null, description: str(t.description),
    route: str(t.route) || 'To be decided', observer: str(t.observer), createdAt: str(t.createdAt) || null,
    updatedAt: str(t.updatedAt) || null, incomplete: !!t.incomplete,
  };
}

export function cleanInfo(info) {
  const out = {};
  for (const [k, v] of Object.entries(info || {})) {
    if (typeof v === 'string') out[k] = v.slice(0, 500);
    else if (typeof v === 'number' && isFinite(v)) out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter(x => typeof x === 'string').map(x => x.slice(0, 80)).slice(0, 60);
  }
  return out;
}

/** Validate a backup file's shape before it touches the store. */
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  if (data?.app !== 'touchmap' || !data.run || !Array.isArray(data.run.touches)) {
    throw new Error('That file is not a Touch Map backup.');
  }
  const touches = data.run.touches.filter(t => t && typeof t.id === 'string').map(cleanTouch);
  return {
    lists: data.lists,
    run: { id: str(data.run.id) || null, name: str(data.run.name) || 'Imported run', info: cleanInfo(data.run.info), touches },
  };
}

/** Readable cells for the team sheet's Touches tab (order = TOUCH_COLS in sync/apps-script.gs). */
export function syncCells(t, run) {
  const per = perOccurrence(t);
  return [
    run.name, t.zone || '', t.planned || '', CAT_BY_CODE[t.category]?.name || '', t.type || '', t.touchType || '',
    t.start || '', t.end || '', t.timedSec != null ? Math.round(t.timedSec) : '', Number(t.count) || 0,
    per == null ? '' : round(per, 4), round(totalMinutes(t), 4), t.description || '', t.route || 'To be decided',
    t.who || '', t.observer || '', t.incomplete ? 'Needs details' : 'Complete',
  ];
}

/** Readable cells for the Runs tab (order = RUN_COLS in sync/apps-script.gs). */
export function runCells(run) {
  const i = run.info || {};
  return [run.name, i.line || '', i.plant || '', i.from || '', i.to || '', i.skus || '', i.changeovers || '', i.cips || '',
    i.observers || '', Number(i.operators) || 0, Number(i.shiftHours) || 0, Number(i.breakHours) || 0, Number(i.shifts) || 1,
    runCapacity(run)];
}
