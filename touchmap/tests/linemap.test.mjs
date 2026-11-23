// The line map must cover every zone and every one of the framework's touch types.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, FRAMEWORK, typeInfo } from '../js/framework.js';
import { ZONE_INFO, ON_EVERY_MACHINE, ZONE_KEYS } from '../js/linemap.js';

test('every framework zone is drawn and described', () => {
  assert.deepEqual([...ZONE_KEYS].sort(), [...FRAMEWORK.zones].sort());
  assert.deepEqual(Object.keys(ZONE_INFO).sort(), [...FRAMEWORK.zones].sort());
});

test('every mapped type exists in the framework, spelled exactly', () => {
  const all = [...ON_EVERY_MACHINE, ...Object.values(ZONE_INFO).flatMap(z => z.types)];
  for (const [code, name] of all) assert.ok(typeInfo(code, name), `${code} · ${name} is not in the framework`);
});

test('all 74 types appear somewhere on the map', () => {
  const seen = new Set([...ON_EVERY_MACHINE, ...Object.values(ZONE_INFO).flatMap(z => z.types)].map(([c, n]) => `${c}|${n}`));
  const missing = CATEGORIES.flatMap(c => c.types.map(t => `${c.code}|${t.name}`)).filter(k => !seen.has(k));
  assert.deepEqual(missing, []);
  assert.equal(CATEGORIES.reduce((s, c) => s + c.types.length, 0), 74);
});

test('no zone lists the same type twice', () => {
  for (const [zone, z] of Object.entries(ZONE_INFO)) {
    const keys = z.types.map(([c, n]) => `${c}|${n}`);
    assert.equal(new Set(keys).size, keys.length, zone);
  }
});
