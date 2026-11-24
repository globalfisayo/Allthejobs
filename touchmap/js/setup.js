// Setup: the touch framework (add, edit, hide, reset), zones and people, Team sync, device data.
// The shipped framework stays the default; edits are shared with the team through sync.
import { CATEGORIES, CAT_BY_CODE, TOUCH_TYPES, applyFramework, isCustomFramework, nextCategoryCode, sortCategories } from './framework.js';
import { state, save, createRun, markSetup, markTouch, runsList } from './store.js';
import { demoTouches } from './demo.js';
import { syncCard } from './sync-ui.js';
import { ZONE_KEYS } from './linemap.js';
import { h, clear, icon, toast, openModal, closeModal, confirmBox, deliverFile, pickFile, fmt, stamp, group, pickIcon } from './ui.js';
import { zoneIcon, personIcon, categoryIcon, recommendIcon, CATEGORY_ICONS } from './iconmap.js';
import { DEFAULT_COLORS, SWATCHES, applyColors, resolveColors, textOn } from './colors.js';
import { session } from './auth.js';
import { logOut } from './usermenu.js';

/** Change the framework in use, save it as the team's custom framework, and share it. */
export function editFramework(mutate) {
  const cats = JSON.parse(JSON.stringify(CATEGORIES));
  mutate(cats);
  state.framework = { categories: sortCategories(cats) };
  applyFramework(state.framework);
  markSetup();
}

/** How many logged touches use a category (and type), across every run on this device. */
export function usage(code, typeName) {
  let n = 0;
  for (const r of runsList()) for (const t of r.touches) if (t.category === code && (typeName == null || t.type === typeName)) n++;
  return n;
}

