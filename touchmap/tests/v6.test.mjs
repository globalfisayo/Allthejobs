// Sign-in, the organisation, groups and the shape library, demo data for the plants.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLogin, hashLogin } from '../js/auth.js';
import { ORG, plantOf, lineOf, allPlants } from '../js/org.js';
import { makeGroup, placed, bodyBox, bbox } from '../js/board.js';
import { defaultDiagram, builtinLibrary } from '../js/diagram.js';
import { buildOrgDemo } from '../js/demo-org.js';
import { totalMinutes } from '../js/model.js';
import { CAT_BY_CODE } from '../js/framework.js';
import { loadAppsScript } from './fake-sheets.mjs';

// The real passwords are not in this public repo. To check them, run:
//   TM_USER_PASS=… TM_ADMIN_PASS=… npm test
test('one shared login, a second password for admins; nothing else gets in', async (t) => {
  assert.equal(await checkLogin('CCH', 'not-the-password'), null);
  assert.equal(await checkLogin('CCH', ''), null);
  assert.match(await hashLogin('CCH', 'x'), /^[0-9a-f]{64}$/);
  assert.equal(await hashLogin('CCH', 'x'), await hashLogin('cch ', 'x'), 'the username is trimmed and not case-sensitive');
  assert.notEqual(await hashLogin('CCH', 'x'), await hashLogin('CCH', 'X'), 'the password is');
  const { TM_USER_PASS: user, TM_ADMIN_PASS: admin } = process.env;
  if (!user || !admin) { t.diagnostic('TM_USER_PASS / TM_ADMIN_PASS not set: the real logins were not checked'); return; }
  assert.equal(await checkLogin('CCH', user), 'user');
  assert.equal(await checkLogin('cch', admin), 'admin');
  assert.equal(await checkLogin('Other', user), null);
  const src = await import('node:fs').then(fs => fs.readFileSync(new URL('../js/auth.js', import.meta.url), 'utf8'));
  assert.ok(!src.includes(user) && !src.includes(admin), 'no password in the source');
});

test('the organisation: Romania with Ploiești live, Timișoara and Poiana Negri not yet', () => {
  assert.equal(ORG.units[0].name, 'Romania');
  assert.deepEqual(allPlants().map(p => [p.name, p.live]), [['Ploiești', true], ['Timișoara', false], ['Poiana Negri', false]]);
  // runs store names; spelling without accents still finds the plant, and the full line name finds the line
  assert.equal(plantOf('Ploiesti')?.id, 'PLO');
  assert.equal(plantOf('Ploiești')?.id, 'PLO');
  assert.equal(plantOf('timisoara')?.id, 'TIM');
  assert.equal(lineOf(plantOf('Ploiești'), 'Krones 3 (ErgoBloc)')?.id, 'K3');
  assert.equal(lineOf(plantOf('Ploiești'), 'K3')?.id, 'K3');
  assert.equal(plantOf('Nowhere'), null);
});

test('grouping keeps the drawing where it was and scales it as one piece', () => {
  const ring = { id: 'a', type: 'ellipse', x: 100, y: 100, w: 100, h: 100, zone: 'Filler' };
  const pocket = { id: 'b', type: 'rect', x: 190, y: 140, w: 20, h: 20 };
  const g = makeGroup([ring, pocket], [ring, pocket]);
  assert.deepEqual([g.x, g.y, g.w, g.h], [100, 100, 110, 100]);
  assert.equal(g.zone, 'Filler', 'the zone moves to the group');
  assert.equal(g.children.find(c => c.type === 'ellipse').body, true, 'the zoned shape is the body');
  // drawn back at the same place
  const back = g.children.map(c => placed(c, g));
  assert.deepEqual(back.map(c => [c.x, c.y, c.w, c.h]), [[100, 100, 100, 100], [190, 140, 20, 20]]);
  // twice the size: children double, anchors and badges use the body
  const big = { ...g, w: g.w * 2, h: g.h * 2 };
  assert.deepEqual(placed(g.children[1], big), { ...g.children[1], x: 280, y: 180, w: 40, h: 40 });
  assert.deepEqual(bodyBox(big), { x: 100, y: 100, w: 200, h: 200, type: 'ellipse' });
  // a connector attached to the group lands on the body's edge
  const line = { id: 'l', type: 'line', from: { id: g.id, anchor: 'w' }, to: null, x1: 0, y1: 0, x2: 0, y2: 150 };
  assert.deepEqual(bbox(line, [g, line]), { x: 0, y: 150, w: 100, h: 0 });
});

