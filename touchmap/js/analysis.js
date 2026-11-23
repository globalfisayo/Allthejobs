// The template's 'Analysis' sheet as one pure function: every block is a SUMIF over the
// log of Count (touches) and Total minutes, with op-hours and % of the block's minutes.
import { CATEGORIES, CAT_BY_CODE, FRAMEWORK, TOUCH_TYPES, PLANNED } from './framework.js';
import { totalMinutes, referenceCapacity } from './model.js';

export const NOT_SET = 'Not set';

function block(rows, keyOf, order) {
  const acc = new Map(order.map(k => [k, { key: k, touches: 0, minutes: 0, rows: 0 }]));
  for (const r of rows) {
    const k = keyOf(r) || NOT_SET;
    if (!acc.has(k)) acc.set(k, { key: k, touches: 0, minutes: 0, rows: 0 });
    const a = acc.get(k);
    a.touches += Number(r.count) || 0;
    a.minutes += r._total;
    a.rows += 1;
  }
  const items = [...acc.values()];
  const total = { touches: 0, minutes: 0, rows: 0 };
  for (const i of items) { total.touches += i.touches; total.minutes += i.minutes; total.rows += i.rows; }
  for (const i of items) {
    i.opHours = i.minutes / 60;
    i.pct = total.minutes ? i.minutes / total.minutes : null;
  }
  total.opHours = total.minutes / 60;
  // A 'Not set' row only shows when something is actually missing.
  return { items: items.filter(i => i.key !== NOT_SET || i.rows > 0), total };
}

/** Sort a block by minutes, largest first, with the running share for a Pareto read. */
export function pareto(items) {
  const sorted = [...items].filter(i => i.key !== NOT_SET).sort((a, b) => b.minutes - a.minutes || b.touches - a.touches);
  const sum = sorted.reduce((s, i) => s + i.minutes, 0);
  let run = 0;
  return sorted.map((i, idx) => { run += i.minutes; return { ...i, rank: idx + 1, cum: sum ? run / sum : null }; });
}

export function analyse(touches, info, lists = {}) {
  const rows = touches.map(t => ({ ...t, _total: totalMinutes(t) }));
  const touchesLogged = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);
  const minutes = rows.reduce((s, r) => s + r._total, 0);
  const opHours = minutes / 60;
  const { capacity, available } = referenceCapacity(info);
  const zones = lists.zones?.length ? lists.zones : FRAMEWORK.zones;
  const people = lists.people?.length ? lists.people : FRAMEWORK.people;

  const byPlanned = block(rows, r => r.planned, PLANNED);
  const byCategory = block(rows, r => r.category, CATEGORIES.map(c => c.code));
  const byTouchType = block(rows, r => r.touchType, TOUCH_TYPES);
  const byZone = block(rows, r => r.zone, zones);
  const byRoute = block(rows, r => r.route, FRAMEWORK.routes);
  const byPerson = block(rows.filter(r => r.who), r => r.who, people);
  const byType = block(rows.filter(r => r.category && r.type), r => `${r.category}\u0000${r.type}`, []);
  byType.items = byType.items.map(i => {
    const [code, type] = i.key.split('\u0000');
    return { ...i, code, type, planned: CAT_BY_CODE[code]?.planned };
  });

  // How much of each planned/unplanned half the top-3 categories take.
  const catPareto = pareto(byCategory.items);
  const top3 = catPareto.slice(0, 3).filter(i => i.minutes > 0);
  const top3Share = byCategory.total.minutes ? top3.reduce((s, i) => s + i.minutes, 0) / byCategory.total.minutes : null;

  const plannedMin = byPlanned.items.find(i => i.key === 'Planned')?.minutes ?? 0;
  const unplannedMin = byPlanned.items.find(i => i.key === 'Unplanned')?.minutes ?? 0;

  return {
    rows: rows.length,
    incomplete: rows.filter(r => r.incomplete).length,
    untimed: rows.filter(r => r._total === 0 && (Number(r.count) || 0) > 0).length,
    headline: {
      touchesLogged, minutes, opHours, capacity, available,
      coverage: capacity ? opHours / capacity : null,
      gap: capacity - opHours,
      plannedHours: plannedMin / 60, unplannedHours: unplannedMin / 60,
    },
    byPlanned, byCategory, catPareto, top3, top3Share,
    byTouchType, byZone, byRoute, byPerson,
    topTypes: pareto(byType.items).slice(0, 10),
  };
}