export function typeEditor(code, existing, rerender, { zones: presetZones = [] } = {}) {
  const cat = CAT_BY_CODE[code];
  const model = existing ? { ...existing, zones: [...(existing.zones || [])] } : { name: '', touchType: 'Physical', guide: '', zones: [...presetZones], everywhere: false, hidden: false, custom: true };
  const name = h('input', { type: 'text', value: model.name, id: 'te-name', autocomplete: 'off', placeholder: 'e.g. Robot gripper change' });
  const guide = h('textarea', { rows: '4', id: 'te-guide', placeholder: 'How to count it: what is 1 touch, what belongs in another category.' });
  guide.value = model.guide || '';
  const ttSeg = h('div', { class: 'seg' });
  const zonesBox = h('div', { class: 'chips' });
  const hidden = h('input', { type: 'checkbox', checked: !!model.hidden, id: 'te-hidden' });
  const everywhere = h('input', { type: 'checkbox', checked: !!model.everywhere, id: 'te-every' });
  const paint = () => {
    clear(ttSeg, TOUCH_TYPES.map(v => h('button', { type: 'button', class: 'seg-btn' + (model.touchType === v ? ' on' : ''), 'aria-pressed': String(model.touchType === v), onclick: () => { model.touchType = v; paint(); } },
      h('span', { class: 'seg-main' }, icon(v === 'Physical' ? 'hand' : 'edit'), ' ', v))));
    const zones = [...new Set([...ZONE_KEYS, ...state.lists.zones])];
    clear(zonesBox, zones.map(z => h('button', { type: 'button', class: 'chip small' + (model.zones.includes(z) ? ' on' : ''), 'aria-pressed': String(model.zones.includes(z)),
      onclick: () => { model.zones = model.zones.includes(z) ? model.zones.filter(x => x !== z) : [...model.zones, z]; paint(); } }, z)));
  };
  paint();
  const used = existing ? usage(code, existing.name) : 0;
  const doSave = () => {
    const n = name.value.trim();
    if (!n) { toast('Give the touch type a name.', { tone: 'bad' }); return; }
    if (cat.types.some(t => t.name.toLowerCase() === n.toLowerCase() && t !== existing)) { toast(`${code} already has “${n}”.`, { tone: 'bad' }); return; }
    const oldName = existing?.name;
    editFramework(cats => {
      const c = cats.find(x => x.code === code);
      const next = { ...model, name: n, guide: guide.value.trim(), hidden: hidden.checked, everywhere: everywhere.checked };
      if (existing) c.types[c.types.findIndex(t => t.name === oldName)] = next;
      else c.types.push(next);
    });
    // Renaming keeps logged touches attached to the type.
    if (existing && oldName !== n) {
      for (const r of runsList()) for (const t of r.touches) {
        if (t.category === code && t.type === oldName) { t.type = n; t.updatedAt = new Date().toISOString(); markTouch(r, t.id); }
      }
      save();
    }
    closeModal(); toast(existing ? 'Touch type updated.' : `Added “${n}” to ${code}.`); rerender();
  };
  const doDelete = async () => {
    closeModal();
    const ok = await confirmBox({ title: `Delete “${existing.name}”?`, body: 'It was added in Setup and has no logged touches.', ok: 'Delete', danger: true });
    if (!ok) return;
    editFramework(cats => { const c = cats.find(x => x.code === code); c.types = c.types.filter(t => t.name !== existing.name); });
    toast('Touch type deleted.'); rerender();
  };
  openModal(h('div', { class: 'confirm editor-form' },
    h('div', { class: 'wiz-top' },
      h('h2', {}, h('span', { class: 'code ' + (cat.planned ? 'code-p' : 'code-u'), text: code }), ' ', existing ? 'Edit touch type' : 'New touch type'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close'))),
    h('p', { class: 'muted small', text: cat.name }),
    h('label', { class: 'f', for: 'te-name' }, h('span', { class: 'f-label', text: 'Name' }), name),
    h('div', { class: 'f' }, h('span', { class: 'f-label', text: 'Touch type' }), ttSeg),
    h('label', { class: 'f', for: 'te-guide' }, h('span', { class: 'f-label', text: 'How to count' }), guide),
    h('div', { class: 'f' }, h('span', { class: 'f-label' }, icon('pin'), ' Where it happens (shown on the Guide map)'), zonesBox),
    h('label', { class: 'check-row', for: 'te-every' }, everywhere, icon('grid'), 'Can happen on any machine'),
    h('label', { class: 'check-row', for: 'te-hidden' }, hidden, icon('eyeOff'), 'Hide from Capture (logged touches keep it)'),
    used ? h('p', { class: 'muted small' }, icon('info'), ` ${used} logged ${used === 1 ? 'touch uses' : 'touches use'} this type; renaming updates them.`) : null,
    h('div', { class: 'row-end' },
      existing?.custom && !used ? h('button', { type: 'button', class: 'btn danger-ghost', onclick: doDelete }, icon('trash'), 'Delete') : null,
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => closeModal() }, 'Cancel'),
      h('button', { type: 'button', class: 'btn primary', onclick: doSave }, icon('check'), 'Save'))),
  { label: 'Touch type', wide: true });
  setTimeout(() => name.focus(), 50);
}

