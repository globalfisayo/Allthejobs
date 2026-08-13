/* card.js — the STAR card: Skills · Tasks · Accountable for · Requirements */
import { getUnit, getGroup, pathTitles, getRolesIndex, state, SYS, TEER, levelName, esc } from './data.js';
import { deriveSkills } from './skills.js';

let layer, panel, lastSpec = null;

export function initCard() {
  layer = document.getElementById('card-layer');
  panel = document.getElementById('rolecard');
  document.getElementById('card-scrim').addEventListener('click', () => closeCard());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCard(); });
  window.addEventListener('syschange', () => { if (lastSpec && !layer.hidden) openCard(lastSpec); });
}

export function closeCard(silent = false) {
  if (!layer || layer.hidden) return;
  layer.classList.remove('show');
  lastSpec = null;
  setTimeout(() => { layer.hidden = true; panel.innerHTML = ''; }, 220);
  if (!silent) {
    const h = location.hash.replace(/\?(role|code)=[^&]*/, '');
    history.replaceState(null, '', h || '#/');
  }
}

export async function openCard(spec) {
  lastSpec = spec;
  layer.hidden = false;
  requestAnimationFrame(() => layer.classList.add('show'));
  panel.innerHTML = `<div class="rc-inner"><div class="rc-grab"></div><p style="color:var(--muted);font-size:13px">Gathering the leaves…</p></div>`;
  try {
    let html = '';
    if (spec.type === 'role') html = await roleCard(spec);
    else if (spec.type === 'unit') html = await unitCard(spec);
    else if (spec.type === 'group') html = await groupCard(spec);
    else if (spec.type === 'regulator') html = regulatorCard(spec);
    if (lastSpec !== spec) return; // superseded
    panel.innerHTML = `<div class="rc-inner"><div class="rc-grab"></div>
      <button class="rc-close" aria-label="Close">✕</button>${html}</div>`;
    panel.querySelector('.rc-close').addEventListener('click', () => closeCard());
    panel.scrollTop = 0;
    wire();
  } catch (err) {
    console.error(err);
    panel.innerHTML = `<div class="rc-inner"><button class="rc-close">✕</button>
      <p style="color:var(--muted)">Couldn't open this card: ${esc(err.message)}</p></div>`;
    panel.querySelector('.rc-close').addEventListener('click', () => closeCard());
  }
}

function wire() {
  panel.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => {
    const d = b.dataset;
    if (d.open === 'unit') openCard({ type: 'unit', sys: d.sys, code: d.code });
    else if (d.open === 'group') openCard({ type: 'group', sys: d.sys, code: d.code });
    else if (d.open === 'atlas') { closeCard(true); location.hash = `#/atlas?sys=${d.sys}&code=${d.code}`; }
    else if (d.open === 'go') { closeCard(true); location.hash = d.href; if (d.href.includes('?role=')) setTimeout(() => location.reload.bind(location), 0); }
  }));
  panel.querySelectorAll('.showmore').forEach(b => b.addEventListener('click', () => {
    b.previousElementSibling.querySelectorAll('li[hidden]').forEach(li => li.hidden = false);
    b.remove();
  }));
}

const starH = (letter, cls, label, note) =>
  `<h3 class="rc-h"><span class="star-badge ${cls}">${letter}</span>${label}${note ? `<em>${note}</em>` : ''}</h3>`;

function list(items, cls = '', visible = 7) {
  if (!items?.length) return '<p style="color:var(--muted);font-size:12.5px">Not specified in this system.</p>';
  const lis = items.map((x, i) => `<li ${i >= visible ? 'hidden' : ''}>${esc(x)}</li>`).join('');
  const more = items.length > visible ? `<button class="showmore">Show all ${items.length} →</button>` : '';
  return `<ul class="rc-list ${cls}">${lis}</ul>${more}`;
}

function codeChips(role) {
  const chips = [];
  if (role.noc) {
    chips.push(`<button class="code-chip ${state.sys === 'noc' ? 'active' : ''}" data-open="atlas" data-sys="noc" data-code="${role.noc}" title="Open in Atlas">
      <span class="flag">🇨🇦</span> NOC <span class="mono">${role.noc}</span></button>`);
    chips.push(`<span class="code-chip teer-chip" title="${esc(TEER[+role.noc[1]])}">TEER ${role.noc[1]}</span>`);
  }
  if (role.soc) chips.push(`<button class="code-chip ${state.sys === 'soc' ? 'active' : ''}" data-open="atlas" data-sys="soc" data-code="${role.soc}" title="Open in Atlas">
      <span class="flag">🇬🇧</span> SOC <span class="mono">${role.soc}</span></button>`);
  return `<div class="rc-codes">${chips.join('')}</div>`;
}

