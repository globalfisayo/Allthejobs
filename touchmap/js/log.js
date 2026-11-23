// The observation log: every touch, newest first, tap to edit.
import { CAT_BY_CODE } from './framework.js';
import { finalise, missingFields, ordered, totalMinutes, perOccurrence, fmtMin, FIELD_LABEL, blankTouch } from './model.js';
import { state, save, activeRun, markTouch, removeTouch, restoreTouch } from './store.js';
import { touchForm } from './form.js';
import { swipeable } from './swipe.js';
import { h, clear, icon, toast, openModal, closeModal, fmt } from './ui.js';

const filters = { show: 'all', q: '' };

export function renderLog(root, { onChange } = {}) {
  const run = activeRun();
  const all = ordered(run.touches);
  const numberOf = new Map(all.map((t, i) => [t.id, i + 1]));
  const needs = all.filter(t => t.incomplete).length;
  const totalMin = all.reduce((s, t) => s + totalMinutes(t), 0);
  const occ = all.reduce((s, t) => s + (Number(t.count) || 0), 0);

  const listEl = h('div', { class: 'entries' });
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Search zone, type, description…', value: filters.q, 'aria-label': 'Search the log' });
  search.addEventListener('input', () => { filters.q = search.value; paintList(); });

  const chip = (key, label) => h('button', {
    type: 'button', class: 'chip small' + (filters.show === key ? ' on' : ''), 'aria-pressed': String(filters.show === key),
    onclick: () => { filters.show = key; renderLog(root, { onChange }); },
  }, label);

  clear(root, h('section', { class: 'log' },
    h('div', { class: 'view-head' },
      h('div', {},
        h('h1', { class: 'view-title', text: 'Observation log' }),
        h('p', { class: 'view-sub', text: `${run.name} · ${all.length} rows · ${fmt.int(occ)} touches · ${fmtMin(totalMin)} min (${fmt.dec(totalMin / 60)} op-hours)` }))),
    needs ? h('button', { type: 'button', class: 'banner warn', onclick: () => { filters.show = 'needs'; renderLog(root, { onChange }); } },
      icon('warn'), `${needs} ${needs === 1 ? 'touch needs' : 'touches need'} details. Categorise them while you still remember.`) : null,
    h('div', { class: 'filter-row' },
      h('div', { class: 'chips' }, chip('all', 'All'), chip('needs', `Needs details${needs ? ` (${needs})` : ''}`), chip('Planned', 'Planned'), chip('Unplanned', 'Unplanned')),
      search),
    all.length && window.matchMedia('(pointer: coarse)').matches ? h('p', { class: 'muted small swipe-hint' }, icon('hand'), 'Swipe a touch left to delete it, right to edit it.') : null,
    listEl));

  function paintList() {
    const q = filters.q.trim().toLowerCase();
    const rows = all.filter(t => {
      if (filters.show === 'needs' && !t.incomplete) return false;
      if ((filters.show === 'Planned' || filters.show === 'Unplanned') && t.planned !== filters.show) return false;
      if (!q) return true;
      const hay = [t.zone, t.who, t.type, t.description, t.touchType, t.category, CAT_BY_CODE[t.category]?.name, t.observer].join(' ').toLowerCase();
      return hay.includes(q);
    }).reverse();

    if (!all.length) {
      clear(listEl, h('div', { class: 'empty-state' },
        icon('hand', 'big'),
        h('p', { text: 'No touches yet. Start the stopwatch on the Capture tab when a touch begins.' }),
        h('a', { class: 'btn primary', href: '#capture' }, icon('timer'), 'Go to Capture')));
      return;
    }
    if (!rows.length) { clear(listEl, h('p', { class: 'empty', text: 'Nothing matches.' })); return; }

    let lastDay = null;
    const out = [];
    for (const t of rows) {
      const when = t.start || t.createdAt;
      const day = fmt.dayKey(when);
      if (day !== lastDay) { out.push(h('div', { class: 'day-h', text: fmt.day(when) })); lastDay = day; }
      out.push(entry(t, numberOf.get(t.id)));
    }
    clear(listEl, out);
  }

  function entry(t, num) {
    const cat = CAT_BY_CODE[t.category];
    const per = perOccurrence(t);
    const total = totalMinutes(t);
    const refresh = () => { onChange?.(); renderLog(root, { onChange }); };
    const row = h('button', { type: 'button', class: 'entry' + (t.incomplete ? ' incomplete' : ''), onclick: () => openEditor(t.id, refresh) },
      h('span', { class: 'entry-num' }, h('strong', { text: `#${num}` }), h('span', { text: fmt.time(t.start || t.createdAt) })),
      h('span', { class: 'entry-main' },
        h('span', { class: 'entry-title' },
          cat ? h('span', { class: 'code ' + (cat.planned ? 'code-p' : 'code-u'), text: cat.code }) : h('span', { class: 'code code-x', text: '?' }),
          h('span', { text: t.type || 'Type of touch not set' })),
        h('span', { class: 'entry-meta', text: [t.zone || 'No zone', t.who, t.touchType, t.observer ? `by ${t.observer}` : ''].filter(Boolean).join(' · ') }),
        t.description ? h('span', { class: 'entry-desc', text: t.description }) : null,
        t.incomplete ? h('span', { class: 'badge warn', text: 'Needs: ' + missingFields(t).map(m => FIELD_LABEL[m]).join(', ') }) : null),
      h('span', { class: 'entry-dur' },
        h('strong', { text: fmtMin(total) }), h('span', { text: ' min' }),
        h('small', { text: per == null ? `${t.count} counted` : `${t.count} × ${fmtMin(per)}` })));
    return swipeable(row, {
      onLeft: () => deleteWithUndo(activeRun(), t.id, num, refresh),
      onRight: () => openEditor(t.id, refresh),
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

/** Edit one logged touch in a dialog, with the same form as capture. */
export function openEditor(id, onDone) {
  const run = activeRun();
  const idx = run.touches.findIndex(t => t.id === id);
  if (idx < 0) return;
  const original = run.touches[idx];
  const model = { ...original };
  const form = touchForm(model, { lists: state.lists, onChange: () => {} });
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
      h('div', {}, h('h2', { text: `Edit touch #${num}` }), h('p', { class: 'muted', text: `${timing}${original.observer ? ` · observer ${original.observer}` : ''}` })),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close'))),
    form.el,
    h('div', { class: 'editor-actions' },
      h('button', { type: 'button', class: 'btn danger-ghost', onclick: doDelete }, icon('trash'), 'Delete'),
      h('button', { type: 'button', class: 'btn ghost', onclick: doRepeat }, icon('copy'), 'Log another like this'),
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn primary', onclick: doSave }, icon('check'), 'Save changes'))),
  { label: `Edit touch #${num}`, wide: true });
}