function categoryEditor(planned, existing, rerender) {
  const code = existing ? existing.code : nextCategoryCode(planned);
  const name = h('input', { type: 'text', value: existing ? existing.short : '', id: 'ce-name', autocomplete: 'off', placeholder: planned ? 'e.g. New filler area routines' : 'e.g. Robot faults' });
  const rule = h('textarea', { rows: '3', id: 'ce-rule', placeholder: 'When does a touch belong here? One sentence.' });
  rule.value = existing?.rule || '';
  const hidden = h('input', { type: 'checkbox', checked: !!existing?.hidden, id: 'ce-hidden' });
  // an icon: the category's own, else one suggested from its name as it is typed
  let chosen = existing?.icon || '';
  const suggest = () => (existing && !existing.icon && CATEGORY_ICONS[code]) || recommendIcon(name.value, planned ? 'calendar-check' : 'circle-exclamation-point');
  const icoView = h('span', { class: 'ce-ico' });
  const icoNote = h('span', { class: 'muted small' });
  const paintIco = () => { clear(icoView, icon(chosen || suggest())); icoNote.textContent = chosen ? 'Your choice' : 'Suggested from the name'; };
  name.addEventListener('input', () => { if (!chosen) paintIco(); });
  const icoBtn = h('button', { type: 'button', class: 'btn ghost small', onclick: async () => {
    const pick = await pickIcon({ title: `Icon for ${code}`, current: chosen || suggest(), suggested: suggest() });
    if (pick) { chosen = pick; paintIco(); }
  } }, icon('shapes'), 'Change');
  paintIco();
  const doSave = () => {
    const n = name.value.trim();
    if (!n) { toast('Give the category a name.', { tone: 'bad' }); return; }
    editFramework(cats => {
      const full = `${code}: ${n}`;
      if (existing) {
        const c = cats.find(x => x.code === code);
        c.name = full; c.short = n; c.hidden = hidden.checked;
        if (rule.value.trim()) c.rule = rule.value.trim(); else delete c.rule;
        if (chosen) c.icon = chosen;
      } else {
        cats.push({ code, name: full, short: n, planned, custom: true, hidden: hidden.checked, rule: rule.value.trim() || undefined, icon: chosen || suggest(), types: [] });
      }
    });
    closeModal(); toast(existing ? 'Category updated.' : `Added ${code}. Now add its touch types.`); rerender();
  };
  openModal(h('div', { class: 'confirm editor-form' },
    h('div', { class: 'wiz-top' },
      h('h2', {}, h('span', { class: 'code ' + (planned ? 'code-p' : 'code-u'), text: code }), ' ', existing ? 'Edit category' : `New ${planned ? 'planned' : 'unplanned'} category`),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close'))),
    h('label', { class: 'f', for: 'ce-name' }, h('span', { class: 'f-label', text: 'Name' }), name),
    h('label', { class: 'f', for: 'ce-rule' }, h('span', { class: 'f-label', text: 'When it applies' }), rule),
    h('div', { class: 'f' }, h('span', { class: 'f-label', text: 'Icon' }), h('div', { class: 'ce-ico-row' }, icoView, icoNote, icoBtn)),
    h('label', { class: 'check-row', for: 'ce-hidden' }, hidden, icon('eyeOff'), 'Hide from Capture'),
    !existing ? h('p', { class: 'muted small' }, icon('info'), ' New categories are not in the “Help me choose” questions; pick them directly.') : null,
    h('div', { class: 'row-end' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => closeModal() }, 'Cancel'),
      h('button', { type: 'button', class: 'btn primary', onclick: doSave }, icon('check'), 'Save'))),
  { label: 'Category' });
  setTimeout(() => name.focus(), 50);
}

function chipList(key, label, placeholder) {
  const box = h('div');
  const paint = () => {
    const items = state.lists[key];
    const add = h('input', { type: 'text', placeholder, autocomplete: 'off', 'aria-label': `Add to ${label}` });
    const doAdd = () => {
      const v = add.value.trim();
      if (!v) return;
      if (items.includes(v)) { toast(`“${v}” is already there.`); return; }
      state.lists[key] = [...items, v]; markSetup(); paint(); box.querySelector('input')?.focus();
    };
    add.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
    clear(box,
      h('div', { class: 'chips' }, items.map(v => h('span', { class: 'chip removable with-ico' },
        key === 'zones' ? h('button', { type: 'button', class: 'chip-ico', title: `Change the icon for ${v}`, 'aria-label': `Change the icon for ${v}`, onclick: async () => {
          const pick = await pickIcon({ title: `Icon for ${v}`, current: zoneIcon(v), suggested: recommendIcon(v, 'map-pin') });
          if (!pick) return;
          state.icons = { ...(state.icons || {}), zones: { ...(state.icons?.zones || {}), [v]: pick } };
          markSetup(); paint();
        } }, icon(zoneIcon(v))) : icon(personIcon(v)),
        v,
        items.length > 1 ? h('button', { type: 'button', class: 'chip-x', 'aria-label': `Remove ${v}`, onclick: () => { state.lists[key] = items.filter(x => x !== v); markSetup(); paint(); } }, icon('close')) : null))),
      h('div', { class: 'add-row' }, add, h('button', { type: 'button', class: 'btn ghost', onclick: doAdd }, icon('plus'), 'Add')));
  };
  paint();
  return box;
}

