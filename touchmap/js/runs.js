// Runs: every observation, kept. History cards to open, compare or report; the details of
// one run in collapsible groups (info, operators, observation time, reference frame, export).
import { referenceCapacity, runCapacity, observedMinutes, observedSpans, totalMinutes, mergeTouches } from './model.js';
import { state, save, activeRun, runsList, createRun, deleteRun, nextRunName, storageHealthy, markRun, markTouch, canEditTouch } from './store.js';
import { buildWorkbook, buildCsv, buildBackup, parseBackup } from './export.js';
import { h, clear, icon, toast, deliverFile, pickFile, canShareFiles, confirmBox, openModal, closeModal, fmt, stamp, slug, group, fmtDuration } from './ui.js';
import { analyseRuns } from './insights.js';
import { showInLog } from './log.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const view = { editId: null, selected: new Set() };

/** Figures for a run card or report. */
export function runStats(run) {
  let touches = 0, minutes = 0, planned = 0, unplanned = 0, needs = 0;
  for (const t of run.touches) {
    const m = totalMinutes(t);
    touches += Number(t.count) || 0; minutes += m;
    if (t.planned === 'Planned') planned += m; else if (t.planned === 'Unplanned') unplanned += m;
    if (t.incomplete) needs++;
  }
  const obs = observedMinutes(run);
  const capacity = runCapacity(run);
  const spans = obs.spans || observedSpans(run.touches);
  const days = spans.map(s => s.day);
  return { touches, rows: run.touches.length, minutes, planned, unplanned, needs, obs, capacity, coverage: capacity ? minutes / 60 / capacity : null, days };
}

function dateRange(run, st) {
  const days = st.days.length ? st.days : [String(run.createdAt || '').slice(0, 10)].filter(Boolean);
  if (!days.length) return 'No date';
  const f = (d) => fmt.day(d + 'T12:00:00');
  return days.length === 1 ? f(days[0]) : `${f(days[0])} → ${f(days[days.length - 1])} (${days.length} days)`;
}

function statusOf(run) {
  if (run.localOnly) return { cls: 'demo', label: 'Demo', ico: 'chart' };
  if (run.info.finishedAt) return { cls: 'done', label: 'Finished', ico: 'flag' };
  return { cls: 'open', label: 'In progress', ico: 'timer' };
}

