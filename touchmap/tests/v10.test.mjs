// Pareto columns and the tutorials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { normaliseCols, colsFor, DEFAULT_COLS } = await import('../js/rank.js');
const { TUTORIALS } = await import('../js/tutorials.js');

test('Pareto columns: the default order is code, icon, category, type, bar; minutes and %', () => {
  assert.deepEqual(DEFAULT_COLS.order, ['code', 'icon', 'category', 'type', 'bar']);
  assert.deepEqual(colsFor('category'), { order: ['code', 'icon', 'category', 'type', 'bar'], hidden: [], values: ['pct', 'minutes'], widths: {} });
});

test('Pareto columns: any stored choice comes back complete and clean', () => {
  const c = normaliseCols({ order: ['bar', 'nonsense', 'code', 'bar'], hidden: ['icon', 'icon', 'x'], values: ['touches', 'oops'] });
  assert.deepEqual(c.order, ['bar', 'code', 'icon', 'category', 'type'], 'unknown dropped, missing added, no duplicates');
  assert.deepEqual(c.hidden, ['icon']);
  assert.deepEqual(c.values, ['touches']);
  assert.deepEqual(normaliseCols(null).order, DEFAULT_COLS.order);
  assert.deepEqual(normaliseCols({ values: [] }).values, [], 'a bar with no numbers is allowed');
  assert.deepEqual(normaliseCols({ widths: { category: 180.4, bar: 5, type: 99999, nope: 50, code: 'x' } }).widths, { category: 180, bar: 28, type: 900 }, 'widths: known columns, rounded, within limits');
});

test('a user’s columns stay theirs; without one, the team’s apply', async () => {
  const { state } = await import('../js/store.js');
  state.chartCols = { category: { order: ['bar', 'code', 'icon', 'category', 'type'], hidden: [], values: ['minutes'] } };
  assert.equal(colsFor('category').order[0], 'bar', 'the team’s');
  state.chartColsMine = { category: { order: ['type'], hidden: ['icon'], values: ['pct'] } };
  assert.equal(colsFor('category').order[0], 'type', 'mine first');
  assert.deepEqual(colsFor('category').hidden, ['icon']);
});

test('six tutorials, one per page, each with its video, poster and thumbnail', () => {
  assert.equal(TUTORIALS.length, 6);
  assert.deepEqual(TUTORIALS.map(t => t.route), ['capture', 'log', 'guide', 'diagram', 'analysis', 'setup']);
  for (const t of TUTORIALS) {
    for (const f of [`media/tutorials/${t.id}.mp4`, `media/tutorials/${t.id}.jpg`, `media/tutorials/${t.id}-thumb.jpg`]) {
      const p = new URL('../' + f, import.meta.url);
      assert.ok(existsSync(p), f);
    }
    assert.ok(t.secs >= 60 && t.secs <= 90, `${t.id} is ${t.secs} s`);
    assert.ok(statSync(new URL(`../media/tutorials/${t.id}.mp4`, import.meta.url)).size < 8e6, `${t.id} stays small`);
  }
  assert.deepEqual(TUTORIALS.filter(t => t.admin).map(t => t.id), ['line', 'setup']);
});
