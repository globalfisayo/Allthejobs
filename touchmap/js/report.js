// Summary report for one observation: what was observed, how much of the shift it explains,
// where the minutes went. Print it or save it as PDF from the browser.
import { CAT_BY_CODE } from './framework.js';
import { analyse } from './analysis.js';
import { observedSpans, fmtMin } from './model.js';
import { state, activeRun } from './store.js';
import { buildWorkbook } from './export.js';
import { runStats } from './runs.js';
import { analyseRuns } from './insights.js';
import { h, clear, icon, fmt, deliverFile, stamp, slug, fmtDuration } from './ui.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function renderReport(root) {
  const id = new URLSearchParams(location.hash.split('?')[1] || '').get('id');
  const run = state.runs[id] || activeRun();
  const st = runStats(run);
  const a = analyse(run.touches, run.info, state.lists, { capacity: st.capacity });
  const hd = a.headline;
  const i = run.info;
  const spans = observedSpans(run.touches);
  const perHour = st.obs.minutes ? st.touches / (st.obs.minutes / 60) : null;

  const kpi = (ico, label, value, sub) => h('div', { class: 'kpi' }, h('span', { class: 'kpi-ico' }, icon(ico)),
    h('span', { class: 'kpi-txt' }, h('span', { class: 'kpi-label', text: label }), h('strong', { class: 'kpi-val', text: value }), sub ? h('span', { class: 'kpi-sub', text: sub }) : null));

  const rankList = (items, labelOf, { max = 5 } = {}) => {
    const top = items.filter(x => x.minutes > 0).slice(0, max);
    const peak = Math.max(...top.map(x => x.minutes), 0);
    return top.length ? h('ol', { class: 'rank' }, top.map(x => h('li', {},
      h('span', { class: 'rank-label' }, labelOf(x)),
      h('span', { class: 'rank-bar' }, h('span', { style: { width: `${peak ? (x.minutes / peak) * 100 : 0}%`, background: x.colour || 'var(--c-single)' } })),
      h('span', { class: 'rank-val', text: `${fmtMin(x.minutes)} min · ${fmt.pct(x.pct)}` })))) : h('p', { class: 'muted', text: 'Nothing logged yet.' });
  };
  const catLabel = (x) => {
    const c = CAT_BY_CODE[x.key];
    return [h('span', { class: 'code ' + (c?.planned === false ? 'code-u' : c ? 'code-p' : 'code-x'), text: c?.code || '?' }), ' ', c?.short || 'Not categorised'];
  };
  const catColour = (x) => (CAT_BY_CODE[x.key]?.planned === false ? 'var(--c-unplanned)' : 'var(--c-planned)');

  const plannedShare = (st.planned + st.unplanned) ? st.planned / (st.planned + st.unplanned) : null;
  const people = a.byPerson.items.filter(x => x.rows).sort((x, y) => y.minutes - x.minutes);

  clear(root, h('article', { class: 'report' },
    h('div', { class: 'report-actions no-print' },
      h('a', { class: 'btn ghost small', href: '#run' }, icon('history'), 'Runs'),
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => analyseRuns([run.id]) }, icon('chart'), 'Analysis'),
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => deliverFile(buildWorkbook(run, state.lists), `${slug(run.name)}-${stamp()}.xlsx`, XLSX_MIME) }, icon('download'), 'Excel'),
      h('button', { type: 'button', class: 'btn primary small', onclick: () => window.print() }, icon('printer'), 'Print / PDF')),

    h('header', { class: 'report-head' },
      h('div', { class: 'report-kicker' }, icon('report'), 'Touch mapping · observation summary'),
      h('h1', { text: run.name }),
      h('div', { class: 'report-meta' },
        h('span', {}, icon('pin'), [i.line, i.plant].filter(Boolean).join(' · ') || 'Line not set'),
        h('span', {}, icon('calendar'), spans.length ? (spans.length === 1 ? fmt.day(spans[0].day + 'T12:00:00') : `${fmt.day(spans[0].day + 'T12:00:00')} → ${fmt.day(spans[spans.length - 1].day + 'T12:00:00')}`) : 'No touches yet'),
        h('span', {}, icon('flag'), i.finishedAt ? `Finished ${fmt.day(i.finishedAt)} ${fmt.time(i.finishedAt)}` : 'In progress'),
        i.observers ? h('span', {}, icon('eye'), `Observers: ${i.observers}`) : null,
        (i.operatorNames || []).length ? h('span', {}, icon('users'), `Operators: ${i.operatorNames.join(', ')}`) : null,
        i.skus ? h('span', {}, icon('tag'), i.skus) : null)),

    h('section', { class: 'kpis' },
      kpi('clock', 'Observed time', fmtDuration(st.obs.minutes), st.obs.source === 'manual' ? 'set by hand' : `${spans.length} ${spans.length === 1 ? 'day' : 'days'}, first to last touch`),
      kpi('hand', 'Touches', fmt.int(st.touches), `${st.rows} rows${perHour != null ? ` · ${fmt.dec(perHour, 1)} per hour` : ''}`),
      kpi('timer', 'Mapped time', `${fmt.dec(hd.opHours, 1)} op-h`, `${fmt.int(hd.minutes)} min`),
      kpi('target', 'Coverage', fmt.pct(hd.coverage), `of ${fmt.dec(hd.capacity, 1)} op-h reference`),
      kpi('gauge', 'Unexplained gap', `${fmt.dec(hd.gap, 1)} op-h`, 'missed, idle or outside the line'),
      kpi('layers', 'Planned share', fmt.pct(plannedShare), `${fmt.int(st.planned)} planned · ${fmt.int(st.unplanned)} unplanned min`)),

    h('section', { class: 'report-split' },
      h('div', { class: 'rs-bar' },
        h('span', { style: { flexGrow: String(st.planned || 0), background: 'var(--c-planned)' } }, st.planned ? `Planned ${fmt.pct(plannedShare)}` : ''),
        h('span', { style: { flexGrow: String(st.unplanned || 0), background: 'var(--c-unplanned)' } }, st.unplanned ? `Unplanned ${fmt.pct(1 - plannedShare)}` : '')),
      h('p', { class: 'muted small', text: 'Planned touches → design and automation. Unplanned → reliability.' })),

    h('div', { class: 'report-grid' },
      h('section', { class: 'rcard' }, h('h2', {}, icon('trend'), 'Top categories'),
        rankList(a.catPareto.map(x => ({ ...x, colour: catColour(x) })), catLabel, { max: 5 }),
        a.top3.length ? h('p', { class: 'callout', text: `Top ${a.top3.length} = ${fmt.pct(a.top3Share)} of mapped minutes: the project list.` }) : null),
      h('section', { class: 'rcard' }, h('h2', {}, icon('hand'), 'Top types of touch'),
        rankList(a.topTypes.map(x => ({ ...x, colour: x.planned ? 'var(--c-planned)' : 'var(--c-unplanned)' })),
          (x) => [h('span', { class: 'code ' + (x.planned ? 'code-p' : 'code-u'), text: x.code }), ' ', x.type], { max: 5 })),
      h('section', { class: 'rcard' }, h('h2', {}, icon('pin'), 'Where on the line'),
        rankList([...a.byZone.items].sort((x, y) => y.minutes - x.minutes), (x) => x.key, { max: 5 })),
      h('section', { class: 'rcard' }, h('h2', {}, icon('layers'), 'Which lever'),
        rankList(a.byTouchType.items.map(x => ({ ...x, colour: x.key === 'Physical' ? 'var(--c-physical)' : 'var(--c-information)' })),
          (x) => `${x.key} → ${x.key === 'Physical' ? 'automation' : x.key === 'Information' ? 'digitalisation' : '?'}`, { max: 3 })),
      people.length ? h('section', { class: 'rcard' }, h('h2', {}, icon('users'), 'By person'),
        rankList(people, (x) => x.key, { max: 8 })) : null,
      spans.length ? h('section', { class: 'rcard' }, h('h2', {}, icon('calendar'), 'By day'),
        h('table', { class: 'tbl' },
          h('thead', {}, h('tr', {}, ['Day', 'Observed', 'Touches', 'Minutes'].map((x, k) => h('th', { class: k ? 'num' : '', text: x })))),
          h('tbody', {}, spans.map(d => h('tr', {},
            h('th', { scope: 'row', text: fmt.day(d.day + 'T12:00:00') }),
            h('td', { class: 'num', text: `${fmt.time(d.start.toISOString())}–${fmt.time(d.end.toISOString())}` }),
            h('td', { class: 'num', text: fmt.int(d.touches) }),
            h('td', { class: 'num', text: fmtMin(d.minutes) })))))) : null),

    (a.incomplete || a.untimed) ? h('section', { class: 'rcard quality' }, h('h2', {}, icon('warn'), 'Data quality'),
      h('ul', {},
        a.incomplete ? h('li', { text: `${a.incomplete} ${a.incomplete === 1 ? 'touch' : 'touches'} still need details (counted as “not set”).` }) : null,
        a.untimed ? h('li', { text: `${a.untimed} ${a.untimed === 1 ? 'row was' : 'rows were'} counted but not timed (0 minutes).` }) : null)) : null,

    h('footer', { class: 'report-foot muted small', text: `Generated ${fmt.day(new Date().toISOString())} ${fmt.time(new Date().toISOString())} · Touch Map · reference frame: ${run.info.capacityMode === 'observed' ? 'operators × observed time' : 'operators × shift (template)'}` })));
}
