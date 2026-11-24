// Icons, equipment numbers, business units.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LUCIDE } from '../js/icons-lib.js';
import { iconPath } from '../js/ui.js';
import { ZONE_ICONS, CATEGORY_ICONS, PLANNED_ICONS, TOUCH_TYPE_ICONS, recommendIcon, zoneIcon, personIcon, categoryIcon } from '../js/iconmap.js';
import { FRAMEWORK, CATEGORIES } from '../js/framework.js';
import { defaultDiagram, zoneNumbers } from '../js/diagram.js';
import { ORG } from '../js/org.js';

test('every icon is a single path that starts with an absolute move', () => {
  assert.ok(Object.keys(LUCIDE).length > 200);
  for (const [name, d] of Object.entries(LUCIDE)) {
    assert.match(d, /^M/, name);
    assert.doesNotMatch(d, /NaN|undefined/, name);
  }
});

test('every zone, category, person, planned and touch type has an icon that exists', () => {
  for (const z of FRAMEWORK.zones) assert.ok(iconPath(zoneIcon(z)), `zone ${z}`);
  for (const c of CATEGORIES) assert.ok(iconPath(categoryIcon(c.code)), `category ${c.code}`);
  for (const p of FRAMEWORK.people) assert.ok(iconPath(personIcon(p)), `person ${p}`);
  for (const v of [...Object.values(ZONE_ICONS), ...Object.values(CATEGORY_ICONS), ...Object.values(PLANNED_ICONS), ...Object.values(TOUCH_TYPE_ICONS)]) assert.ok(iconPath(v), v);
  assert.equal(personIcon('Ana Pop'), 'user', 'an operator name gets the person icon');
});

test('a new category or zone gets an icon suggested from its name', () => {
  assert.equal(recommendIcon('Robot faults'), 'robot-arm');
  assert.equal(recommendIcon('Bottle washer cleaning'), 'spray-can');
  assert.equal(recommendIcon('Something new', 'map-pin'), 'map-pin');
  assert.ok(iconPath(recommendIcon('Label & sleeve problems')));
});

test('the default line numbers its 15 zones once each, along the line', () => {
  const d = defaultDiagram();
  const nums = zoneNumbers(d);
  assert.equal(Object.keys(nums).length, 15);
  assert.deepEqual(Object.values(nums).sort((a, b) => a - b), Array.from({ length: 15 }, (_, i) => i + 1));
  assert.equal(nums['Line-side store'], 1);
  assert.equal(nums.Filler, 5);
  assert.equal(nums.Other, 15);
});

test('business units: Romania live, three next in line, the rest listed; ids unique', () => {
  const ids = ORG.units.map(u => u.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ORG.units[0].name, 'Romania');
  assert.ok(ORG.units[0].plants.some(p => p.live));
  assert.deepEqual(ORG.units.filter(u => u.featured).map(u => u.name), ['Bulgaria', 'Hungary', 'Serbia']);
  assert.ok(ORG.units.length >= 20);
});