export function renderSetup(root, { onChange } = {}) {
  const rerender = () => { const y = window.scrollY; renderSetup(root, { onChange }); window.scrollTo(0, y); onChange?.(); };
  const custom = isCustomFramework();

  const catBlock = (planned) => h('div', { class: 'fw-block' },
    h('h3', { class: 'fw-h' }, h('span', { class: 'swatch', style: { background: planned ? 'var(--c-planned)' : 'var(--c-unplanned)' } }), planned ? 'Planned (P)' : 'Unplanned (U)'),
    CATEGORIES.filter(c => c.planned === planned).map(c => h('details', { class: 'fw-cat' + (c.hidden ? ' is-hidden' : '') },
      h('summary', {},
        h('span', { class: 'code ' + (planned ? 'code-p' : 'code-u'), text: c.code }),
        h('span', { class: 'cat-ico' }, icon(categoryIcon(c.code))),
        h('span', { class: 'fw-name', text: c.short }),
        c.custom ? h('span', { class: 'pill new' }, 'added') : null,
        c.hidden ? h('span', { class: 'pill off' }, icon('eyeOff'), 'hidden') : null,
        h('span', { class: 'muted small', text: `${c.types.filter(t => !t.hidden).length}/${c.types.length}` }),
        icon('chevron', 'grp-chev')),
      h('ul', { class: 'fw-types' }, c.types.map(t => h('li', { class: t.hidden ? 'is-hidden' : '' },
        h('span', { class: 'fw-tname', text: t.name }),
        t.custom ? h('span', { class: 'pill new' }, 'added') : null,
        h('span', { class: 'tt-tag', text: t.touchType }),
        h('button', { type: 'button', class: 'icon-btn small', 'aria-label': t.hidden ? `Show ${t.name}` : `Hide ${t.name}`, title: t.hidden ? 'Show on Capture' : 'Hide from Capture',
          onclick: () => { editFramework(cats => { const x = cats.find(k => k.code === c.code).types.find(k => k.name === t.name); x.hidden = !x.hidden; }); rerender(); } }, icon(t.hidden ? 'eyeOff' : 'eye')),
        h('button', { type: 'button', class: 'icon-btn small', 'aria-label': `Edit ${t.name}`, title: 'Edit', onclick: () => typeEditor(c.code, t, rerender) }, icon('edit'))))),
      h('div', { class: 'row-gap fw-actions' },
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => typeEditor(c.code, null, rerender) }, icon('plus'), 'Add a touch type'),
        h('button', { type: 'button', class: 'btn ghost small', onclick: () => categoryEditor(planned, c, rerender) }, icon('edit'), 'Edit category')))),
    h('button', { type: 'button', class: 'btn ghost small fw-addcat', onclick: () => categoryEditor(planned, null, rerender) }, icon('plus'), `Add a ${planned ? 'planned' : 'unplanned'} category`));

  const observer = h('input', { type: 'text', value: state.observer, id: 'observer', placeholder: 'Your name or initials', autocomplete: 'off' });
  observer.addEventListener('input', () => { state.observer = observer.value.trim(); save(); });

  async function resetFramework() {
    const ok = await confirmBox({ title: 'Reset the touches to the default?', body: 'Added categories and types are removed and edits undone; touches already logged keep their values.', ok: 'Reset', danger: true });
    if (!ok) return;
    state.framework = null; applyFramework(null); markSetup();
    toast('Touches reset to the default framework.'); rerender();
  }
  const exportSetup = () => deliverFile(JSON.stringify({ app: 'touchmap-setup', format: 1, exportedAt: new Date().toISOString(), framework: state.framework, lists: state.lists }, null, 1), `touchmap-setup-${stamp()}.json`, 'application/json');
  async function importSetup() {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    let d;
    try { d = JSON.parse(await file.text()); } catch { toast('That file is not valid JSON.', { tone: 'bad' }); return; }
    if (d?.app !== 'touchmap-setup' || (d.framework !== null && !Array.isArray(d.framework?.categories))) { toast('That file is not a Touch Map setup.', { tone: 'bad' }); return; }
    const ok = await confirmBox({ title: 'Use this setup?', body: 'It replaces the touches, zones and people on this device (and the team’s, with Team sync).', ok: 'Use it' });
    if (!ok) return;
    state.framework = d.framework; applyFramework(state.framework);
    if (Array.isArray(d.lists?.zones) && Array.isArray(d.lists?.people)) state.lists = { zones: d.lists.zones.filter(x => typeof x === 'string'), people: d.lists.people.filter(x => typeof x === 'string') };
    markSetup(); toast('Setup imported.'); rerender();
  }
  function loadDemo() {
    const cur = state.runs[state.activeRunId];
    const r = createRun('Demo shift (sample data)', { ...cur.info, skus: 'Demo: 2 L to 0.5 L', changeovers: '1', cips: '1', observers: 'Demo', operatorNames: ['Ana', 'Mihai', 'Elena', 'Radu'] }, { localOnly: true });
    r.touches = demoTouches(undefined, state.deviceId); save();
    toast('Demo run loaded, on this device only.', { action: { label: 'Analysis', fn: () => { location.hash = '#analysis'; } } });
    onChange?.();
  }

  /* ---------- colours ---------- */
  const setColour = (key, value, zone) => {
    const c = resolveColors(state.colors);
    if (zone) { if (value) c.zones[zone] = value; else delete c.zones[zone]; } else c[key] = value;
    state.colors = c; applyColors(c); markSetup();
  };
  const colourRow = (label, key, zone) => {
    const cur = zone ? (resolveColors(state.colors).zones[zone] || '') : resolveColors(state.colors)[key];
    const input = h('input', { type: 'color', value: cur || '#cccccc', 'aria-label': `${label} colour` });
    const preview = h('span', { class: 'col-preview', style: { background: cur || 'transparent', color: cur ? textOn(cur) : 'var(--ink-3)' }, text: cur ? (zone ? '' : (key === 'planned' ? 'P1' : key === 'unplanned' ? 'U1' : 'Aa')) : 'none' });
    const paint = (v) => { preview.style.background = v || 'transparent'; preview.style.color = v ? textOn(v) : 'var(--ink-3)'; if (zone) preview.textContent = v ? '' : 'none'; };
    input.addEventListener('input', () => { paint(input.value); setColour(key, input.value, zone); });
    return h('div', { class: 'col-row' },
      preview,
      h('span', { class: 'col-label', text: label }),
      h('div', { class: 'col-swatches' }, SWATCHES.slice(0, zone ? 8 : 12).map(sw => h('button', {
        type: 'button', class: 'sw-dot' + (sw.toLowerCase() === String(cur).toLowerCase() ? ' on' : ''), style: { background: sw }, 'aria-label': `Use ${sw}`,
        onclick: () => { input.value = sw; paint(sw); setColour(key, sw, zone); rerender(); },
      }))),
      h('label', { class: 'col-custom', title: 'Any colour' }, icon('sliders'), input),
      zone && cur ? h('button', { type: 'button', class: 'icon-btn small', 'aria-label': `Clear ${label} colour`, onclick: () => { setColour(key, '', zone); rerender(); } }, icon('close')) : null);
  };
  const customColours = JSON.stringify(resolveColors(state.colors)) !== JSON.stringify(resolveColors(null));

  const oldScript = state.sync.url && state.sync.serverV === 1;
  const admin = session()?.role === 'admin';

  clear(root, h('section', { class: 'setupv' },
    h('div', { class: 'view-head' }, h('div', {},
      h('h1', { class: 'view-title' }, icon('gear', 'title-ico'), 'Setup'),
      h('p', { class: 'view-sub', text: 'Touches, zones and people for the whole team; sync and data for this device.' }))),

    profileGroup(),

    // the touch framework, colours, zones and people are the team's: an admin changes them
    !admin ? h('div', { class: 'card admin-only' }, h('span', { class: 'pf-ico' }, icon('lock')),
      h('div', {}, h('strong', { text: 'Touch types, colours, zones and people are set by your admin.' }),
        h('p', { class: 'muted small', text: 'You can log touches, edit or delete the ones you logged, and see everyone’s. Ask an admin to add a touch type or an area.' }))) : null,

    !admin ? null : group('setup-touches', 'Touch types', 'layers', { open: true, badge: custom ? 'customised' : 'default' },
      h('div', { class: 'row-gap fw-status' },
        h('span', { class: 'pill ' + (custom ? 'new' : 'ok') }, icon(custom ? 'edit' : 'check'), custom ? `Customised ${state.setupUpdatedAt ? fmt.ago(state.setupUpdatedAt) : ''}` : 'Default (the K3 template)'),
        custom ? h('button', { type: 'button', class: 'btn ghost small', onclick: resetFramework }, icon('reset'), 'Reset to default') : null),
      oldScript && state.sync.dirtySetup ? h('p', { class: 'warn-line' }, icon('warn'), 'Your sync script is the older version, so these changes stay on this device. In Apps Script, paste the new script and deploy a new version.') : null,
      h('div', { class: 'fw-grid' }, catBlock(true), catBlock(false))),

    !admin ? null : group('setup-colours', 'Colours', 'sliders', { badge: customColours ? 'customised' : 'default' },
      h('div', { class: 'col-list' },
        colourRow('Planned', 'planned'), colourRow('Unplanned', 'unplanned'),
        colourRow('Physical', 'physical'), colourRow('Information', 'information')),
      h('h3', { class: 'fw-h' }, icon('pin'), ' Equipment / zones'),
      h('p', { class: 'muted small', text: 'Optional: colours the zone bars in Analysis and the zones on the Guide diagram.' }),
      h('div', { class: 'col-list' }, state.lists.zones.map(z => colourRow(z, null, z))),
      customColours ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => { state.colors = null; applyColors(null); markSetup(); rerender(); } }, icon('reset'), 'Default colours') : null),

    !admin ? null : group('setup-zones', 'Zones / areas', 'pin', { badge: state.lists.zones.length },
      h('p', { class: 'muted small', text: 'Add a newly installed area here; it appears on Capture and under the Guide map.' }),
      chipList('zones', 'zones', 'New zone, e.g. Robot palletiser')),

    !admin ? null : group('setup-people', 'People & roles', 'users', { badge: state.lists.people.length },
      h('p', { class: 'muted small', text: 'Roles offered on Capture. Operator names are added per run, in Runs.' }),
      chipList('people', 'people', 'New role, e.g. Line technician')),

    group('setup-sync', 'Team sync', 'cloud', { open: !state.sync.url, badge: state.sync.url ? 'on' : 'off' }, syncCard({ bare: true })),

    group('setup-device', 'This device', 'database', {},
      h('label', { class: 'f', for: 'observer' }, h('span', { class: 'f-label' }, icon('eye'), ' Observer on this device'), observer),
      h('div', { class: 'row-gap' },
        h('button', { type: 'button', class: 'btn ghost', onclick: loadDemo }, icon('chart'), 'Load a demo run'),
        h('button', { type: 'button', class: 'btn ghost', onclick: exportSetup }, icon('download'), 'Export setup'),
        admin ? h('button', { type: 'button', class: 'btn ghost', onclick: importSetup }, icon('upload'), 'Import setup') : null),
      h('p', { class: 'muted small', text: 'The demo run stays on this device and never reaches the team sheet.' }))));
}

/** Who is signed in on this device, where they map, and sign out. */
function profileGroup() {
  const p = state.profile;
  const admin = session()?.role === 'admin';
  const fact = (ico, label, value) => h('div', { class: 'pf-fact' }, h('span', { class: 'pf-ico' }, icon(ico)), h('span', {}, h('span', { class: 'muted small', text: label }), h('strong', { text: value || '–' })));
  const out = () => logOut();
  return group('setup-profile', 'Your profile', 'user', { open: true, badge: admin ? 'admin' : null },
    h('div', { class: 'pf-facts' },
      fact('user', 'Name', p?.name),
      fact('globe', 'Business unit', p?.buName),
      fact('factory', 'Plant', p?.plantName),
      fact('line', 'Production line', p?.lineName)),
    h('div', { class: 'row-gap' },
      h('a', { class: 'btn ghost', href: '#welcome' }, icon('edit'), p ? 'Change plant, line or name' : 'Set up your profile'),
      admin ? h('a', { class: 'btn ghost', href: '#admin' }, icon('shield'), 'Admin: all plants') : null,
      h('button', { type: 'button', class: 'btn ghost', onclick: out }, icon('logout'), 'Log out')));
}