export function renderRuns(root, { onChange } = {}) {
  const active = activeRun();
  if (!view.editId || !state.runs[view.editId]) view.editId = active.id;
  for (const id of [...view.selected]) if (!state.runs[id]) view.selected.delete(id);
  const rerender = () => { renderRuns(root, { onChange }); onChange?.(); };
  const runs = runsList().slice().reverse();

  /* ---------- history ---------- */
  const card = (run) => {
    const st = runStats(run);
    const status = statusOf(run);
    const isActive = run.id === active.id;
    const isEdit = run.id === view.editId;
    const check = h('input', { type: 'checkbox', checked: view.selected.has(run.id), 'aria-label': `Select ${run.name} to compare` });
    check.addEventListener('change', () => { if (check.checked) view.selected.add(run.id); else view.selected.delete(run.id); rerender(); });
    const total = Math.max(st.capacity, st.minutes / 60) || 1;
    const names = run.info.operatorNames || [];
    return h('article', { class: 'run-card' + (isActive ? ' active' : '') + (isEdit ? ' editing' : '') },
      h('label', { class: 'rc-check', title: 'Select to compare' }, check),
      h('button', { type: 'button', class: 'rc-main', onclick: () => { view.editId = run.id; showInLog(run.id); rerender(); document.getElementById('run-details')?.scrollIntoView({ behavior: 'smooth' }); } },
        h('span', { class: 'rc-top' },
          h('strong', { class: 'rc-name', text: run.name }),
          isActive ? h('span', { class: 'pill live' }, icon('timer'), 'Logging here') : null,
          h('span', { class: 'pill ' + status.cls }, icon(status.ico), status.label)),
        h('span', { class: 'rc-meta' },
          h('span', {}, icon('calendar'), dateRange(run, st)),
          h('span', {}, icon('clock'), st.obs.minutes ? fmtDuration(st.obs.minutes) : '–'),
          h('span', {}, icon('users'), names.length ? `${names.length} · ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}` : `${run.info.operators || 0} operators`),
          h('span', {}, icon('hand'), `${fmt.int(st.touches)} touches`),
          h('span', {}, icon('timer'), `${fmt.int(st.minutes)} min`),
          h('span', {}, icon('target'), st.coverage == null ? '–' : `${fmt.pct(st.coverage)} coverage`)),
        h('span', { class: 'rc-bar', 'aria-hidden': 'true' },
          h('span', { style: { width: `${(st.planned / 60 / total) * 100}%`, background: 'var(--c-planned)' } }),
          h('span', { style: { width: `${(st.unplanned / 60 / total) * 100}%`, background: 'var(--c-unplanned)' } }))),
      h('div', { class: 'rc-actions' },
        h('a', { class: 'btn ghost small', href: '#log', onclick: () => showInLog(run.id) }, icon('list'), 'Log'),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => analyseRuns([run.id]) }, icon('chart'), 'Analysis'),
        h('a', { class: 'btn ghost small', href: `#report?id=${encodeURIComponent(run.id)}` }, icon('report'), 'Report'),
        !isActive ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => { state.activeRunId = run.id; showInLog(null); toast(`Now logging into “${run.name}”.`); rerender(); } }, icon('timer'), 'Log here') : null));
  };

  async function newObservation() {
    const cur = activeRun();
    if (cur.touches.length && !cur.info.finishedAt && !cur.localOnly) {
      const choice = await new Promise(resolve => {
        let done = false;
        const pick = (v) => { done = true; closeModal(); resolve(v); };
        openModal(h('div', { class: 'confirm' },
          h('h2', {}, icon('flag'), ` Finish “${cur.name}” first?`),
          h('p', { class: 'muted', text: `It has ${cur.touches.length} rows. It stays in Runs either way.` }),
          h('div', { class: 'stack' },
            h('button', { type: 'button', class: 'btn primary', onclick: () => pick('finish') }, icon('flag'), 'Finish it and start a new one'),
            h('button', { type: 'button', class: 'btn ghost', onclick: () => pick('new') }, icon('plus'), 'Start a new one, keep it open'),
            h('button', { type: 'button', class: 'btn ghost', onclick: () => pick(null) }, 'Cancel'))),
        { label: 'Finish first?', onClose: () => { if (!done) resolve(null); } });
      });
      if (!choice) return;
      if (choice === 'finish') finishRun(cur, { quiet: true });
    }
    const r = createRun(nextRunName());
    view.editId = r.id;
    showInLog(null);
    toast(`${r.name} started. Earlier runs are kept below.`);
    rerender();
  }

  const selected = [...view.selected];
  const history = h('section', { class: 'runs-history' },
    h('div', { class: 'view-head' },
      h('div', {},
        h('h1', { class: 'view-title' }, icon('history', 'title-ico'), 'Runs'),
        h('p', { class: 'view-sub', text: `${runs.length} ${runs.length === 1 ? 'observation' : 'observations'} · tap one for details, tick to compare` })),
      h('button', { type: 'button', class: 'btn primary', onclick: newObservation }, icon('plus'), 'New observation')),
    !storageHealthy() ? h('div', { class: 'banner bad' }, icon('warn'), 'This browser is refusing to save. Private browsing? Export now and switch to a normal window.') : null,
    selected.length ? h('div', { class: 'compare-bar' },
      h('span', {}, icon('boxCheck'), `${selected.length} selected`),
      h('button', { type: 'button', class: 'btn primary small', onclick: () => analyseRuns(selected) }, icon('chart'), selected.length > 1 ? 'Analyse together' : 'Analyse'),
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => { view.selected.clear(); rerender(); } }, icon('close'), 'Clear')) : null,
    h('div', { class: 'run-cards' }, runs.map(card)),
    runs.length > 1 ? h('button', { type: 'button', class: 'link-btn', onclick: () => analyseRuns(runs.filter(r => !r.localOnly).map(r => r.id)) }, icon('layers'), 'Analyse all runs together') : null);

  /* ---------- details of one run ---------- */
  const run = state.runs[view.editId];
  const info = run.info;
  const st = runStats(run);

  const field = (key, label, { type = 'text', inputmode, step, min, placeholder } = {}) => {
    const input = h('input', { type, value: info[key] ?? '', inputmode, step, min, placeholder, id: 'ri-' + key, autocomplete: 'off' });
    input.addEventListener('input', () => {
      info[key] = type === 'number' ? (input.value === '' ? '' : Number(input.value.replace(',', '.'))) : input.value;
      markRun(run); save(); paintFrame(); paintTime();
    });
    return h('label', { class: 'f', for: 'ri-' + key }, h('span', { class: 'f-label', text: label }), input);
  };

  const nameInput = h('input', { type: 'text', value: run.name, id: 'run-name', autocomplete: 'off' });
  nameInput.addEventListener('change', () => { run.name = nameInput.value.trim() || run.name; markRun(run); save(); rerender(); });

  // Operators
  const opsBox = h('div');
  function paintOps() {
    const names = info.operatorNames || [];
    const add = h('input', { type: 'text', placeholder: 'Operator name', id: 'op-add', autocomplete: 'off', 'aria-label': 'Operator name' });
    const doAdd = () => {
      const v = add.value.trim();
      if (!v) return;
      if (names.includes(v)) { toast(`${v} is already listed.`); return; }
      info.operatorNames = [...names, v];
      markRun(run); save(); paintOps(); paintFrame(); add.focus();
    };
    add.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
    clear(opsBox,
      names.length ? h('div', { class: 'chips' }, names.map(n => h('span', { class: 'chip on removable' },
        icon('user'), n,
        h('button', { type: 'button', class: 'chip-x', 'aria-label': `Remove ${n}`, onclick: () => { info.operatorNames = names.filter(x => x !== n); markRun(run); save(); paintOps(); paintFrame(); } }, icon('close'))))) :
        h('p', { class: 'muted small', text: 'No names yet. Names appear as “Person observed” on Capture.' }),
      h('div', { class: 'add-row' }, add, h('button', { type: 'button', class: 'btn ghost', onclick: doAdd }, icon('plus'), 'Add')),
      names.length && Number(info.operators) !== names.length ? h('button', { type: 'button', class: 'link-btn small', onclick: () => { info.operators = names.length; markRun(run); save(); rerender(); } }, icon('users'), `Set operators per shift to ${names.length}`) : null);
  }

  // Observation time
  const timeBox = h('div');
  function paintTime() {
    const obs = observedMinutes(run);
    const spans = observedSpans(run.touches);
    const start = h('input', { type: 'datetime-local', value: info.obsStart || '', id: 'obs-start' });
    const end = h('input', { type: 'datetime-local', value: info.obsEnd || '', id: 'obs-end' });
    const onT = () => { info.obsStart = start.value; info.obsEnd = end.value; markRun(run); save(); paintSummaryTime(); paintFrame(); };
    start.addEventListener('change', onT); end.addEventListener('change', onT);
    const sumEl = h('div', { class: 'obs-total' });
    function paintSummaryTime() {
      const o = observedMinutes(run);
      clear(sumEl, h('span', { class: 'obs-big' }, icon('clock'), fmtDuration(o.minutes)),
        h('span', { class: 'muted small', text: o.source === 'manual' ? 'set manually' : o.source === 'touches' ? 'from first to last touch, each day' : 'no touches yet' }));
    }
    paintSummaryTime();
    clear(timeBox,
      sumEl,
      spans.length ? h('ul', { class: 'obs-days' }, spans.map(d => h('li', {},
        h('span', {}, icon('calendar'), fmt.day(d.day + 'T12:00:00')),
        h('span', { text: `${fmt.time(d.start.toISOString())} → ${fmt.time(d.end.toISOString())}` }),
        h('span', { class: 'muted', text: fmtDuration(d.spanMin) })))) : null,
      h('details', { class: 'mini-details', open: obs.source === 'manual' },
        h('summary', {}, icon('edit'), 'Set the time by hand'),
        h('div', { class: 'f-grid' },
          h('label', { class: 'f', for: 'obs-start' }, h('span', { class: 'f-label', text: 'Started' }), start),
          h('label', { class: 'f', for: 'obs-end' }, h('span', { class: 'f-label', text: 'Ended' }), end)),
        info.obsStart || info.obsEnd ? h('button', { type: 'button', class: 'link-btn small', onclick: () => { info.obsStart = ''; info.obsEnd = ''; markRun(run); save(); paintTime(); paintFrame(); } }, icon('reset'), 'Use the touches instead') : null),
      h('div', { class: 'finish-row' },
        info.finishedAt
          ? [h('span', { class: 'pill done' }, icon('flag'), `Finished ${fmt.day(info.finishedAt)} ${fmt.time(info.finishedAt)}`),
            h('a', { class: 'btn primary', href: `#report?id=${encodeURIComponent(run.id)}` }, icon('report'), 'Summary report'),
            h('button', { type: 'button', class: 'btn ghost', onclick: () => { info.finishedAt = ''; markRun(run); save(); rerender(); } }, icon('reset'), 'Reopen')]
          : [h('button', { type: 'button', class: 'btn primary', onclick: () => finishRun(run) }, icon('flag'), 'Finish observation'),
            h('a', { class: 'btn ghost', href: `#report?id=${encodeURIComponent(run.id)}` }, icon('report'), 'Preview report')]));
  }

  // Reference frame
  const availOut = h('output', { class: 'calc-val' });
  const capOut = h('output', { class: 'calc-val big' });
  const modeSeg = h('div', { class: 'seg small', role: 'group', 'aria-label': 'Capacity based on' });
  function paintFrame() {
    availOut.value = fmt.dec(referenceCapacity(info).available, 1);
    capOut.value = fmt.dec(runCapacity(run), 1);
    clear(modeSeg, [['shift', 'Full shift'], ['observed', 'Observed time']].map(([k, label]) => h('button', {
      type: 'button', class: 'seg-btn' + ((info.capacityMode || 'shift') === k ? ' on' : ''), 'aria-pressed': String((info.capacityMode || 'shift') === k),
      onclick: () => { info.capacityMode = k; markRun(run); save(); paintFrame(); },
    }, label)));
  }

  // Export
  const shareable = canShareFiles();
  const fileBase = () => `${slug(run.name)}-${stamp()}`;
  const exportXlsx = async (share) => {
    const ok = await deliverFile(buildWorkbook(run, state.lists), `${fileBase()}.xlsx`, XLSX_MIME, { share });
    if (ok) { run.lastExport = new Date().toISOString(); save(); }
  };
  const exportJson = async (share) => {
    const ok = await deliverFile(buildBackup(run, state.lists), `${fileBase()}.touchmap.json`, 'application/json', { share });
    if (ok) { run.lastExport = new Date().toISOString(); save(); }
  };
  async function importBackup() {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    let data;
    try { data = parseBackup(await file.text()); } catch (e) { toast(e.message, { tone: 'bad' }); return; }
    const same = data.run.id && state.runs[data.run.id];
    openModal(h('div', { class: 'confirm' },
      h('h2', {}, icon('upload'), ' Import a backup'),
      h('p', { text: `“${data.run.name}”: ${data.run.touches.length} touches. Nothing is deleted; the newest edit of each touch wins.` }),
      h('div', { class: 'stack' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => doMerge(same ? state.runs[data.run.id] : run, data) },
          same ? `Merge into “${state.runs[data.run.id].name}”` : `Merge into “${run.name}”`),
        !same ? h('button', { type: 'button', class: 'btn ghost', onclick: () => {
          const r = createRun(data.run.name, { ...data.run.info });
          r.touches = data.run.touches; r.touches.forEach(t => markTouch(r, t.id)); save(); closeModal();
          toast(`Imported as a new run with ${r.touches.length} touches.`); rerender();
        } }, 'Add as a separate run') : null,
        h('button', { type: 'button', class: 'btn ghost', onclick: () => closeModal() }, 'Cancel'))),
    { label: 'Import a backup' });
  }
  function doMerge(target, data) {
    const m = mergeTouches(target.touches, data.run.touches);
    target.touches = m.touches;
    const incoming = new Set(data.run.touches.map(t => t.id));
    target.touches.filter(t => incoming.has(t.id)).forEach(t => markTouch(target, t.id));
    save(); closeModal();
    toast(`Merged: ${m.added} new, ${m.updated} updated.`);
    rerender();
  }

  async function removeRun() {
    const ok = await confirmBox({ title: `Delete “${run.name}”?`, body: `This removes the run and its ${run.touches.length} touches${state.sync.url ? ' from this device and the team sheet' : ' from this device'}. Export it first if you might need it.`, ok: 'Delete run', danger: true });
    if (!ok) return;
    deleteRun(run.id); view.editId = null; view.selected.delete(run.id); toast('Run deleted.'); rerender();
  }

  const isActive = run.id === active.id;
  const details = h('section', { class: 'run-details', id: 'run-details' },
    h('div', { class: 'details-head' },
      h('h2', {}, icon('report'), run.name),
      h('div', { class: 'row-gap' },
        h('a', { class: 'btn ghost small', href: '#log', onclick: () => showInLog(run.id) }, icon('list'), `Its log (${run.touches.length})`),
        isActive ? h('span', { class: 'pill live' }, icon('timer'), 'Logging here')
          : h('button', { type: 'button', class: 'btn ghost small', onclick: () => { state.activeRunId = run.id; showInLog(null); toast(`Now logging into “${run.name}”.`); rerender(); } }, icon('timer'), 'Log into this run'))),

    group('run-info', 'Observation run', 'report', { open: true },
      h('label', { class: 'f', for: 'run-name' }, h('span', { class: 'f-label', text: 'Run name' }), nameInput),
      h('div', { class: 'f-grid' },
        field('line', 'Line'), field('plant', 'Plant'),
        field('from', 'Window from', { type: 'date' }), field('to', 'Window to', { type: 'date' })),
      field('skus', 'Formats / SKUs', { placeholder: 'e.g. Coca-Cola 2 L, Fanta 0.5 L' }),
      h('div', { class: 'f-grid' },
        field('changeovers', 'Changeovers', { inputmode: 'numeric' }),
        field('cips', 'CIPs', { inputmode: 'numeric' }),
        field('observers', 'Observers'))),

    group('run-ops', 'Operators observed', 'users', { open: true, badge: (info.operatorNames || []).length || null }, opsBox),

    group('run-time', 'Observation time & finish', 'clock', { open: true, badge: st.obs.minutes ? fmtDuration(st.obs.minutes) : null }, timeBox),

    group('run-frame', 'Reference frame', 'target', { badge: `${fmt.dec(runCapacity(run), 1)} op-h` },
      h('div', { class: 'f-grid' },
        field('operators', 'Operators per shift', { type: 'number', inputmode: 'decimal', min: '0', step: '1' }),
        field('shiftHours', 'Shift length (h)', { type: 'number', inputmode: 'decimal', min: '0', step: '0.5' }),
        field('breakHours', 'Break per operator (h)', { type: 'number', inputmode: 'decimal', min: '0', step: '0.25' }),
        field('shifts', 'Shifts covered', { type: 'number', inputmode: 'numeric', min: '1', step: '1' })),
      h('div', { class: 'field cover-row' }, h('span', { class: 'field-label', text: 'Capacity based on' }), modeSeg),
      h('div', { class: 'calc-row' }, h('span', {}, icon('user'), ' Available per operator (h)'), availOut),
      h('div', { class: 'calc-row big' }, h('span', {}, icon('target'), ' Reference capacity (op-hours)'), capOut)),

    group('run-export', 'Export & backup', 'download', { badge: run.lastExport ? `saved ${fmt.ago(run.lastExport)}` : null },
      h('div', { class: 'export-grid' },
        h('div', { class: 'export' },
          h('h3', {}, icon('grid'), ' Excel workbook'),
          h('p', { class: 'muted small', text: 'Observation Log (template columns A–O), Run Info, Analysis.' }),
          h('div', { class: 'row-gap' },
            h('button', { type: 'button', class: 'btn primary', onclick: () => exportXlsx(false) }, icon('download'), '.xlsx'),
            shareable ? h('button', { type: 'button', class: 'btn ghost', onclick: () => exportXlsx(true) }, icon('share'), 'Share') : null,
            h('button', { type: 'button', class: 'btn ghost', onclick: () => deliverFile(buildCsv(run), `${fileBase()}.csv`, 'text/csv;charset=utf-8') }, icon('download'), '.csv'))),
        h('div', { class: 'export' },
          h('h3', {}, icon('database'), ' Backup'),
          h('p', { class: 'muted small', text: 'A file to merge on another device.' }),
          h('div', { class: 'row-gap' },
            h('button', { type: 'button', class: 'btn ghost', onclick: () => exportJson(false) }, icon('download'), '.json'),
            shareable ? h('button', { type: 'button', class: 'btn ghost', onclick: () => exportJson(true) }, icon('share'), 'Share') : null,
            h('button', { type: 'button', class: 'btn ghost', onclick: importBackup }, icon('upload'), 'Import'))))),

    group('run-manage', 'Delete this run', 'trash', {},
      h('p', { class: 'muted small', text: 'Removes the run and its touches. Other runs are not affected.' }),
      // a run holding anyone else's touches is deleted only by an admin
      run.touches.every(canEditTouch) ? h('button', { type: 'button', class: 'btn danger-ghost', onclick: removeRun }, icon('trash'), `Delete “${run.name}”`)
        : h('p', { class: 'lock-note' }, icon('lock'), ' This run holds touches logged on other devices: only an admin can delete it.')));

  clear(root, h('section', { class: 'runsv' }, history, details));
  paintOps(); paintTime(); paintFrame();
}

/** Mark a run finished (fixing its observation time) and open its summary report. */
export function finishRun(run, { quiet = false } = {}) {
  run.info.finishedAt = new Date().toISOString();
  markRun(run); save();
  if (!quiet) location.hash = `#report?id=${encodeURIComponent(run.id)}`;
  toast(`“${run.name}” finished. It stays in Runs.`);
}
