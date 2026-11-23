// Run from touchmap/: npm test   (or: node --test tests/*.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { CATEGORIES, FRAMEWORK, DECISION, CAT_BY_CODE } from '../js/framework.js';
import { blankTouch, perOccurrence, totalMinutes, finalise, setCategory, setType, setPlanned, missingFields, mergeTouches, fmtClock } from '../js/model.js';
import { analyse } from '../js/analysis.js';
import { buildWorkbook, buildCsv, logRows, parseBackup, buildBackup } from '../js/export.js';
import { DEFAULT_INFO } from '../js/framework.js';

const t = (o) => ({ ...blankTouch(), ...o });

test('framework matches the template lists', () => {
  assert.equal(CATEGORIES.length, 15);
  assert.equal(FRAMEWORK.zones.length, 15);
  assert.equal(CATEGORIES.reduce((s, c) => s + c.types.length, 0), 74);
  assert.ok(CATEGORIES.every(c => c.types.every(x => ['Physical', 'Information'].includes(x.touchType))));
  assert.ok(CATEGORIES.every(c => c.types.every(x => x.guide.length > 20)), 'every type has a counting guide');
});

test('decision tree reaches every category and terminates', () => {
  const reached = new Set();
  const walk = (id, depth = 0) => {
    assert.ok(depth < 20);
    const node = DECISION.nodes[id];
    for (const ans of [node.yes, node.no]) {
      if (ans.cat) reached.add(ans.cat);
      else if (ans.go) walk(ans.go, depth + 1);
    }
  };
  walk(DECISION.start);
  assert.deepEqual([...reached].sort(), CATEGORIES.map(c => c.code).sort());
});

test('duration follows the timer: all occurrences vs one', () => {
  const a = t({ count: 4, timedSec: 240, countMode: 'all' });
  assert.equal(perOccurrence(a), 1);
  assert.equal(totalMinutes(a), 4);
  const b = t({ count: 4, timedSec: 30, countMode: 'one' });
  assert.equal(perOccurrence(b), 0.5);
  assert.equal(totalMinutes(b), 2);
  const c = t({ count: 3, timedSec: 600, durManual: true, perOccMin: 2.5 });
  assert.equal(totalMinutes(c), 7.5);
  const d = t({ count: 5, perOccMin: null });
  assert.equal(perOccurrence(d), null);
  assert.equal(totalMinutes(d), 0, 'counted, not timed, adds 0 minutes');
});

test('answers stay consistent', () => {
  const x = t({});
  setCategory(x, 'U2');
  assert.equal(x.planned, 'Unplanned');
  setType(x, 'Nuisance trip reset');
  assert.equal(x.touchType, 'Information');
  setPlanned(x, 'Planned');
  assert.equal(x.category, '');
  assert.equal(x.type, '');
  assert.deepEqual(missingFields(x), ['zone', 'category', 'type']);
});

test('finalise freezes the duration and flags missing answers', () => {
  const x = finalise(t({ zone: 'Filler', count: 2, timedSec: 90 }), { observer: 'A' });
  assert.equal(x.perOccMin, 0.75);
  assert.equal(x.incomplete, true);
  assert.equal(x.observer, 'A');
});

test('analysis reproduces the sheet SUMIFs', () => {
  const rows = [
    t({ zone: 'Filler', planned: 'Planned', category: 'P4', type: 'Brix / CO2 sampling & test', touchType: 'Physical', count: 12, perOccMin: 3 }),
    t({ zone: 'Conveyors', planned: 'Unplanned', category: 'U2', type: 'Fallen bottles', touchType: 'Physical', count: 40, perOccMin: 0.3 }),
    t({ zone: 'Control room / office', planned: 'Planned', category: 'P8', type: 'Shift / production report', touchType: 'Information', count: 2, perOccMin: 15 }),
  ];
  const a = analyse(rows, DEFAULT_INFO);
  assert.equal(a.headline.touchesLogged, 54);
  assert.equal(a.headline.minutes, 36 + 12 + 30);
  assert.equal(a.headline.capacity, 46);
  assert.ok(Math.abs(a.headline.coverage - 78 / 60 / 46) < 1e-9);
  const planned = a.byPlanned.items.find(i => i.key === 'Planned');
  assert.equal(planned.minutes, 66);
  assert.equal(planned.touches, 14);
  assert.equal(a.catPareto[0].key, 'P4');
  assert.equal(a.byTouchType.items.find(i => i.key === 'Information').minutes, 30);
  assert.equal(a.byZone.items.find(i => i.key === 'Conveyors').touches, 40);
  assert.ok(!a.byCategory.items.some(i => i.key === 'Not set'));
});

test('merge keeps the newer edit and adds unseen rows', () => {
  const a = t({ id: 'x', updatedAt: '2026-11-23T10:00:00Z', description: 'old' });
  const b = t({ id: 'x', updatedAt: '2026-11-23T11:00:00Z', description: 'new' });
  const c = t({ id: 'y', updatedAt: '2026-11-23T09:00:00Z' });
  const m = mergeTouches([a], [b, c]);
  assert.equal(m.added, 1); assert.equal(m.updated, 1);
  assert.equal(m.touches.find(x => x.id === 'x').description, 'new');
});

test('exports: columns A-O, workbook written, backup round-trips', () => {
  const run = { id: 'r1', name: 'Test run', info: DEFAULT_INFO, touches: [
    finalise(t({ zone: 'Labeller', planned: 'Planned', category: 'P1', type: 'Parts change', touchType: 'Physical', count: 6, timedSec: 1800,
      start: '2026-11-23T12:38:20.000Z', end: '2026-11-23T13:08:20.000Z', description: 'Star wheels, "neck" plates & rails' })),
  ] };
  const [r] = logRows(run.touches);
  assert.equal(r.category, 'P1: Changeover / format change');
  assert.equal(r.seconds, 1800); assert.equal(r.minutes, 30); assert.equal(r.perOcc, 5); assert.equal(r.total, 30);
  const csv = buildCsv(run);
  assert.ok(csv.startsWith('﻿#,Zone / equipment,Planned / Unplanned,Category'));
  assert.ok(csv.includes('"Star wheels, ""neck"" plates & rails"'));
  const bytes = buildWorkbook(run, {});
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b);
  if (process.env.XLSX_OUT) writeFileSync(process.env.XLSX_OUT, bytes);
  const back = parseBackup(buildBackup(run, {}));
  assert.equal(back.run.touches.length, 1);
  assert.equal(back.run.touches[0].category, 'P1');
  assert.throws(() => parseBackup('{"app":"other"}'));
});

test('clock format', () => {
  assert.equal(fmtClock(0), '00:00.0');
  assert.equal(fmtClock(83_450), '01:23.4');
  assert.equal(fmtClock(3_723_000), '1:02:03.0');
  assert.ok(CAT_BY_CODE.U7);
});
