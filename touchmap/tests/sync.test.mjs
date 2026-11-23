// The real sync/apps-script.gs, run against an in-memory sheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppsScript } from './fake-sheets.mjs';

const run = (id, name, updatedAt = '2026-11-23T10:00:00.000Z') => ({ id, name, createdAt: '2026-11-23T09:00:00.000Z', updatedAt, info: { line: 'K3' }, cells: [name, 'K3'] });
const touch = (id, runId, updatedAt, extra = {}) => ({
  id, runId, updatedAt, createdAt: updatedAt, start: '2026-11-23T12:00:00.000Z', zone: 'Filler', category: 'U2', type: 'Fallen bottles', count: 3, ...extra,
  cells: ['Run', 'Filler', 'Unplanned', 'U2: Process failures and micro-stops', 'Fallen bottles', 'Physical', '2026-11-23T12:00:00.000Z', '', 60, 3, 0.33, 1, extra.description || '', 'To be decided', '', 'A', 'Complete'],
});

test('device A pushes, device B pulls everything', () => {
  const gs = loadAppsScript();
  const a = gs.post({ since: 0, runs: [run('r1', 'Observation 1')], touches: [touch('t1', 'r1', '2026-11-23T12:01:00.000Z')], tombstones: [] });
  assert.equal(a.ok, true);
  assert.ok(a.rev > 0);
  const b = gs.post({ since: 0, runs: [], touches: [], tombstones: [] });
  assert.deepEqual(b.runs.map(r => r.id), ['r1']);
  assert.deepEqual(b.touches.map(t => t.id), ['t1']);
  assert.equal(b.touches[0].cells, undefined, 'readable cells stay in the sheet, not in the data');
  // Nothing new since A's revision
  const again = gs.post({ since: b.rev, runs: [], touches: [], tombstones: [] });
  assert.equal(again.touches.length, 0);
  assert.equal(again.rev, b.rev);
});

test('the sheet is a readable observation log with real dates', () => {
  const gs = loadAppsScript();
  gs.post({ since: 0, runs: [run('r1', 'Observation 1')], touches: [touch('t1', 'r1', '2026-11-23T12:01:00.000Z')] });
  const rows = gs.sheets.get('Touches').cells;
  assert.equal(rows[0][0], 'Run');
  assert.equal(rows[0][1], 'Zone / equipment');
  assert.equal(rows[1][0], 'Observation 1', 'run column follows the run name');
  assert.ok(rows[1][6] instanceof Date, 'start timestamp stored as a date');
  assert.equal(rows[1][9], 3);
});

test('newest edit wins; the loser gets the winning copy back', () => {
  const gs = loadAppsScript();
  gs.post({ since: 0, runs: [run('r1', 'R')], touches: [touch('t1', 'r1', '2026-11-23T12:05:00.000Z', { description: 'newer' })] });
  const stale = gs.post({ since: 999999999999999, touches: [touch('t1', 'r1', '2026-11-23T12:01:00.000Z', { description: 'older' })] });
  assert.equal(stale.touches.length, 1, 'rejected item is returned even with a high since');
  assert.equal(stale.touches[0].description, 'newer');
});

test('deletes travel, and an edit made after a delete brings the touch back', () => {
  const gs = loadAppsScript();
  const first = gs.post({ since: 0, runs: [run('r1', 'R')], touches: [touch('t1', 'r1', '2026-11-23T12:00:00.000Z'), touch('t2', 'r1', '2026-11-23T12:00:00.000Z')] });
  const del = gs.post({ since: first.rev, tombstones: [{ kind: 'touch', id: 't1', runId: 'r1', deletedAt: '2026-11-23T13:00:00.000Z' }] });
  assert.deepEqual(del.tombstones.map(t => t.id), ['t1']);
  assert.equal(gs.sheets.get('Touches').cells.length, 2, 'header + t2');
  // A stale copy of t1 from another device does not resurrect it...
  const stale = gs.post({ since: del.rev, touches: [touch('t1', 'r1', '2026-11-23T12:30:00.000Z')] });
  assert.equal(stale.tombstones[0].id, 't1');
  assert.equal(gs.sheets.get('Touches').cells.length, 2);
  // ...but an undo (newer than the delete) does.
  gs.post({ since: del.rev, touches: [touch('t1', 'r1', '2026-11-23T13:05:00.000Z')] });
  assert.equal(gs.sheets.get('Touches').cells.length, 3);
  assert.equal(gs.sheets.get('Deleted').cells.length, 1, 'tombstone cleared');
});

test('deleting a run removes its touches', () => {
  const gs = loadAppsScript();
  gs.post({ since: 0, runs: [run('r1', 'R'), run('r2', 'S')], touches: [touch('t1', 'r1', '2026-11-23T12:00:00.000Z'), touch('t2', 'r2', '2026-11-23T12:00:00.000Z')] });
  const out = gs.post({ since: 0, tombstones: [{ kind: 'run', id: 'r1', deletedAt: '2026-11-23T14:00:00.000Z' }] });
  assert.deepEqual(out.runs.map(r => r.id), ['r2']);
  assert.deepEqual(out.touches.map(t => t.id), ['t2']);
});

test('descriptions never become formulas', () => {
  const gs = loadAppsScript();
  gs.post({ since: 0, runs: [run('r1', 'R')], touches: [touch('t1', 'r1', '2026-11-23T12:00:00.000Z', { description: '=HYPERLINK("x")' })] });
  assert.equal(gs.sheets.get('Touches').cells[1][12], `'=HYPERLINK("x")`);
});

test('team key, when set, is required', () => {
  const gs = loadAppsScript();
  gs.setKey('k3-secret');
  assert.equal(gs.post({ since: 0 }).ok, false);
  assert.equal(gs.post({ since: 0, key: 'k3-secret' }).ok, true);
  assert.equal(gs.get().app, 'touchmap-sync');
});