/* STAR block from an official unit record */
function unitSTAR(sys, unit, roleAcc = null, about = null) {
  const tasks = sys === 'noc' ? unit.duties : unit.tasks;
  const reqs = sys === 'noc' ? unit.reqs : (unit.entry ? [unit.entry] : []);
  const skills = deriveSkills([...(tasks || []), unit.lead || '']);
  const src = SYS[sys].short + ' ' + SYS[sys].name.replace(SYS[sys].short + ' ', '');
  let html = '';

  html += `<div class="rc-section">${starH('S', 's', 'Skills', 'distilled from official duties')}
    <div class="chips">${skills.map(s => `<span class="chip sky">${esc(s)}</span>`).join('') || '<span class="chip sky">—</span>'}</div></div>`;

  html += `<div class="rc-section">${starH('T', 't', 'Tasks', `verbatim · ${SYS[sys].short}`)}${list(tasks, '')}</div>`;

  html += `<div class="rc-section">${starH('A', 'a', 'Accountable for', roleAcc ? 'in this organisation' : 'the mandate')}`;
  if (roleAcc?.length) html += `<ul class="rc-list gold">${roleAcc.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`;
  if (about) html += `<p class="rc-lead">${esc(about)}</p>`;
  if (unit.lead) html += `<p class="rc-lead official" style="margin-top:${roleAcc?.length ? '10px' : '0'}">“${esc(unit.lead)}”</p>`;
  html += `</div>`;

  html += `<div class="rc-section">${starH('R', 'r', 'Requirements', `qualifications · ${SYS[sys].short}`)}${list(reqs, 'bark', 6)}</div>`;

  const extras = [];
  const egs = sys === 'noc' ? unit.egs : unit.related;
  if (egs?.length) extras.push(`<details class="rc-sub"><summary>Also answers to (${egs.length} example titles)</summary>
    <div class="chips">${egs.slice(0, 24).map(x => `<span class="chip">${esc(x)}</span>`).join('')}${egs.length > 24 ? `<span class="chip">+${egs.length - 24} more</span>` : ''}</div></details>`);
  if (sys === 'noc' && unit.excl?.length) extras.push(`<details class="rc-sub"><summary>Not to be confused with</summary><ul>${unit.excl.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`);
  if (sys === 'noc' && unit.addl?.length) extras.push(`<details class="rc-sub"><summary>Additional information</summary><ul>${unit.addl.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`);
  return html + extras.join('');
}

/* ---------- role card (opened from a firm tree) ---------- */
async function roleCard({ firm, hier, roleId }) {
  const role = hier.byid.get(roleId);
  const sys = state.sys;

  if (role.kind === 'governance') {
    const kids = role.kids.map(k => `<button class="linky" data-open="go" data-href="#/firm/${firm.id}?role=${k.id}">${esc(k.title)}</button>`).join(' · ');
    return `
      <div class="rc-kicker">${esc(firm.name)} <span class="dot">·</span> Governance</div>
      <h2 class="rc-title serif">${esc(role.title)}</h2>
      <p class="rc-lead">${esc(role.about || '')}</p>
      <div class="rc-section">${starH('A', 'a', 'Accountable for', 'governance')}
        <ul class="rc-list gold">${(role.acc || []).map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
      <div class="rc-section">${starH('C', 't', 'Committees', '')}
        <div class="chips">${firm.governance.committees.map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div></div>
      <div class="rc-orgline">Direct reports: ${kids || '—'}</div>
      <div class="rc-foot">Boards are elected/appointed rather than classified: national occupational systems classify jobs, and directorships are offices. Regulators shown in the sky hold the board accountable.</div>`;
  }

  const code = sys === 'noc' ? role.noc : role.soc;
  const unit = code ? await getUnit(sys, code) : null;
  const mgr = role.reports && hier.byid.get(role.reports);
  const reportsChips = role.kids.slice(0, 10).map(k =>
    `<button class="linky" data-open="go" data-href="#/firm/${firm.id}?role=${k.id}">${esc(k.title)}</button>`).join(', ');
  const dotted = (role.dotted || []).map(d => hier.byid.get(d)?.title).filter(Boolean);
  const country = sys === 'noc' ? 'ca' : 'uk';
  const touching = (firm.regulators?.[country] || []).filter(r => (r.touch || []).includes(roleId));

  return `
    <div class="rc-kicker">${esc(firm.name)} <span class="dot">·</span> ${esc(role.division)}</div>
    <h2 class="rc-title serif">${esc(role.title)}</h2>
    ${unit ? `<p class="rc-lead">Classified as <b>${esc(unit.t)}</b> — ${esc(levelName(sys, code))} ${code}, ${SYS[sys].name}.</p>` : ''}
    ${codeChips(role)}
    <div class="rc-orgline">
      ${mgr ? `Reports to <button class="linky" data-open="go" data-href="#/firm/${firm.id}?role=${mgr.id}">${esc(mgr.title)}</button>` : ''}
      ${role.kids.length ? `<br>Direct reports (${role.kids.length}): ${reportsChips}${role.kids.length > 10 ? '…' : ''}` : ''}
      ${dotted.length ? `<br>Dotted line: <b>${dotted.map(esc).join(', ')}</b>` : ''}
      ${touching.length ? `<div class="rc-reg-touch">${touching.map(r => `<span class="reg-pill" title="${esc(r.full)}">☁️ ${esc(r.n)} watches this role</span>`).join('')}</div>` : ''}
    </div>
    ${unit ? unitSTAR(sys, unit, role.acc, role.about) : ''}
    <div class="rc-foot">Reporting lines are typical for this firm-type, not universal — many roles can answer to more than one chair.
    Official texts: ${sys === 'noc' ? 'Statistics Canada, NOC 2021 V1.0 (Open Licence)' : 'ONS, SOC 2020 (OGL v3.0)'}.</div>`;
}