test('bent lines measure through their bend points', () => {
  const line = { id: 'l', type: 'line', from: null, to: null, x1: 0, y1: 0, x2: 100, y2: 0, via: [{ x: 50, y: 80 }] };
  assert.deepEqual(bbox(line, [line]), { x: 0, y: 0, w: 100, h: 80 });
});

test('the default line: each machine is a group with its detail, and is in the library', () => {
  const d = defaultDiagram();
  const groups = d.shapes.filter(s => s.type === 'group');
  assert.equal(groups.length, 14);
  const filler = groups.find(g => g.zone === 'Filler');
  assert.equal(filler.children.filter(c => c.type === 'rect').length, 18, 'the filler has its 18 pockets');
  assert.equal(filler.children.filter(c => c.type === 'ellipse').length, 2, 'and its two rings');
  assert.ok(groups.every(g => g.children.some(c => c.body)), 'every machine has a body for badges and anchors');
  assert.ok(groups.every(g => g.children.some(c => c.label)), 'and a name to edit');
  const belt = d.shapes.find(s => s.id === 'belt');
  assert.equal(belt.dash, 'belt');
  assert.equal(belt.via.length, 2);
  const lib = builtinLibrary();
  assert.deepEqual(lib.map(x => x.name).sort(), groups.map(g => g.name).sort());
  assert.ok(lib.every(x => x.builtin && x.children.length));
});

test('the library is shared through the team sheet like the rest of Setup', () => {
  const gs = loadAppsScript();
  const filler = builtinLibrary().find(x => x.name === 'Filler');
  const entry = { ...filler, id: 'mine', builtin: undefined, name: 'Filler (new valves)' };
  gs.post({ since: 0, runs: [], touches: [], tombstones: [], settings: { updatedAt: '2026-11-24T10:00:00.000Z', data: { library: [entry] } } });
  const b = gs.post({ since: 0, runs: [], touches: [], tombstones: [] });
  assert.equal(b.settings.data.library[0].name, 'Filler (new valves)');
  assert.equal(b.settings.data.library[0].children.length, filler.children.length);
});

test('demo data: every line of the plants not live yet, believable and repeatable', () => {
  const a = buildOrgDemo(), b = buildOrgDemo();
  assert.deepEqual(a.map(r => r.touches.length), b.map(r => r.touches.length), 'same numbers every time');
  const plants = new Set(a.map(r => r.info.plant));
  assert.deepEqual([...plants].sort(), ['Poiana Negri', 'Timișoara']);
  for (const r of a) {
    assert.ok(r.demo && r.localOnly, 'never synced');
    assert.ok(lineOf(plantOf(r.info.plant), r.info.line), `${r.info.line} is a known line`);
    assert.ok(r.touches.length > 20);
    for (const t of r.touches) {
      assert.ok(CAT_BY_CODE[t.category], t.category);
      assert.ok(totalMinutes(t) > 0);
      assert.equal(t.incomplete, false);
    }
  }
  // water lines have no syrup room
  assert.ok(a.filter(r => r.info.plant === 'Poiana Negri').every(r => r.touches.every(t => t.zone !== 'Mixer / carbo')));
  // the breakdown-prone line shows more unplanned time than its sister line
  const unplanned = (line) => a.filter(r => r.info.line === line).flatMap(r => r.touches).filter(t => t.planned === 'Unplanned').reduce((s, t) => s + totalMinutes(t), 0) / a.filter(r => r.info.line === line).length;
  assert.ok(unplanned('PET line 2') > unplanned('PET line 1'));
  // with the live plant included, Ploiești K3 gets a preview too
  assert.ok(buildOrgDemo({ includeLive: true }).some(r => r.info.plant === 'Ploiești'));
});
