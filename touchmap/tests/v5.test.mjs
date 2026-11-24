// Guide placement follows the framework; colours; the whiteboard's connectors; the default diagram.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFramework, CATEGORIES, FRAMEWORK, typeInfo, isCustomFramework } from '../js/framework.js';
import { resolveColors, textOn, DEFAULT_COLORS } from '../js/colors.js';
import { bbox } from '../js/board.js';
import { defaultDiagram, zonesOnDiagram } from '../js/diagram.js';

test('every type has a place on the line (zones or any machine)', () => {
  const unplaced = CATEGORIES.flatMap(c => c.types.filter(t => !(t.zones || []).length && !t.everywhere).map(t => `${c.code} ${t.name}`));
  assert.deepEqual(unplaced, []);
  assert.deepEqual(typeInfo('P7', 'Preform loading').zones, ['Preform feed']);
  assert.equal(typeInfo('U1', 'LOTO & restart after repair').everywhere, true);
});

test('a renamed type keeps its place; an old saved framework gets placements back', () => {
  const cats = JSON.parse(JSON.stringify(CATEGORIES));
  const t = cats.find(c => c.code === 'P7').types.find(x => x.name === 'Preform loading');
  t.name = 'Preform box tipping';
  applyFramework({ categories: cats });
  assert.deepEqual(typeInfo('P7', 'Preform box tipping').zones, ['Preform feed']);
  // a framework saved before placements existed: no zones on the types
  const old = JSON.parse(JSON.stringify(CATEGORIES)).map(c => ({ ...c, types: c.types.map(({ zones, everywhere, ...rest }) => rest) }));
  old.find(c => c.code === 'P7').types.find(x => x.name === 'Preform box tipping').name = 'Preform loading';
  applyFramework({ categories: old });
  assert.deepEqual(typeInfo('P7', 'Preform loading').zones, ['Preform feed']);
  assert.equal(typeInfo('U7', 'Misalignment or sensor fixed').everywhere, true);
  applyFramework(null);
  assert.equal(isCustomFramework(), false);
});

test('colours: defaults, overrides, junk ignored, readable text on any fill', () => {
  assert.equal(resolveColors(null).planned, DEFAULT_COLORS.planned);
  const c = resolveColors({ planned: '#0F8A9D', unplanned: 'red', zones: { Filler: '#EDA100', Capper: 'nope' } });
  assert.equal(c.planned, '#0F8A9D');
  assert.equal(c.unplanned, DEFAULT_COLORS.unplanned, 'not a #rrggbb colour: ignored');
  assert.deepEqual(c.zones, { Filler: '#EDA100' });
  assert.equal(textOn('#FFF3C4'), '#141414');
  assert.equal(textOn('#1E63B8'), '#fff');
  assert.equal(textOn('#F40009'), '#fff');
});

test('connectors follow the shapes they are attached to', () => {
  const a = { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 50 };
  const b = { id: 'b', type: 'ellipse', x: 300, y: 0, w: 100, h: 50 };
  const line = { id: 'l', type: 'line', from: { id: 'a', anchor: 'e' }, to: { id: 'b', anchor: 'w' }, x1: 0, y1: 0, x2: 0, y2: 0 };
  const shapes = [a, b, line];
  assert.deepEqual(bbox(line, shapes), { x: 100, y: 25, w: 200, h: 0 });
  b.y = 200;
  assert.deepEqual(bbox(line, shapes), { x: 100, y: 25, w: 200, h: 200 }, 'end moved with the ellipse');
  // a deleted shape leaves the stored coordinates in charge
  assert.deepEqual(bbox(line, [a, line]), { x: 0, y: 0, w: 100, h: 25 });
});

test('the default diagram links every zone and its connectors point at real shapes', () => {
  const d = defaultDiagram();
  assert.deepEqual(zonesOnDiagram(d).sort(), [...FRAMEWORK.zones].sort());
  const ids = new Set(d.shapes.map(s => s.id));
  assert.equal(ids.size, d.shapes.length, 'unique ids');
  for (const s of d.shapes.filter(x => x.type === 'line')) {
    if (s.from) assert.ok(ids.has(s.from.id), `${s.id} from`);
    if (s.to) assert.ok(ids.has(s.to.id), `${s.id} to`);
  }
});
