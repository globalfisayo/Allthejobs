// Run: Run Info and the reference frame, lists, and getting data in and out.
import { referenceCapacity, mergeTouches } from './model.js';
import { state, save, activeRun, runsList, createRun, deleteRun, nextRunName, storageHealthy } from './store.js';
import { buildWorkbook, buildCsv, buildBackup, parseBackup } from './export.js';
import { demoTouches } from './demo.js';
import { h, clear, icon, toast, deliverFile, pickFile, canShareFiles, confirmBox, openModal, closeModal, fmt, stamp, slug } from './ui.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function renderRun(root, { onChange } = {}) {
  const run = activeRun();
  const info = run.info;
  const rerender = () => { renderRun(root, { onChange }); onChange?.(); };

  const field = (key, label, { type = 'text', hint = '', inputmode, step, min } = {}) => {
    const input = h('input', { type, value: info[key] ?? '', inputmode, step, min, id: 'ri-' + key, autocomplete: 'off' });
    input.addEventListener('input', () => {
      info[key] = type === 'number' ? (input.value === '' ? '' : Number(input.value.replace(',', '.'))) : input.value;
      save(); paintCapacity();
    });
    return h('label', { class: 'f', for: 'ri-' + key }, h('span', { class: 'f-label', text: label }), input, hint ? h('span', { class: 'f-hint', text: hint }) : null);
  };

  const availOut = h('output', { class: 'calc-val' });
  const capOut = h('output', { class: 'calc-val big' });
  function paintCapacity() {
    const { available, capacity } = referenceCapacity(info);
    availOut.value = fmt.dec(available, 1);
    capOut.value = fmt.dec(capacity, 1);
  }

  const observer = h('input', { type: 'text', value: state.observer, id: 'observer', placeholder: 'Your name or initials', autocomplete: 'off' });
  observer.addEventListener('input', () => { state.observer = observer.value.trim(); save(); });

  const listBox = (key, label, hint) => {
    const ta = h('textarea', { rows: '8', id: 'list-' + key, spellcheck: 'false' });
    ta.value = state.lists[key].join('\n');
    ta.addEventListener('change', () => {
      const items = [...new Set(ta.value.split('\n').map(s => s.trim()).filter(Boolean))];
      if (!items.length) { toast('A list needs at least one entry.', { tone: 'bad' }); ta.value = state.lists[key].join('\n'); return; }
      state.lists[key] = items; save(); toast(`${label} updated.`);
    });
    return h('label', { class: 'f', for: 'list-' + key }, h('span', { class: 'f-label', text: label }), ta, h('span', { class: 'f-hint', text: hint }));
  };

  const runSelect = h('select', { id: 'run-select', 'aria-label': 'Active run' },
    runsList().map(r => h('option', { value: r.id, selected: r.id === run.id, text: `${r.name} (${r.touches.length})` })));
  runSelect.addEventListener('change', () => { state.activeRunId = runSelect.value; save(); rerender(); });

  const nameInput = h('input', { type: 'text', value: run.name, id: 'run-name', autocomplete: 'off' });
  nameInput.addEventListener('change', () => { run.name = nameInput.value.trim() || run.name; save(); rerender(); });

  const shareable = canShareFiles();
  const fileBase = () => `${slug(run.name)}-${stamp()}`;
  const exportXlsx = async (share) => {
    const bytes = buildWorkbook(run, state.lists);
    const ok = await deliverFile(bytes, `${fileBase()}.xlsx`, XLSX_MIME, { share });
    if (ok) { run.lastExport = new Date().toISOString(); save(); rerender(); }
  };
  const exportCsv = () => deliverFile(buildCsv(run), `${fileBase()}.csv`, 'text/csv;charset=utf-8');
  const exportJson = async (share) => {
    const ok = await deliverFile(buildBackup(run, state.lists), `${fileBase()}.touchmap.json`, 'application/json', { share });
    if (ok) { run.lastExport = new Date().toISOString(); save(); rerender(); }
  };

  async function importBackup() {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    let data;
    try { data = parseBackup(await file.text()); } catch (e) { toast(e.message, { tone: 'bad' }); return; }
    const same = data.run.id && state.runs[data.run.id];
    openModal(h('div', { class: 'confirm' },
      h('h2', { text: 'Import a backup' }),
      h('p', { text: `“${data.run.name}”: ${data.run.touches.length} touches.` }),
      h('p', { class: 'muted', text: 'Merging adds touches you do not have yet. A touch that exists on both sides keeps the most recent edit. Nothing is deleted.' }),
      h('div', { class: 'stack' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => doMerge(same ? state.runs[data.run.id] : run, data) },
          same ? `Merge into “${state.runs[data.run.id].name}” (same run)` : `Merge into the current run, “${run.name}”`),
        !same ? h('button', { type: 'button', class: 'btn ghost', onclick: () => {
          const r = createRun(data.run.name, { ...data.run.info });
          r.touches = data.run.touches; save(); closeModal(); toast(`Imported as a new run with ${r.touches.length} touches.`); rerender();
        } }, 'Add as a separate run') : null,
        h('button', { type: 'button', class: 'btn ghost', onclick: () => closeModal() }, 'Cancel'))),
    { label: 'Import a backup' });
  }

  function doMerge(target, data) {
    const m = mergeTouches(target.touches, data.run.touches);
    target.touches = m.touches;
    state.activeRunId = target.id;
    save(); closeModal();
    toast(`Merged: ${m.added} new, ${m.updated} updated.`);
    rerender();
  }

  async function newRun() {
    createRun(nextRunName());
    toast('New run started. Run Info carried over; dates and SKUs cleared.');
    rerender();
  }

  async function removeRun() {
    const ok = await confirmBox({ title: `Delete “${run.name}”?`, body: `This removes the run and its ${run.touches.length} touches from this device. Export a backup first if you might need them.`, ok: 'Delete run', danger: true });
    if (!ok) return;
    deleteRun(run.id); toast('Run deleted.'); rerender();
  }

  function loadDemo() {
    const r = createRun('Demo shift (sample data)', { ...run.info, skus: 'Demo: 2 L to 0.5 L', changeovers: '1', cips: '1', observers: 'Demo' });
    r.touches = demoTouches(); save();
    toast('Demo run loaded. Open Analysis to see it.', { action: { label: 'Analysis', fn: () => { location.hash = '#analysis'; } } });
    rerender();
  }

  const backupAge = run.lastExport ? fmt.ago(run.lastExport) : 'never';
  const stale = run.touches.length && (!run.lastExport || Date.now() - Date.parse(run.lastExport) > 8 * 3600e3);

  clear(root, h('section', { class: 'runv' },
    h('div', { class: 'view-head' }, h('div', {},
      h('h1', { class: 'view-title', text: 'Run' }),
      h('p', { class: 'view-sub', text: 'Fill this in before observing. It sets the reference frame every mapped total is compared against.' }))),

    !storageHealthy() ? h('div', { class: 'banner bad' }, icon('warn'), 'This browser is refusing to save. Private browsing? Export now and switch to a normal window.') : null,

    h('div', { class: 'grid-2' },
      h('section', { class: 'card' },
        h('h2', { class: 'card-h', text: 'Observation run' }),
        h('div', { class: 'f-row' },
          h('label', { class: 'f grow', for: 'run-select' }, h('span', { class: 'f-label', text: 'Active run' }), runSelect),
          h('button', { type: 'button', class: 'btn ghost', onclick: newRun }, icon('plus'), 'New run')),
        h('label', { class: 'f', for: 'run-name' }, h('span', { class: 'f-label', text: 'Run name' }), nameInput),
        h('label', { class: 'f', for: 'observer' }, h('span', { class: 'f-label', text: 'Observer on this device' }), observer,
          h('span', { class: 'f-hint', text: 'Stamped on every touch you log, so merged files still show who observed what.' })),
        h('div', { class: 'f-grid' },
          field('line', 'Line'), field('plant', 'Plant'),
          field('from', 'Observation window (from)', { type: 'date' }), field('to', 'Observation window (to)', { type: 'date' })),
        field('skus', 'Formats / SKUs observed', { hint: 'e.g. Coca-Cola 2 L, Fanta 0.5 L' }),
        h('div', { class: 'f-grid' },
          field('changeovers', 'Changeovers included', { inputmode: 'numeric', hint: 'format changes mapped' }),
          field('cips', 'CIPs included', { inputmode: 'numeric', hint: 'CIP cycles mapped' })),
        field('observers', 'Observers', { hint: 'names' })),

      h('section', { class: 'card' },
        h('h2', { class: 'card-h', text: 'Reference frame' }),
        h('div', { class: 'f-grid' },
          field('operators', 'Operators on the line per shift', { type: 'number', inputmode: 'decimal', min: '0', step: '1', hint: 'the crew whose work is being mapped' }),
          field('shiftHours', 'Shift length (hours)', { type: 'number', inputmode: 'decimal', min: '0', step: '0.5' }),
          field('breakHours', 'Break / non-available time per operator (hours)', { type: 'number', inputmode: 'decimal', min: '0', step: '0.25', hint: 'adjust to the local agreement' }),
          field('shifts', 'Shifts covered by this map', { type: 'number', inputmode: 'numeric', min: '1', step: '1', hint: '1 = one shift, as in the template' })),
        h('div', { class: 'calc-row' }, h('span', { text: 'Available activity per operator (hours)' }), availOut),
        h('div', { class: 'calc-row big' }, h('span', { text: 'Reference capacity (operator-hours)' }), capOut),
        h('p', { class: 'card-note', text: 'Operators × available hours × shifts. Yellow = calculated.' }))),

    h('section', { class: 'card' },
      h('h2', { class: 'card-h', text: 'Export & backup' }),
      h('p', { class: stale ? 'warn-line' : 'muted' }, stale ? icon('warn') : null,
        `Touches live on this device only. Last export of this run: ${backupAge}.` + (stale ? ' Export at the end of each shift.' : '')),
      h('div', { class: 'export-grid' },
        h('div', { class: 'export' },
          h('h3', { text: 'Excel workbook' }),
          h('p', { class: 'muted', text: 'Observation Log (columns A–O as in the template), Run Info and Analysis. Rows paste straight into the K3 template.' }),
          h('div', { class: 'row-gap' },
            h('button', { type: 'button', class: 'btn primary', onclick: () => exportXlsx(false) }, icon('download'), 'Download .xlsx'),
            shareable ? h('button', { type: 'button', class: 'btn ghost', onclick: () => exportXlsx(true) }, icon('share'), 'Share…') : null)),
        h('div', { class: 'export' },
          h('h3', { text: 'Team backup' }),
          h('p', { class: 'muted', text: 'One file per observer. Import on one device to merge everyone into a single log.' }),
          h('div', { class: 'row-gap' },
            h('button', { type: 'button', class: 'btn ghost', onclick: () => exportJson(false) }, icon('download'), 'Backup .json'),
            shareable ? h('button', { type: 'button', class: 'btn ghost', onclick: () => exportJson(true) }, icon('share'), 'Share…') : null,
            h('button', { type: 'button', class: 'btn ghost', onclick: importBackup }, icon('upload'), 'Import / merge'))),
        h('div', { class: 'export' },
          h('h3', { text: 'CSV' }),
          h('p', { class: 'muted', text: 'Same columns as plain text, for other tools. Prefer .xlsx for Excel: an Excel set to a decimal-comma locale misreads CSV numbers.' }),
          h('button', { type: 'button', class: 'btn ghost', onclick: exportCsv }, icon('download'), 'Download .csv')))),

    h('section', { class: 'card' },
      h('h2', { class: 'card-h', text: 'Lists' }),
      h('p', { class: 'muted', text: 'One entry per line. Changes apply to the drop-downs on Capture; touches already logged keep their values.' }),
      h('div', { class: 'grid-2 tight' },
        listBox('zones', 'Zone / equipment', 'From the template. Replace with the line’s equipment list when you have it.'),
        listBox('people', 'Person observed', 'Optional field on Capture.'))),

    h('section', { class: 'card' },
      h('h2', { class: 'card-h', text: 'Try it, or start over' }),
      h('div', { class: 'row-gap' },
        h('button', { type: 'button', class: 'btn ghost', onclick: loadDemo }, icon('chart'), 'Load a demo run'),
        h('button', { type: 'button', class: 'btn danger-ghost', onclick: removeRun }, icon('trash'), `Delete “${run.name}”`)),
      h('p', { class: 'muted', text: 'The demo opens as its own run, so it never mixes with real observations. Delete it when you are done.' }))));

  paintCapacity();
}
