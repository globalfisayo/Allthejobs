// The observation log: every touch, newest first, tap to edit. It shows the run picked in Runs
// (or here), the run being logged into by default, or every run's history at once.
import { CAT_BY_CODE } from './framework.js';
import { finalise, missingFields, ordered, totalMinutes, perOccurrence, fmtMin, FIELD_LABEL, blankTouch, sortKey } from './model.js';
import { state, save, activeRun, runsList, markTouch, removeTouch, restoreTouch, peopleFor, canEditTouch } from './store.js';
import { registerEditor } from './stopwatch.js';
import { touchForm } from './form.js';
import { swipeable } from './swipe.js';
import { h, clear, icon, toast, openModal, closeModal, fmt } from './ui.js';
import { zoneIcon, personIcon, categoryIcon, touchTypeIcon } from './iconmap.js';

const filters = { show: 'all', q: '' };

/** Show this run in the Log ('all' for every run; null for the run being logged into). */
export function showInLog(id) {
  state.logRunId = id && id !== state.activeRunId ? id : null;
  save();
}
const shownRun = () => (state.logRunId === 'all' ? null : state.runs[state.logRunId] || activeRun());

export function renderLog(root, { onChange } = {}) {
  const active = activeRun();
  const everyRun = state.logRunId === 'all';
  const run = shownRun();
  const runs = everyRun ? runsList() : [run];
  // each touch with its run and its number in that run
  const items = runs.flatMap(r => ordered(r.touches).map((t, i) => ({ t, r, num: i + 1 })))
    .sort((a, b) => sortKey(a.t).localeCompare(sortKey(b.t)) || (a.t.createdAt || '').localeCompare(b.t.createdAt || ''));
  const all = items.map(x => x.t);
  const needs = all.filter(t => t.incomplete).length;
  const totalMin = all.reduce((s, t) => s + totalMinutes(t), 0);
  const occ = all.reduce((s, t) => s + (Number(t.count) || 0), 0);
  const rerender = () => renderLog(root, { onChange });

  // which run: the one logged into, any earlier one, or all of them
  const picker = h('select', { class: 'run-pick-sel', 'aria-label': 'Run shown in the log' },
    runsList().slice().reverse().map(r => h('option', { value: r.id, selected: !everyRun && r.id === run.id,
      text: `${r.name}${r.id === active.id ? ' · logging here' : ''} · ${r.touches.length} ${r.touches.length === 1 ? 'row' : 'rows'}` })),
    runsList().length > 1 ? h('option', { value: 'all', selected: everyRun, text: `All runs · ${runsList().reduce((s, r) => s + r.touches.length, 0)} rows` }) : null);
  picker.addEventListener('change', () => { showInLog(picker.value); rerender(); });
  const elsewhere = everyRun || run.id !== active.id;

  const listEl = h('div', { class: 'entries' });
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Search zone, type, description…', value: filters.q, 'aria-label': 'Search the log' });
  search.addEventListener('input', () => { filters.q = search.value; paintList(); });

  const chip = (key, label) => h('button', {
    type: 'button', class: 'chip small' + (filters.show === key ? ' on' : ''), 'aria-pressed': String(filters.show === key),
    onclick: () => { filters.show = key; renderLog(root, { onChange }); },
  }, label);

  clear(root, h('section', { class: 'log' },
    h('div', { class: 'view-head log-head' },
      h('div', {},
        h('h1', { class: 'view-title', text: 'Observation log' }),
        h('p', { class: 'view-sub', text: `${everyRun ? `All ${runs.length} runs` : run.name} · ${all.length} rows · ${fmt.int(occ)} touches · ${fmtMin(totalMin)} min (${fmt.dec(totalMin / 60)} op-hours)` })),
      h('label', { class: 'run-pick' }, icon('history'), picker, icon('chevron', 'run-pick-chev'))),
    elsewhere ? h('div', { class: 'log-note' }, icon('eye'),
      h('span', {}, everyRun ? 'Showing every run’s touches, newest first. ' : `Showing ${run.name}. `, `New touches go to ${active.name}.`),
      h('span', { class: 'log-note-acts' },
        !everyRun ? h('button', { type: 'button', class: 'link-btn small', onclick: () => { state.activeRunId = run.id; showInLog(null); toast(`Now logging into “${run.name}”.`); onChange?.(); rerender(); } }, icon('timer'), 'Log into this run') : null,
        h('button', { type: 'button', class: 'link-btn small', onclick: () => { showInLog(null); rerender(); } }, icon('back'), `Back to ${active.name}`))) : null,
    needs ? h('button', { type: 'button', class: 'banner warn', onclick: () => { filters.show = 'needs'; renderLog(root, { onChange }); } },
      icon('warn'), `${needs} ${needs === 1 ? 'touch needs' : 'touches need'} details. Categorise them while you still remember.`) : null,
    h('div', { class: 'filter-row' },
      h('div', { class: 'chips' }, chip('all', 'All'), chip('needs', `Needs details${needs ? ` (${needs})` : ''}`), chip('Planned', 'Planned'), chip('Unplanned', 'Unplanned')),
      search),
    all.length && window.matchMedia('(pointer: coarse)').matches ? h('p', { class: 'muted small swipe-hint' }, icon('hand'), 'Swipe a touch left to delete it, right to edit it.') : null,
    listEl));

  function paintList() {
    const q = filters.q.trim().toLowerCase();
    const rows = items.filter(({ t, r }) => {
      if (filters.show === 'needs' && !t.incomplete) return false;
      if ((filters.show === 'Planned' || filters.show === 'Unplanned') && t.planned !== filters.show) return false;
      if (!q) return true;
      const hay = [t.zone, t.who, t.type, t.description, t.touchType, t.category, CAT_BY_CODE[t.category]?.name, t.observer, everyRun ? r.name : ''].join(' ').toLowerCase();
      return hay.includes(q);
    }).reverse();

    if (!all.length) {
      clear(listEl, h('div', { class: 'empty-state' },
        icon('hand', 'big'),
        h('p', { text: elsewhere ? `No touches in ${everyRun ? 'any run' : run.name} yet.` : 'No touches yet. Start the stopwatch on the Capture tab when a touch begins.' }),
        h('a', { class: 'btn primary', href: '#capture' }, icon('timer'), 'Go to Capture')));
      return;
    }
    if (!rows.length) { clear(listEl, h('p', { class: 'empty', text: 'Nothing matches.' })); return; }

    let lastDay = null;
    const out = [];
    for (const it of rows) {
      const when = it.t.start || it.t.createdAt;
      const day = fmt.dayKey(when);
      if (day !== lastDay) { out.push(h('div', { class: 'day-h', text: fmt.day(when) })); lastDay = day; }
      out.push(entry(it));
    }
    clear(listEl, out);
  }

  function entry({ t, r, num }) {
    const cat = CAT_BY_CODE[t.category];
    const per = perOccurrence(t);
    const total = totalMinutes(t);
    const refresh = () => { onChange?.(); renderLog(root, { onChange }); };
    // your own touches (or any, for an admin) open to edit; anyone else's open to read
    const mine = canEditTouch(t);
    const row = h('button', { type: 'button', class: 'entry' + (t.incomplete ? ' incomplete' : '') + (mine ? '' : ' theirs'), onclick: () => (mine ? openEditor(t.id, refresh, r) : openViewer(t, r, num)) },
      h('span', { class: 'entry-num' }, h('strong', { text: `#${num}` }), h('span', { text: fmt.time(t.start || t.createdAt) })),
      h('span', { class: 'entry-main' },
        h('span', { class: 'entry-title' },
          cat ? h('span', { class: 'code ' + (cat.planned ? 'code-p' : 'code-u'), text: cat.code }) : h('span', { class: 'code code-x', text: '?' }),
          cat ? h('span', { class: 'entry-cat-ico', title: cat.name }, icon(categoryIcon(cat.code))) : null,
          h('span', { text: t.type || 'Type of touch not set' })),
        h('span', { class: 'entry-meta' }, [
          everyRun ? [icon('history'), r.name] : null,
          [icon(zoneIcon(t.zone)), t.zone || 'No zone'],
          t.who ? [icon(personIcon(t.who)), t.who] : null,
          t.touchType ? [icon(touchTypeIcon(t.touchType)), t.touchType] : null,
          t.observer ? [icon('eye'), `by ${t.observer}`] : null,
        ].filter(Boolean).map(([ico, text]) => h('span', { class: 'em' }, ico, text))),
        t.description ? h('span', { class: 'entry-desc', text: t.description }) : null,
        t.incomplete ? h('span', { class: 'badge warn', text: 'Needs: ' + missingFields(t).map(m => FIELD_LABEL[m]).join(', ') }) : null,
        mine ? null : h('span', { class: 'badge lock' }, icon('lock'), t.observer ? `Logged by ${t.observer}` : 'Another device')),
      h('span', { class: 'entry-dur' },
        h('strong', { text: fmtMin(total) }), h('span', { text: ' min' }),
        h('small', { text: per == null ? `${t.count} counted` : `${t.count} × ${fmtMin(per)}` })));
    if (!mine) return row;
    return swipeable(row, {
      onLeft: () => deleteWithUndo(r, t.id, num, refresh),
      onRight: () => openEditor(t.id, refresh, r),
    });
  }

  paintList();
}