/* ---------- unit card (from Atlas or search) ---------- */
async function unitCard({ sys, code }) {
  const unit = await getUnit(sys, code);
  const path = await pathTitles(sys, code);
  const crumbs = path.slice(0, -1).map(p =>
    `<button class="linky" data-open="group" data-sys="${sys}" data-code="${p.c}">${esc(p.t)}</button>`).join(' <span class="dot">›</span> ');

  // where does this unit live in the garden?
  let garden = '';
  try {
    const roles = await getRolesIndex();
    const hits = roles.filter(r => (sys === 'noc' ? r[4] : r[5]) === code).slice(0, 8);
    if (hits.length) garden = `<div class="rc-section">${starH('🌳', 't', 'Growing in the garden', '')}
      <div class="chips">${hits.map(h => `<button class="chip" style="cursor:pointer;border:0" data-open="go" data-href="#/firm/${h[1]}?role=${h[2]}">${esc(h[0])} · ${esc(h[1].replace(/-/g, ' '))}</button>`).join('')}</div></div>`;
  } catch { /* roles index optional */ }

  return `
    <div class="rc-kicker">${SYS[sys].flag} ${SYS[sys].name} <span class="dot">·</span> ${esc(levelName(sys, code))} ${code}
      ${sys === 'noc' ? `<span class="dot">·</span> TEER ${code[1]}` : ''}</div>
    <h2 class="rc-title serif">${esc(unit.t)}</h2>
    <p class="rc-lead" style="font-size:12px">${crumbs}</p>
    ${sys === 'noc' ? `<div class="rc-codes"><span class="code-chip teer-chip" title="${esc(TEER[+code[1]])}">TEER ${code[1]} — ${esc(TEER[+code[1]])}</span></div>` : ''}
    ${unitSTAR(sys, unit)}
    ${garden}
    <div class="rc-foot">Source: ${sys === 'noc'
      ? 'Adapted from Statistics Canada, NOC 2021 Version 1.0. Not an endorsement by Statistics Canada.'
      : 'ONS, SOC 2020 — public sector information licensed under OGL v3.0.'}</div>`;
}

/* ---------- group card ---------- */
async function groupCard({ sys, code }) {
  const g = await getGroup(sys, code);
  const path = await pathTitles(sys, code);
  const crumbs = path.slice(0, -1).map(p =>
    `<button class="linky" data-open="group" data-sys="${sys}" data-code="${p.c}">${esc(p.t)}</button>`).join(' <span class="dot">›</span> ') || `${SYS[sys].name}`;
  return `
    <div class="rc-kicker">${SYS[sys].flag} ${SYS[sys].name} <span class="dot">·</span> ${esc(levelName(sys, code))} ${code}</div>
    <h2 class="rc-title serif">${esc(g.t)}</h2>
    <p class="rc-lead" style="font-size:12px">${crumbs}</p>
    <div class="rc-section">${starH('A', 'a', 'What this family covers', 'official definition')}
      <p class="rc-lead official">“${esc(g.d)}”</p></div>
    <div class="rc-orgline">Browse its members in the <button class="linky" data-open="atlas" data-sys="${sys}" data-code="${code}">Atlas ↗</button></div>`;
}

/* ---------- regulator card ---------- */
function regulatorCard({ firm, hier, regName }) {
  const country = state.sys === 'noc' ? 'ca' : 'uk';
  const rg = (firm.regulators?.[country] || []).find(r => r.n === regName)
    || (firm.regulators?.[country === 'ca' ? 'uk' : 'ca'] || []).find(r => r.n === regName);
  if (!rg) return '<p>Unknown regulator.</p>';
  const touched = (rg.touch || []).map(t => hier.byid.get(t)).filter(Boolean);
  return `
    <div class="rc-kicker">☁️ Regulator <span class="dot">·</span> ${country === 'ca' ? '🇨🇦 Canada' : '🇬🇧 United Kingdom'}</div>
    <h2 class="rc-title serif">${esc(rg.full)}</h2>
    <div class="rc-codes"><span class="code-chip" style="cursor:default">${esc(rg.n)}</span></div>
    <div class="rc-section">${starH('A', 'a', 'What it regulates', '')}
      <p class="rc-lead">${esc(rg.what)}</p></div>
    ${touched.length ? `<div class="rc-orgline">Dotted lines into <b>${esc(firm.name)}</b>:<br>
      ${touched.map(t => `<button class="linky" data-open="go" data-href="#/firm/${firm.id}?role=${t.id}">${esc(t.title)}</button>`).join(' · ')}</div>` : ''}
    <div class="rc-foot">Regulators sit outside the organogram — the dotted lines in the sky show supervision, not employment. The board answers to them on the firm's behalf.</div>`;
}
