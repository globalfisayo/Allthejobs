// Sign-in, then a short step-by-step profile: business unit → plant → production line → name.
// Each finished step folds into a one-line summary; the next one opens below it.
import { state, save, activeRun } from './store.js';
import { signIn, signOut, isAdmin } from './auth.js';
import { ORG, unitById, plantById } from './org.js';
import { h, clear, icon, toast } from './ui.js';

const AFTER = 'touchmap:after-login';

function brandMark() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48'); svg.setAttribute('class', 'gate-mark'); svg.setAttribute('aria-hidden', 'true');
  const add = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); svg.append(el); };
  add('rect', { width: 48, height: 48, rx: 12, fill: '#F40009' });
  add('circle', { cx: 24, cy: 27, r: 13, fill: 'none', stroke: '#fff', 'stroke-width': 4 });
  add('path', { d: 'M20 8h8M24 8v6M24 27V19.5', stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round' });
  add('circle', { cx: 24, cy: 27, r: 3.2, fill: '#fff' });
  return svg;
}

/** Remember where someone was going (a join link, a deep link) while they sign in. */
export function rememberDestination(hash) {
  if (!hash || /^#(login|welcome)?$/.test(hash)) return;
  try { sessionStorage.setItem(AFTER, hash); } catch { /* fine */ }
}
function takeDestination() {
  try { const v = sessionStorage.getItem(AFTER); sessionStorage.removeItem(AFTER); return v; } catch { return null; }
}

/** Where to go once signed in and set up. */
export function landing() {
  const next = takeDestination();
  if (next) return next;
  return isAdmin() ? '#admin' : '#capture';
}

/* ---------- sign in ---------- */
export function renderLogin(root, { onDone }) {
  const user = h('input', { type: 'text', id: 'login-user', name: 'username', autocomplete: 'username', autocapitalize: 'characters', spellcheck: 'false', required: true, placeholder: 'Username' });
  const pass = h('input', { type: 'password', id: 'login-pass', name: 'password', autocomplete: 'current-password', required: true, placeholder: 'Password' });
  const eye = h('button', { type: 'button', class: 'gate-eye', 'aria-label': 'Show password', title: 'Show password' }, icon('eye'));
  eye.addEventListener('click', () => {
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    clear(eye, icon(show ? 'eyeOff' : 'eye'));
  });
  const err = h('p', { class: 'gate-err', role: 'alert', hidden: true });
  const btn = h('button', { type: 'submit', class: 'btn primary big gate-go' }, icon('lock'), 'Sign in');
  const form = h('form', { class: 'gate-form', novalidate: true },
    h('label', { class: 'gate-field' }, h('span', { class: 'gate-ico' }, icon('user')), h('span', { class: 'sr-only', text: 'Username' }), user),
    h('label', { class: 'gate-field' }, h('span', { class: 'gate-ico' }, icon('lock')), h('span', { class: 'sr-only', text: 'Password' }), pass, eye),
    err, btn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (!user.value.trim() || !pass.value) { err.textContent = 'Enter the username and password.'; err.hidden = false; return; }
    btn.disabled = true;
    try {
      const role = await signIn(user.value, pass.value);
      if (!role) { err.textContent = 'That username and password don’t match. Check with your CI lead.'; err.hidden = false; pass.select(); return; }
      onDone(role);
    } catch (x) {
      err.textContent = x.message; err.hidden = false;
    } finally { btn.disabled = false; }
  });
  clear(root, h('section', { class: 'gate' },
    h('div', { class: 'gate-card' },
      h('div', { class: 'gate-brand' }, brandMark(), h('div', {}, h('h1', { text: 'Touch Map' }), h('p', { class: 'muted', text: 'Time and categorise every touch on the line.' }))),
      form,
      h('p', { class: 'gate-foot muted small' }, icon('users'), ' One shared login for your organisation. New here? Sign in, then set up your plant and name.'))));
  setTimeout(() => user.focus(), 50);
}

/* ---------- onboarding ---------- */
const STEPS = [
  { key: 'bu', title: 'Business unit', ico: 'globe' },
  { key: 'plant', title: 'Plant', ico: 'factory' },
  { key: 'line', title: 'Production line', ico: 'line' },
  { key: 'name', title: 'Your name', ico: 'user' },
];

export function renderWelcome(root, { onDone }) {
  const p = state.profile || {};
  // Preloaded: Romania and Ploiești; the K3 line when it is the only live one.
  const model = {
    bu: p.bu || ORG.units[0].id,
    plant: p.plant || ORG.units[0].plants.find(x => x.live)?.id || '',
    line: p.line || '',
    otherLine: p.lineCustom ? p.lineName : '',
    name: p.name || state.observer || '',
  };
  let step = p.at ? 3 : 0;
  if (!p.at) {
    const plant = plantById(model.plant);
    const live = plant?.lines.filter(l => l.live) || [];
    if (live.length === 1) model.line = live[0].id;
  }

  const done = (k) => (k === 'bu' ? !!model.bu : k === 'plant' ? !!plantById(model.plant)?.live : k === 'line' ? (model.line === 'other' ? !!model.otherLine.trim() : !!model.line) : !!model.name.trim());
  const summary = (k) => {
    if (k === 'bu') return unitById(model.bu)?.name;
    if (k === 'plant') return plantById(model.plant)?.name;
    if (k === 'line') { if (model.line === 'other') return model.otherLine.trim(); const l = plantById(model.plant)?.lines.find(x => x.id === model.line); return l ? `${l.name} · ${l.blurb}` : ''; }
    return model.name.trim();
  };
  const go = (i) => { step = i; paint(); requestAnimationFrame(() => root.querySelector('.ob-step.open')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); };
  // walk every level in order, so the plants and lines on offer are always seen
  const nextFrom = (i) => go(Math.min(3, i + 1));
  const cont = (i) => h('div', { class: 'ob-foot' },
    h('button', { type: 'button', class: 'btn primary', disabled: !done(STEPS[i].key), onclick: () => nextFrom(i) }, 'Continue', icon('chevronRight')));

  function card({ id, title, sub, ico, on, disabled, tag, onPick }) {
    return h('button', {
      type: 'button', class: 'ob-card' + (on ? ' on' : '') + (disabled ? ' off' : ''), 'aria-pressed': String(!!on), 'aria-disabled': disabled ? 'true' : null, 'data-id': id,
      onclick: () => { if (!disabled) onPick(); },
    },
    h('span', { class: 'ob-ico' }, icon(ico)),
    h('span', { class: 'ob-txt' }, h('strong', { text: title }), sub ? h('span', { class: 'muted', text: sub }) : null,
      tag ? h('span', { class: 'ob-tag', text: tag }) : null),
    on ? h('span', { class: 'ob-check' }, icon('check')) : null);
  }

  function body(k) {
    if (k === 'bu') {
      return h('div', {}, h('div', { class: 'ob-cards' }, ORG.units.map(u => card({
        id: u.id, title: u.name, sub: `${u.plants.length} plants`, ico: 'globe', on: model.bu === u.id,
        onPick: () => { if (model.bu !== u.id) { model.bu = u.id; model.plant = ''; model.line = ''; } nextFrom(0); },
      }))), cont(0));
    }
    if (k === 'plant') {
      const unit = unitById(model.bu);
      return h('div', {}, h('div', { class: 'ob-cards' }, (unit?.plants || []).map(pl => card({
        id: pl.id, title: pl.name, sub: pl.live ? `${pl.lines.filter(l => l.live).length} line live` : `${pl.lines.length} lines`, ico: 'factory',
        on: model.plant === pl.id, disabled: !pl.live, tag: pl.live ? null : 'Coming soon',
        onPick: () => { if (model.plant !== pl.id) { model.plant = pl.id; model.line = ''; const live = pl.lines.filter(l => l.live); if (live.length === 1) model.line = live[0].id; } nextFrom(1); },
      }))), cont(1));
    }
    if (k === 'line') {
      const plant = plantById(model.plant);
      const other = h('input', { type: 'text', class: 'ob-input', placeholder: 'Line name, e.g. K5', maxlength: '60', value: model.otherLine, 'aria-label': 'Line name' });
      other.addEventListener('input', () => { model.otherLine = other.value; paintSteps(); const b = root.querySelector('.ob-step.open .ob-foot .btn'); if (b) b.disabled = !done('line'); });
      other.addEventListener('keydown', (e) => { if (e.key === 'Enter' && other.value.trim()) nextFrom(2); });
      return h('div', {},
        h('div', { class: 'ob-cards' },
          (plant?.lines || []).map(l => card({
            id: l.id, title: l.name, sub: l.blurb, ico: 'line', on: model.line === l.id, disabled: !l.live, tag: l.live ? null : 'Coming soon',
            onPick: () => { model.line = l.id; nextFrom(2); },
          })),
          card({ id: 'other', title: 'Another line', sub: 'Type its name', ico: 'plus', on: model.line === 'other', onPick: () => { model.line = 'other'; paint(); setTimeout(() => root.querySelector('.ob-input')?.focus(), 30); } })),
        model.line === 'other' ? h('div', { class: 'ob-row' }, other) : null,
        cont(2));
    }
    const name = h('input', { type: 'text', class: 'ob-input big', id: 'ob-name', placeholder: 'First and last name', autocomplete: 'name', maxlength: '80', value: model.name, 'aria-label': 'Your name' });
    const finish = h('button', { type: 'button', class: 'btn primary big', disabled: !model.name.trim(), onclick: complete }, icon('check'), p.at ? 'Save profile' : 'Start mapping');
    name.addEventListener('input', () => { model.name = name.value; finish.disabled = !name.value.trim(); paintSteps(); });
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter' && name.value.trim()) complete(); });
    setTimeout(() => { if (step === 3 && document.activeElement?.tagName !== 'INPUT') name.focus(); }, 60);
    return h('div', {},
      h('p', { class: 'muted small ob-help', text: 'It is saved with every touch you log, so the plant and line see who mapped what.' }),
      h('div', { class: 'ob-row' }, name, finish));
  }

  function complete() {
    if (!STEPS.every(s => done(s.key))) { nextFrom(-1); toast('A step is still open.', { tone: 'bad' }); return; }
    const unit = unitById(model.bu), plant = plantById(model.plant);
    const line = model.line === 'other' ? null : plant.lines.find(l => l.id === model.line);
    const lineName = line ? line.full : model.otherLine.trim();
    state.profile = {
      name: model.name.trim(), bu: unit.id, buName: unit.name, plant: plant.id, plantName: plant.name,
      line: line ? line.id : 'other', lineName, lineCustom: !line, at: new Date().toISOString(),
    };
    state.observer = state.profile.name;
    // The run in hand takes the plant and line, unless it already holds touches from elsewhere.
    const run = activeRun();
    if (run && !run.touches.length) Object.assign(run.info, { bu: unit.name, plant: plant.name, line: lineName });
    save();
    onDone(state.profile);
  }

  const stepsEl = h('div', { class: 'ob-steps' });
  function paintSteps() {
    for (const el of stepsEl.querySelectorAll('.ob-step')) {
      const k = el.dataset.step;
      el.classList.toggle('done', done(k));
      const sum = el.querySelector('.ob-sum');
      if (sum) sum.textContent = done(k) ? summary(k) : '';
    }
  }
  function paint() {
    clear(stepsEl, STEPS.map((s, i) => {
      const open = i === step;
      const ok = done(s.key);
      const reachable = i === 0 || STEPS.slice(0, i).every(x => done(x.key));
      return h('section', { class: 'ob-step' + (open ? ' open' : '') + (ok ? ' done' : '') + (reachable ? '' : ' locked'), 'data-step': s.key },
        h('button', { type: 'button', class: 'ob-head', 'aria-expanded': String(open), disabled: !reachable, onclick: () => go(open ? Math.min(3, i + 1) : i) },
          h('span', { class: 'ob-num' }, ok && !open ? icon('check') : String(i + 1)),
          h('span', { class: 'ob-title' }, h('strong', { text: s.title }), h('span', { class: 'ob-sum', text: ok && !open ? summary(s.key) : '' })),
          reachable && !open ? h('span', { class: 'ob-change', text: ok ? 'Change' : 'Open' }) : null,
          icon('chevron', 'ob-chev')),
        open ? h('div', { class: 'ob-body' }, body(s.key)) : null);
    }));
    progress.textContent = `Step ${Math.min(step + 1, 4)} of 4`;
  }
  const progress = h('span', { class: 'ob-progress muted small' });
  clear(root, h('section', { class: 'gate onboard' },
    h('div', { class: 'ob-wrap' },
      h('header', { class: 'ob-top' },
        brandMark(),
        h('div', { class: 'grow' }, h('h1', { text: p.at ? 'Your profile' : 'Set up your profile' }), progress),
        p.at ? h('a', { class: 'btn ghost small', href: '#setup' }, icon('close'), 'Cancel')
          : h('button', { type: 'button', class: 'btn ghost small', onclick: () => { signOut(); location.hash = '#login'; location.reload(); } }, icon('logout'), 'Sign out')),
      h('p', { class: 'ob-intro muted' }, 'Pick where you map touches. Every touch you log is tagged with this plant and line, so each site sees its own numbers and the business unit can compare them.'),
      stepsEl)));
  paint();
}
