// Observation time, capacity, framework customisation and Setup sync.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFramework, CATEGORIES, CAT_BY_CODE, isCustomFramework, nextCategoryCode, typesFor, typeInfo, DEFAULT_INFO } from '../js/framework.js';
import { blankTouch, observedSpans, observedMinutes, runCapacity, referenceCapacity } from '../js/model.js';
import { cleanTouch, cleanInfo } from '../js/export.js';
import { loadAppsScript } from './fake-sheets.mjs';

const iso = (s) => new Date(s).toISOString();
const t = (start, sec, extra = {}) => ({ ...blankTouch(), start: iso(start), end: iso(new Date(new Date(start).getTime() + sec * 1000)), timedSec: sec, count: 1, ...extra });

test('observed time is first-to-last touch per day, not across the night', () => {
  const touches = [
    t('2026-11-23T06:05:00', 60), t('2026-11-23T13:50:00', 600),   // day 1: 06:05 → 14:00 = 475 min
    t('2026-11-24T07:00:00', 120), t('2026-11-24T09:00:00', 300),  // day 2: 07:00 → 09:05 = 125 min
  ];
  const spans = observedSpans(touches);
  assert.equal(spans.length, 2);
  assert.equal(Math.round(spans[0].spanMin), 475);
  assert.equal(Math.round(spans[1].spanMin), 125);
  const run = { info: { ...DEFAULT_INFO }, touches };
  assert.equal(Math.round(observedMinutes(run).minutes), 600);
  assert.equal(observedMinutes(run).source, 'touches');
});

test('a manual observation window overrides the touches', () => {
  const run = { info: { ...DEFAULT_INFO, obsStart: '2026-11-23T06:00', obsEnd: '2026-11-23T18:00' }, touches: [t('2026-11-23T08:00:00', 60)] };
  const o = observedMinutes(run);
  assert.equal(o.source, 'manual');
  assert.equal(o.minutes, 720);
});

test('capacity: template per shift by default, or operators × observed time', () => {
  const touches = [t('2026-11-23T06:00:00', 60), t('2026-11-23T11:59:00', 60)];  // 6 h observed
  const run = { info: { ...DEFAULT_INFO }, touches };
  assert.equal(runCapacity(run), 46);
  run.info.capacityMode = 'observed';
  // 4 operators × 6 h × (11.5 / 12)
  assert.ok(Math.abs(runCapacity(run) - 4 * 6 * (11.5 / 12)) < 1e-9);
  assert.equal(referenceCapacity({ ...DEFAULT_INFO }).capacity, 46);
});

test('framework edits apply everywhere and reset cleanly', () => {
  assert.equal(isCustomFramework(), false);
  const cats = JSON.parse(JSON.stringify(CATEGORIES));
  cats.find(c => c.code === 'P1').types.push({ name: 'Robot gripper change', touchType: 'Physical', guide: 'Each gripper = 1 touch.', custom: true, zones: ['Palletiser'] });
  cats.find(c => c.code === 'P1').types.find(x => x.name === 'Adjusting Brix').hidden = true;
  cats.push({ code: nextCategoryCode(false), name: 'U8: Robot faults', planned: false, custom: true, types: [] });
  applyFramework({ categories: cats });
  assert.equal(isCustomFramework(), true);
  assert.ok(typeInfo('P1', 'Robot gripper change'));
  assert.ok(!typesFor('P1').some(x => x.name === 'Adjusting Brix'), 'hidden types are not offered');
  assert.ok(typeInfo('P1', 'Adjusting Brix'), 'but stay valid for logged touches');
  assert.equal(CAT_BY_CODE.U8.short, 'Robot faults');
  assert.equal(CATEGORIES[CATEGORIES.length - 1].code, 'U8', 'sorted after U7');
  applyFramework(null);
  assert.equal(isCustomFramework(), false);
  assert.equal(CAT_BY_CODE.U8, undefined);
});

test('synced touches keep custom category codes; run info keeps operator names', () => {
  assert.equal(cleanTouch({ id: 'a', category: 'P9' }).category, 'P9');
  assert.equal(cleanTouch({ id: 'a', category: 'X1' }).category, '');
  assert.deepEqual(cleanInfo({ operatorNames: ['Ana', 3, 'Mihai'], operators: 4 }), { operatorNames: ['Ana', 'Mihai'], operators: 4 });
  assert.ok(Object.isFrozen(DEFAULT_INFO.operatorNames), 'the shared default cannot be pushed into');
});

test('the sync script shares Setup: newest wins, long setups span rows', () => {
  const gs = loadAppsScript();
  const big = { framework: { categories: [{ code: 'P1', name: 'P1: X', planned: true, types: [{ name: 'y', guide: 'z'.repeat(90000) }] }] }, lists: { zones: ['A'], people: ['B'] } };
  const a = gs.post({ since: 0, settings: { updatedAt: '2026-11-24T10:00:00.000Z', data: big } });
  assert.equal(a.v, 2);
  assert.ok(gs.sheets.get('Settings').cells.length >= 4, 'header + 3 chunks');
  const b = gs.post({ since: 0 });
  assert.equal(b.settings.updatedAt, '2026-11-24T10:00:00.000Z');
  assert.equal(b.settings.data.framework.categories[0].types[0].guide.length, 90000);
  // An older setup from another device loses, and gets the newer one back.
  const c = gs.post({ since: b.rev, settings: { updatedAt: '2026-11-24T09:00:00.000Z', data: { framework: null, lists: { zones: [], people: [] } } } });
  assert.equal(c.settings.updatedAt, '2026-11-24T10:00:00.000Z');
  // Nothing new since: no settings in the reply.
  assert.equal(gs.post({ since: c.rev }).settings, undefined);
  assert.equal(gs.get().v, 2);
});
