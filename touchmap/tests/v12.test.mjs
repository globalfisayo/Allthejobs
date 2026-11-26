// 12-hour times on screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fmt } from '../js/ui.js';

test('times read 4:00 pm, not 16:00', () => {
  assert.equal(fmt.time('2026-11-26T16:00:06'), '4:00 pm');
  assert.equal(fmt.timeSec('2026-11-26T16:00:06'), '4:00:06 pm');
  assert.equal(fmt.time('2026-11-26T00:05:00'), '12:05 am');
  assert.equal(fmt.time('2026-11-26T12:30:00'), '12:30 pm');
  assert.equal(fmt.hour('07'), '7 am');
  assert.equal(fmt.hour('16'), '4 pm');
  assert.equal(fmt.hourRange('16'), '4:00–4:59 pm');
  assert.equal(fmt.time(''), '');
});
