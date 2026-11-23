// The context form for one touch: used live under the stopwatch, and again to edit a row.
import { CATEGORIES, CAT_BY_CODE, CATEGORY_RULE, DECISION, OTHER_ADVICE, TOUCH_TYPES, typesFor, typeInfo } from './framework.js';
import { perOccurrence, totalMinutes, setPlanned, setCategory, setType, fmtMin, minSec, round, fmtClock } from './model.js';
import { h, clear, icon, openModal, closeModal } from './ui.js';

const parseNum = (s) => {
  if (s == null) return null;
  const v = String(s).trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return isFinite(n) ? n : NaN;
};

/**
 * model: the touch object, mutated in place.
 * opts.lists: { zones, people }
 * opts.live(): live stopwatch seconds (capture) or undefined (edit: uses model.timedSec)
 * opts.onChange(): called after any answer changes
 */
export function touchForm(model, opts) {
  const { lists, onChange = () => {} } = opts;
  const sections = {};
  const changed = (...names) => { names.forEach(n => sections[n]?.render()); clearMissing(); onChange(); };

  function section(key, title, { optional = false, hint = '', extra = null } = {}) {
    const body = h('div', { class: 'q-body' });
    const el = h('fieldset', { class: 'q', 'data-q': key },
      h('legend', { class: 'q-head' },
        h('span', { class: 'q-title', text: title }),
        optional ? h('span', { class: 'q-opt', text: 'optional' }) : null,
        extra),
      hint ? h('p', { class: 'q-hint', text: hint }) : null,
      body);
    return { el, body };
  }

  function chips(list, current, pick, { allowClear = false, cls = '' } = {}) {
    return h('div', { class: 'chips ' + cls, role: 'group' },
      list.map(v => h('button', {
        type: 'button', class: 'chip' + (v === current ? ' on' : ''), 'aria-pressed': String(v === current),
        onclick: () => pick(allowClear && v === current ? '' : v),
      }, v)));
  }

  /* zone */
  {
    const s = section('zone', 'Zone / equipment', { hint: 'Where on the line the touch happened.' });
    s.render = () => {
      const list = [...lists.zones];
      if (model.zone && !list.includes(model.zone)) list.push(model.zone);
      clear(s.body, chips(list, model.zone, v => { model.zone = v; changed('zone'); }));
    };
    sections.zone = s;
  }

  /* who */
  {
    const s = section('who', 'Person observed', { optional: true, hint: 'One row is one touch by one person. Two people on the same job are two rows.' });
    s.render = () => {
      const list = [...lists.people];
      if (model.who && !list.includes(model.who)) list.push(model.who);
      clear(s.body, chips(list, model.who, v => { model.who = v; changed('who'); }, { allowClear: true, cls: 'small' }));
    };
    sections.who = s;
  }

  /* planned */
  {
    const helpBtn = h('button', { type: 'button', class: 'link-btn', onclick: () => openWizard(model, () => changed('planned', 'category', 'type', 'touchType', 'description')) },
      icon('help'), 'Help me choose');
    const s = section('planned', 'Planned / Unplanned', { hint: DECISION.nodes.q1.text + ' Yes = Unplanned.', extra: helpBtn });
    s.render = () => clear(s.body, h('div', { class: 'seg big' },
      ['Planned', 'Unplanned'].map(v => h('button', {
        type: 'button', class: 'seg-btn ' + (v === 'Planned' ? 'p' : 'u') + (model.planned === v ? ' on' : ''), 'aria-pressed': String(model.planned === v),
        onclick: () => { setPlanned(model, v); changed('planned', 'category', 'type', 'touchType'); },
      }, h('span', { class: 'seg-main', text: v }), h('span', { class: 'seg-sub', text: v === 'Planned' ? 'P1 to P8 · on the plan for the shift' : 'U1 to U7 · somebody would call it a problem' })))));
    sections.planned = s;
  }

  /* category */
  {
    const s = section('category', 'Category', { hint: 'The reason decides. Ask in order and stop at the first yes.' });
    s.render = () => {
      const groups = model.planned ? [model.planned === 'Planned'] : [true, false];
      const cat = CAT_BY_CODE[model.category];
      clear(s.body,
        groups.map(isP => h('div', { class: 'cat-group' },
          groups.length > 1 ? h('div', { class: 'cat-group-h', text: isP ? 'Planned' : 'Unplanned' }) : null,
          h('div', { class: 'cats' }, CATEGORIES.filter(c => c.planned === isP).map(c => h('button', {
            type: 'button', class: 'cat' + (c.code === model.category ? ' on' : ''), 'aria-pressed': String(c.code === model.category),
            onclick: () => { setCategory(model, c.code); changed('planned', 'category', 'type', 'touchType'); },
          }, h('span', { class: 'code ' + (c.planned ? 'code-p' : 'code-u'), text: c.code }), h('span', { class: 'cat-name', text: c.short })))))),
        cat ? h('p', { class: 'rule' }, h('strong', { text: cat.code + ' when: ' }), CATEGORY_RULE[cat.code]) : null);
    };
    sections.category = s;
  }

  /* type of touch */
  {
    const s = section('type', 'Type of touch in category');
    s.render = () => {
      const types = typesFor(model.category);
      if (!types.length) { clear(s.body, h('p', { class: 'empty', text: 'Pick a category first.' })); return; }
      const info = typeInfo(model.category, model.type);
      clear(s.body,
        h('div', { class: 'types' }, types.map(t => h('button', {
          type: 'button', class: 'type' + (t.name === model.type ? ' on' : ''), 'aria-pressed': String(t.name === model.type),
          onclick: () => { setType(model, t.name); changed('type', 'touchType'); },
        }, h('span', { class: 'type-name', text: t.name }), h('span', { class: 'tt-tag', text: t.touchType })))),
        info ? h('div', { class: 'guide' }, h('div', { class: 'guide-h' }, icon('info'), 'How to count'), h('p', { text: info.guide })) : null);
    };
    sections.type = s;
  }

  /* touch type */
  {
    const s = section('touchType', 'Touch type', { hint: 'Physical or Information, never both. Physical goes to automation, Information to digitalisation.' });
    s.render = () => {
      const guide = typeInfo(model.category, model.type)?.touchType;
      clear(s.body,
        h('div', { class: 'seg' }, TOUCH_TYPES.map(v => h('button', {
          type: 'button', class: 'seg-btn' + (model.touchType === v ? ' on' : ''), 'aria-pressed': String(model.touchType === v),
          onclick: () => { model.touchType = v; changed('touchType'); },
        }, h('span', { class: 'seg-main', text: v }), h('span', { class: 'seg-sub', text: v === 'Physical' ? 'hands on equipment, material or product' : 'reading, writing, keying, communicating' }),
          guide === v ? h('span', { class: 'seg-flag', text: 'guide' }) : null))),
        guide && model.touchType && guide !== model.touchType
          ? h('p', { class: 'warn-line' }, icon('warn'), `The guide lists this type as ${guide}. Keep ${model.touchType} only if that is what you saw.`) : null);
    };
    sections.touchType = s;
  }

  /* count and duration: built once, values synced, so typing never loses focus */
  const countInput = h('input', { class: 'num', type: 'text', inputmode: 'numeric', 'aria-label': 'Count', autocomplete: 'off' });
  const perInput = h('input', { class: 'num', type: 'text', inputmode: 'decimal', 'aria-label': 'Duration per occurrence in minutes', placeholder: '0', autocomplete: 'off' });
  const perNote = h('span', { class: 'field-note' });
  const autoBtn = h('button', { type: 'button', class: 'link-btn small', onclick: () => { model.durManual = false; sync(); onChange(); } }, icon('reset'), 'Use the timer');
  const totalOut = h('output', { class: 'calc-val' });
  const totalNote = h('span', { class: 'field-note' });
  const coverSeg = h('div', { class: 'seg small' });
  const coverRow = h('div', { class: 'field cover-row' }, h('span', { class: 'field-label', text: 'The timer covers' }), coverSeg);

  const setCount = (n) => {
    model.count = Math.max(1, Math.min(9999, Math.round(n) || 1));
    sync(); clearMissing(); onChange();
  };
  countInput.addEventListener('input', () => {
    const v = parseNum(countInput.value);
    if (v != null && !isNaN(v) && v >= 1) { model.count = Math.min(9999, Math.round(v)); sync(true); onChange(); }
  });
  countInput.addEventListener('blur', () => setCount(parseNum(countInput.value) || model.count || 1));
  perInput.addEventListener('input', () => {
    const v = parseNum(perInput.value);
    model.durManual = true;
    model.perOccMin = v == null || isNaN(v) || v < 0 ? null : v;
    sync(false, true); onChange();
  });

  {
    const s = section('count', 'Count & duration', { hint: 'Repeats: one row, number of occurrences in Count, average minutes per occurrence in Duration.' });
    s.el.querySelector('.q-body').append(
      h('div', { class: 'count-grid' },
        h('div', { class: 'field' },
          h('span', { class: 'field-label', text: 'Count' }),
          h('div', { class: 'stepper' },
            h('button', { type: 'button', class: 'step', 'aria-label': 'One fewer', onclick: () => setCount((Number(model.count) || 1) - 1) }, icon('minus')),
            countInput,
            h('button', { type: 'button', class: 'step', 'aria-label': 'One more', onclick: () => setCount((Number(model.count) || 0) + 1) }, icon('plus')))),
        h('div', { class: 'field' },
          h('span', { class: 'field-label', text: 'Duration per occurrence (min)' }),
          h('div', { class: 'per-wrap' }, perInput, autoBtn),
          perNote),
        h('div', { class: 'field calc' },
          h('span', { class: 'field-label', text: 'Total minutes' }),
          totalOut, totalNote)),
      coverRow);
    s.render = () => sync();
    sections.count = s;
  }

  /* description */
  const desc = h('textarea', { class: 'desc', rows: '3', placeholder: 'Plain words, what they actually did. Which part, which defect, and why it happens if you know.', 'aria-label': 'Task description' });
  desc.addEventListener('input', () => { model.description = desc.value; onChange(); });
  {
    const s = section('description', 'Task description', { optional: true });
    s.body.append(desc);
    s.render = () => { if (desc.value !== (model.description || '')) desc.value = model.description || ''; };
    sections.description = s;
  }

  function timedSec() {
    const live = opts.live?.();
    return live !== undefined ? live : model.timedSec;
  }

  /** Push model values into the count/duration controls. */
  function sync(fromCount = false, fromPer = false) {
    const secs = timedSec();
    const timed = secs != null && secs > 0;
    if (!fromCount && document.activeElement !== countInput) countInput.value = String(model.count ?? 1);
    const probe = { ...model, timedSec: timed ? secs : null };
    const per = perOccurrence(probe);
    const auto = timed && !model.durManual;
    if (!fromPer && (auto || document.activeElement !== perInput)) {
      perInput.value = per == null ? '' : String(round(per, 2));
    }
    perInput.classList.toggle('auto', auto);
    autoBtn.hidden = !(timed && model.durManual);
    perNote.textContent = auto
      ? `From the timer (${fmtClock(secs * 1000, false)}${model.countMode === 'all' && model.count > 1 ? ` ÷ ${model.count}` : ''})`
      : (per != null ? minSec(per) : (timed ? '' : 'Not timed: type it, or leave blank to count only'));
    const total = totalMinutes(probe);
    totalOut.value = fmtMin(total);
    totalNote.textContent = per == null ? 'counted, not timed' : `${model.count || 0} × ${fmtMin(per)} min`;
    coverRow.hidden = !timed || model.durManual;
    clear(coverSeg, [['all', model.count > 1 ? `All ${model.count} occurrences` : 'All occurrences'], ['one', 'One occurrence']].map(([k, label]) => h('button', {
      type: 'button', class: 'seg-btn' + (model.countMode === k ? ' on' : ''), 'aria-pressed': String(model.countMode === k),
      onclick: () => { model.countMode = k; sync(); onChange(); },
    }, label)));
  }

  function clearMissing() {
    for (const [key, s] of Object.entries(sections)) {
      if (!s.el.classList.contains('missing')) continue;
      const answered = key === 'count' ? Number(model.count) >= 1 : !!model[key];
      if (answered) s.el.classList.remove('missing');
    }
  }

  function markMissing(list) {
    for (const [key, s] of Object.entries(sections)) s.el.classList.toggle('missing', list.includes(key));
    const first = list.map(k => sections[k]?.el).find(Boolean);
    first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function refreshAll() { Object.values(sections).forEach(s => s.render()); }

  const order = ['zone', 'who', 'planned', 'category', 'type', 'touchType', 'count', 'description'];
  const el = h('div', { class: 'touch-form' }, order.map(k => sections[k].el));
  refreshAll();
  return { el, sync, refreshAll, markMissing, sections };
}

/* ---------- 'Help me choose': the 15-question category order ---------- */
export function openWizard(model, onPick) {
  const trail = [];
  let node = DECISION.start;
  const box = h('div', { class: 'wizard' });

  const finish = (code) => {
    if (code) setCategory(model, code);
    closeModal();
    onPick?.();
  };

  function render() {
    const q = DECISION.nodes[node];
    clear(box,
      h('div', { class: 'wiz-top' },
        h('h2', { text: 'Which category?' }),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close'))),
      h('p', { class: 'wiz-sub', text: 'The reason decides. Ask in order and stop at the first yes.' }),
      trail.length ? h('ol', { class: 'wiz-trail' }, trail.map(t => h('li', {}, h('span', { text: `${DECISION.nodes[t.node].n}. ` }), DECISION.nodes[t.node].text, h('strong', { text: '  No' })))) : null,
      h('div', { class: 'wiz-q' },
        h('div', { class: 'wiz-n', text: `Question ${q.n}` }),
        h('p', { class: 'wiz-text', text: q.text }),
        q.hint ? h('p', { class: 'q-hint', text: q.hint }) : null,
        h('div', { class: 'row-gap' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => answer(q.yes) }, 'Yes', q.yes.cat ? h('span', { class: 'btn-sub', text: ' → ' + CAT_BY_CODE[q.yes.cat].name }) : null),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => { trail.push({ node }); answer(q.no, true); } }, 'No'))),
      trail.length ? h('button', { type: 'button', class: 'link-btn', onclick: () => { node = trail.pop().node; render(); } }, icon('reset'), 'Back one question') : null);
  }

  function answer(ans, isNo = false) {
    if (ans.cat) return finish(ans.cat);
    if (ans.go) {
      if (!isNo) {
        // Yes on question 1 means unplanned: jump to question 9.
        trail.length = 0;
        model.planned = 'Unplanned';
      } else if (node === 'q1') {
        model.planned = 'Planned';
      }
      node = ans.go; render(); return;
    }
    if (ans.other) {
      clear(box,
        h('div', { class: 'wiz-top' }, h('h2', { text: 'Nothing fits' }),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close'))),
        h('p', { text: OTHER_ADVICE }),
        h('div', { class: 'row-gap' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => {
            if (!/^Other\b/i.test(model.description || '')) model.description = ('Other: ' + (model.description || '')).trim();
            finish(null);
          } }, 'Start the description with “Other:”'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => { trail.length = 0; node = DECISION.start; render(); } }, 'Start again')));
    }
  }

  render();
  openModal(box, { label: 'Which category?' });
}