/** Delete a touch, with Undo in the toast (the delete also reaches other devices via sync). */
export function deleteWithUndo(run, id, num, onDone) {
  const gone = removeTouch(run, id);
  if (!gone) return;
  save();
  toast(`Touch #${num} deleted.`, { action: { label: 'Undo', fn: () => { restoreTouch(run, gone); save(); onDone?.(); } }, timeout: 7000 });
  onDone?.();
}

/** Someone else's touch: everything about it, nothing to change. */
function openViewer(t, run, num) {
  const cat = CAT_BY_CODE[t.category];
  const per = perOccurrence(t);
  const row = (ico, label, value) => (value ? h('div', { class: 'tv-row' }, icon(ico), h('span', { class: 'muted', text: label }), h('strong', { text: value })) : null);
  openModal(h('div', { class: 'editor touch-view' },
    h('div', { class: 'editor-top' },
      h('div', {}, h('h2', {}, cat ? h('span', { class: 'code ' + (cat.planned ? 'code-p' : 'code-u'), text: cat.code }) : null, ' ', t.type || 'Type of touch not set'),
        h('p', { class: 'muted', text: `#${num} in ${run.name} · ${fmt.day(t.start || t.createdAt)} ${fmt.time(t.start || t.createdAt)}` })),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close'))),
    h('div', { class: 'tv-list' },
      row(zoneIcon(t.zone), 'Zone', t.zone),
      row(personIcon(t.who), 'Person observed', t.who),
      row('layers', 'Planned / unplanned', t.planned),
      row(touchTypeIcon(t.touchType), 'Touch type', t.touchType),
      row('hash', 'Count', String(t.count)),
      row('timer', 'Minutes', `${fmtMin(totalMinutes(t))}${per != null ? ` (${t.count} × ${fmtMin(per)})` : ''}`),
      row('eye', 'Observer', t.observer)),
    t.description ? h('p', { class: 'tv-desc', text: t.description }) : null,
    h('p', { class: 'lock-note' }, icon('lock'), ' Logged on another device. Only the person who logged it, or an admin, can change it.')),
  { label: `Touch #${num}`, wide: true });
}

/** Edit one logged touch in a dialog, with the same form as capture. */
export function openEditor(id, onDone, run = activeRun()) {
  if (!canEditTouch(run.touches.find(t => t.id === id))) return;
  const idx = run.touches.findIndex(t => t.id === id);
  if (idx < 0) return;
  const original = run.touches[idx];
  const model = { ...original };
  const form = touchForm(model, { lists: state.lists, people: peopleFor(run), onChange: () => {} });
  const num = ordered(run.touches).findIndex(t => t.id === id) + 1;

  const timing = original.timedSec != null
    ? `Timed ${fmt.timeSec(original.start)} to ${fmt.timeSec(original.end)} · ${Math.round(original.timedSec)} s`
    : 'Logged without the stopwatch';

  const doSave = () => {
    const miss = missingFields(model);
    const t = finalise(model, { now: new Date() });
    const at = run.touches.findIndex(x => x.id === id);
    if (at < 0) { closeModal(); toast('That touch was deleted on another device.', { tone: 'bad' }); onDone?.(); return; }
    run.touches[at] = t;
    markTouch(run, t.id);
    save(); closeModal();
    toast(miss.length ? `Touch #${num} saved. Still needs ${miss.map(m => FIELD_LABEL[m]).join(', ')}.` : `Touch #${num} updated.`);
    onDone?.();
  };
  const doDelete = () => { closeModal(); deleteWithUndo(run, id, num, onDone); };
  const doRepeat = () => {
    Object.assign(state.draft, blankTouch({ zone: model.zone, who: model.who }), {
      id: state.draft.id, planned: model.planned, category: model.category, type: model.type, touchType: model.touchType,
    });
    save(); closeModal();
    location.hash = '#capture';
    toast('Answers copied to Capture. Start the stopwatch when it happens again.');
  };

  openModal(h('div', { class: 'editor' },
    h('div', { class: 'editor-top' },
      h('div', {}, h('h2', { text: `Edit touch #${num}${run.id !== state.activeRunId ? ` · ${run.name}` : ''}` }), h('p', { class: 'muted', text: `${timing}${original.observer ? ` · observer ${original.observer}` : ''}` })),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close'))),
    form.el,
    h('div', { class: 'editor-actions' },
      h('button', { type: 'button', class: 'btn danger-ghost', onclick: doDelete }, icon('trash'), 'Delete'),
      h('button', { type: 'button', class: 'btn ghost', onclick: doRepeat }, icon('copy'), 'Log another like this'),
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn primary', onclick: doSave }, icon('check'), 'Save changes'))),
  { label: `Edit touch #${num}`, wide: true });
}

registerEditor(openEditor);
